/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { anexarFoto, SeletorFoto } from '@/components/seletor-foto';

jest.mock('expo-image-picker', () => ({
  CameraType: { front: 'front', back: 'back' },
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// manipulate(uri).resize(...).renderAsync() -> imagem.saveAsync(...)
const mockSalvar = jest.fn();
const mockRedimensionar = jest.fn();
const mockRenderizar = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: { manipulate: jest.fn() },
}));

// O File do expo-file-system aponta para o arquivo local; no teste basta guardar o endereço
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

const mockPermissao = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockCamera = ImagePicker.launchCameraAsync as jest.Mock;
const mockGaleria = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockManipular = ImageManipulator.manipulate as jest.Mock;

const escolhida = { canceled: false, assets: [{ uri: 'file:///camera/IMG_0001.HEIC' }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissao.mockResolvedValue({ granted: true });
  mockCamera.mockResolvedValue(escolhida);
  mockGaleria.mockResolvedValue(escolhida);
  mockSalvar.mockResolvedValue({ uri: 'file:///cache/reduzida.jpg' });
  mockRenderizar.mockResolvedValue({ saveAsync: mockSalvar });
  const contexto = { resize: mockRedimensionar, renderAsync: mockRenderizar };
  mockRedimensionar.mockReturnValue(contexto);
  mockManipular.mockReturnValue(contexto);
});

describe('foto exibida', () => {
  it('sem foto salva nem nova mostra o ícone e não oferece remover', async () => {
    await render(<SeletorFoto foto={undefined} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Sem foto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remover foto' })).toBeNull();
  });

  it('com foto salva mostra a foto e remover avisa null', async () => {
    const onChange = jest.fn();
    await render(<SeletorFoto atual={{ uri: 'http://api/foto' }} foto={undefined} onChange={onChange} />);

    expect(screen.getByLabelText('Sua foto')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remover foto' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('foto removida (null) esconde a foto salva', async () => {
    await render(<SeletorFoto atual={{ uri: 'http://api/foto' }} foto={null} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Sem foto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remover foto' })).toBeNull();
  });

  it('foto nova aparece no lugar da salva', async () => {
    await render(<SeletorFoto foto="file:///cache/nova.jpg" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Sua foto')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remover foto' })).toBeTruthy();
  });
});

describe('câmera', () => {
  it('sem permissão avisa e não abre a câmera', async () => {
    mockPermissao.mockResolvedValue({ granted: false });
    const onChange = jest.fn();
    await render(<SeletorFoto foto={undefined} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tirar foto' }));
    expect(screen.getByText(/Permita o uso da câmera/)).toBeTruthy();
    expect(mockCamera).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('com permissão abre a câmera frontal com corte quadrado, reduz e converte para JPEG', async () => {
    const onChange = jest.fn();
    await render(<SeletorFoto foto={undefined} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tirar foto' }));
    expect(mockCamera).toHaveBeenCalledWith({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      cameraType: 'front',
    });
    expect(mockManipular).toHaveBeenCalledWith('file:///camera/IMG_0001.HEIC');
    expect(mockRedimensionar).toHaveBeenCalledWith({ width: 512 });
    expect(mockSalvar).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
    expect(onChange).toHaveBeenCalledWith('file:///cache/reduzida.jpg');
  });

  it('o erro anterior some na nova tentativa', async () => {
    mockPermissao.mockResolvedValueOnce({ granted: false });
    await render(<SeletorFoto foto={undefined} onChange={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Tirar foto' }));
    expect(screen.getByText(/Permita o uso da câmera/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tirar foto' }));
    expect(screen.queryByText(/Permita o uso da câmera/)).toBeNull();
  });
});

describe('galeria', () => {
  it('não pede permissão da câmera e entrega a foto reduzida', async () => {
    const onChange = jest.fn();
    await render(<SeletorFoto foto={undefined} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
    expect(mockPermissao).not.toHaveBeenCalled();
    expect(mockGaleria).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('file:///cache/reduzida.jpg');
  });

  it('cancelar a escolha não muda nada', async () => {
    mockGaleria.mockResolvedValue({ canceled: true, assets: null });
    const onChange = jest.fn();
    await render(<SeletorFoto foto={undefined} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
    expect(mockManipular).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('imagem que não dá para converter mostra o erro', async () => {
    mockRenderizar.mockRejectedValue(new Error('formato não suportado'));
    const onChange = jest.fn();
    await render(<SeletorFoto foto={undefined} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
    expect(screen.getByText('Não foi possível usar esta imagem. Tente outra.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeEnabled();
  });

  it('durante o processamento os botões ficam desabilitados e remover some', async () => {
    let concluir: (valor: unknown) => void = () => {};
    mockRenderizar.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    await render(<SeletorFoto atual={{ uri: 'http://api/foto' }} foto={undefined} onChange={jest.fn()} />);

    // O toque só termina quando o processamento acaba: não espera aqui para ver o estado intermediário
    const toque = fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Escolher da galeria' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remover foto' })).toBeNull();

    await act(async () => concluir({ saveAsync: mockSalvar }));
    await toque;
    expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeEnabled();
  });
});

describe('anexarFoto', () => {
  it('anexa a foto como arquivo do caminho local', () => {
    const dados = new FormData();
    anexarFoto(dados, 'foto', 'file:///cache/reduzida.jpg');

    expect((dados.get('foto') as File & { uri: string }).uri).toBe('file:///cache/reduzida.jpg');
  });
});
