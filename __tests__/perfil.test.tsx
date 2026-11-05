/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import PerfilScreen from '@/app/(abas)/perfil';
import { ApiError, get, imagemDaApi, put } from '@/lib/api';
import { encerrarSessao } from '@/lib/sessao';

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    mensagem?: string;
    constructor(codigo: number, texto?: string) {
      super(`Erro ${codigo}`);
      this.status = codigo;
      this.mensagem = texto;
    }
  }
  return {
    ApiError,
    get: jest.fn(),
    put: jest.fn(),
    imagemDaApi: jest.fn((caminho: string) => ({ uri: `http://api${caminho}` })),
  };
});

jest.mock('@/lib/sessao', () => ({ encerrarSessao: jest.fn(() => Promise.resolve()) }));

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

jest.mock('expo-image-picker', () => ({
  CameraType: { front: 'front', back: 'back' },
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: { manipulate: jest.fn() },
}));

jest.mock('expo-file-system', () => {
  const Base = globalThis.File;
  return {
    File: class extends Base {
      uri: string;
      constructor(uri: string) {
        super([], 'foto.jpg', { type: 'image/jpeg' });
        this.uri = uri;
      }
    },
  };
});

const mockGet = get as jest.Mock;
const mockPut = put as jest.Mock;
const mockImagemDaApi = imagemDaApi as jest.Mock;

const perfil = { nome: 'Maria Silva', email: 'maria@exemplo.com', telefone: '11987654321', temFoto: false };

function enviado(): Record<string, unknown> {
  const dados: FormData = mockPut.mock.calls[0][1];
  return Object.fromEntries(dados.entries());
}

async function abrir(dados: object = perfil) {
  mockGet.mockResolvedValue(dados);
  await render(<PerfilScreen />);
  await screen.findByRole('header', { name: 'Maria Silva' });
}

async function salvar() {
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPut.mockImplementation(() => Promise.resolve(perfil));
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///galeria/IMG_0002.HEIC' }],
  });
  const imagem = { saveAsync: jest.fn(() => Promise.resolve({ uri: 'file:///cache/nova.jpg' })) };
  const contexto = { resize: jest.fn(), renderAsync: jest.fn(() => Promise.resolve(imagem)) };
  contexto.resize.mockReturnValue(contexto);
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue(contexto);
});

describe('carregamento', () => {
  it('mostra nome, telefone com máscara e e-mail', async () => {
    await abrir();

    expect(mockGet).toHaveBeenCalledWith('/gestantes/perfil');
    expect(screen.getByLabelText('Telefone').props.value).toBe('(11) 98765-4321');
    expect(screen.getByLabelText('E-mail').props.value).toBe('maria@exemplo.com');
    expect(screen.getByLabelText('Sem foto')).toBeTruthy();
  });

  it('sem e-mail deixa o campo vazio', async () => {
    await abrir({ ...perfil, email: undefined });

    expect(screen.getByLabelText('E-mail').props.value).toBe('');
  });

  it('com foto salva busca a foto protegida da API', async () => {
    await abrir({ ...perfil, temFoto: true });

    expect(mockImagemDaApi).toHaveBeenCalledWith('/gestantes/foto?v=0');
    expect(screen.getByLabelText('Sua foto')).toBeTruthy();
  });

  it('erro ao carregar mostra o alerta e ainda deixa sair', async () => {
    mockGet.mockRejectedValue(new Error('sem rede'));
    await render(<PerfilScreen />);

    expect(await screen.findByText(/Não foi possível carregar seu perfil/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
  });
});

describe('validação', () => {
  it('os erros só aparecem depois de tentar salvar', async () => {
    await abrir();
    await fireEvent.changeText(screen.getByLabelText('Telefone'), '119876');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'maria@');

    expect(screen.queryByText(/Informe o DDD/)).toBeNull();

    await salvar();
    expect(screen.getByText('Informe o DDD e o número, com 10 ou 11 dígitos.')).toBeTruthy();
    expect(screen.getByText('Informe um e-mail válido, como nome@exemplo.com.')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('o telefone é mascarado durante a digitação', async () => {
    await abrir();
    await fireEvent.changeText(screen.getByLabelText('Telefone'), '1123456789');

    expect(screen.getByLabelText('Telefone').props.value).toBe('(11) 2345-6789');
  });

  it('e-mail em branco é aceito e vai vazio', async () => {
    await abrir();
    await fireEvent.changeText(screen.getByLabelText('E-mail'), '   ');
    await salvar();

    expect(enviado()).toEqual({ telefone: '11987654321', email: '' });
  });
});

describe('salvar', () => {
  it('manda telefone só com dígitos e e-mail sem espaços, sem mexer na foto', async () => {
    await abrir();
    await fireEvent.changeText(screen.getByLabelText('E-mail'), '  nova@exemplo.com ');
    await salvar();

    expect(mockPut).toHaveBeenCalledWith('/gestantes/perfil', expect.any(FormData));
    expect(enviado()).toEqual({ telefone: '11987654321', email: 'nova@exemplo.com' });
    expect(screen.getByText('Alterações salvas.')).toBeTruthy();
  });

  it('foto nova da galeria vai como arquivo e depois a foto salva é buscada de novo', async () => {
    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
    expect(screen.getByLabelText('Sua foto')).toBeTruthy();

    mockPut.mockResolvedValue({ ...perfil, temFoto: true });
    await salvar();

    const foto = enviado().foto as File & { uri: string };
    expect(foto.uri).toBe('file:///cache/nova.jpg');
    expect(enviado()).not.toHaveProperty('removerFoto');
    // Endereço novo para não mostrar a foto antiga do cache
    expect(mockImagemDaApi).toHaveBeenLastCalledWith('/gestantes/foto?v=1');
    expect(screen.getByLabelText('Sua foto')).toBeTruthy();
  });

  it('remover a foto salva manda removerFoto', async () => {
    await abrir({ ...perfil, temFoto: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Remover foto' }));
    expect(screen.getByLabelText('Sem foto')).toBeTruthy();

    mockPut.mockResolvedValue({ ...perfil, temFoto: false });
    await salvar();

    expect(enviado()).toEqual({ telefone: '11987654321', email: 'maria@exemplo.com', removerFoto: 'true' });
    expect(screen.getByLabelText('Sem foto')).toBeTruthy();
  });

  it('mudar a foto depois de salvar tira o aviso de salvo', async () => {
    await abrir();
    await salvar();
    expect(screen.getByText('Alterações salvas.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
    expect(screen.queryByText('Alterações salvas.')).toBeNull();
  });

  it('e-mail em uso (409) tem mensagem própria', async () => {
    mockPut.mockRejectedValue(new ApiError(409, 'Conflict'));
    await abrir();
    await salvar();

    expect(screen.getByText('Este e-mail já está em uso por outro cadastro.')).toBeTruthy();
    expect(screen.queryByText('Alterações salvas.')).toBeNull();
  });

  it('outro erro da API mostra a mensagem dela', async () => {
    mockPut.mockRejectedValue(new ApiError(413, 'A foto deve ter no máximo 2 MB'));
    await abrir();
    await salvar();

    expect(screen.getByText('A foto deve ter no máximo 2 MB')).toBeTruthy();
  });

  it.each([new ApiError(500), new TypeError('Network request failed')])(
    'erro sem mensagem (%p) pede para verificar a conexão',
    async (erro) => {
      mockPut.mockRejectedValue(erro);
      await abrir();
      await salvar();

      expect(screen.getByText(/Não foi possível salvar. Verifique sua conexão/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
    },
  );

  it('durante o envio o botão fica desabilitado', async () => {
    let responder: (valor: unknown) => void = () => {};
    mockPut.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    await abrir();

    // O toque só termina com a resposta: não espera aqui para ver o estado intermediário
    const toque = fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();

    await act(async () => responder(perfil));
    await toque;
    expect(screen.getByText('Alterações salvas.')).toBeTruthy();
  });
});

it('sair encerra a sessão e volta para o login', async () => {
  await abrir();
  await fireEvent.press(screen.getByRole('button', { name: 'Sair' }));

  expect(encerrarSessao).toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/');
});
