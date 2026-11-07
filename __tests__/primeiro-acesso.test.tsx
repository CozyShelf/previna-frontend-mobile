/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import PrimeiroAcessoScreen from '@/app/primeiro-acesso';
import { anexarFoto } from '@/components/seletor-foto';
import { ApiError, put } from '@/lib/api';
import { encerrarSessao, iniciarSessao, obterToken } from '@/lib/sessao';

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
  return { ApiError, put: jest.fn() };
});

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`Redirecionou para ${href}`}</Text>,
    router: { replace: jest.fn() },
  };
});

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// O seletor de foto tem testes próprios; aqui basta um botão que escolhe uma foto
jest.mock('@/components/seletor-foto', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    SeletorFoto: ({ onChange }: { onChange: (foto: string) => void }) => (
      <Text accessibilityRole="button" onPress={() => onChange('file:///cache/foto.jpg')}>
        Escolher foto de teste
      </Text>
    ),
    anexarFoto: jest.fn((dados: FormData, campo: string, uri: string) => dados.append(campo, uri)),
  };
});

const mockPut = put as jest.Mock;

const CONSENTIMENTO = /^Autorizo o Previna a usar meus dados/;

async function digitar(rotulo: string, texto: string) {
  await fireEvent.changeText(screen.getByLabelText(rotulo), texto);
}

async function sair(rotulo: string) {
  await fireEvent(screen.getByLabelText(rotulo), 'blur', {});
}

async function salvar() {
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar e continuar' }));
}

async function preencherAcesso() {
  await digitar('Novo login', '  maria.silva  ');
  await digitar('Nova senha', 'segredo123');
  await digitar('Confirme a nova senha', 'segredo123');
}

async function autorizar() {
  await fireEvent.press(screen.getByText(CONSENTIMENTO));
}

// Campos enviados no multipart, na ordem
function enviado(): Record<string, unknown> {
  const dados: FormData = mockPut.mock.calls[0][1];
  return Object.fromEntries(dados.entries());
}

beforeEach(async () => {
  jest.clearAllMocks();
  iniciarSessao('token-temporario');
  mockPut.mockResolvedValue({ token: 'token-novo' });
});

afterAll(() => encerrarSessao());

it('sem sessão volta para o login', async () => {
  await encerrarSessao();
  await render(<PrimeiroAcessoScreen />);

  expect(screen.getByText('Redirecionou para /')).toBeTruthy();
});

describe('validação', () => {
  it('salvar em branco mostra o que falta em cada campo e não envia', async () => {
    await render(<PrimeiroAcessoScreen />);
    await salvar();

    expect(screen.getByText('Informe o novo login.')).toBeTruthy();
    expect(screen.getByText('Crie uma senha.')).toBeTruthy();
    expect(screen.getByText('Repita a nova senha.')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('o erro do login só aparece ao sair do campo e depois acompanha a digitação', async () => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Novo login', 'ma');
    expect(screen.queryByText('O login deve ter pelo menos 4 caracteres.')).toBeNull();

    await sair('Novo login');
    expect(screen.getByText('O login deve ter pelo menos 4 caracteres.')).toBeTruthy();

    await digitar('Novo login', 'maria');
    expect(screen.queryByText('O login deve ter pelo menos 4 caracteres.')).toBeNull();
  });

  it.each([
    ['maria silva', 'Use só letras sem acento, números, ponto, hífen ou sublinhado, sem espaços.'],
    ['mária', 'Use só letras sem acento, números, ponto, hífen ou sublinhado, sem espaços.'],
    ['abc', 'O login deve ter pelo menos 4 caracteres.'],
    ['1234', 'O login precisa ter pelo menos uma letra.'],
    ['   ', 'Informe o novo login.'],
  ])('login %p: %s', async (login, mensagem) => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Novo login', login);
    await sair('Novo login');

    expect(screen.getByText(mensagem)).toBeTruthy();
  });

  it.each(['m_1.a-b', 'Maria2026'])('login %p é válido', async (login) => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Novo login', login);
    await sair('Novo login');

    expect(screen.queryByText(/^(Use só|O login|Informe o novo)/)).toBeNull();
  });

  it.each([
    ['!', 'A senha precisa de pelo menos 8 caracteres, uma letra e um número.'],
    ['abc', 'A senha precisa de pelo menos 8 caracteres e um número.'],
    ['12345678', 'A senha precisa de uma letra.'],
    ['abcdefgh', 'A senha precisa de um número.'],
  ])('senha %p mostra o que falta desde a primeira tecla', async (senha, mensagem) => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Nova senha', senha);

    expect(screen.getByText(mensagem)).toBeTruthy();
  });

  it('sair da senha em branco pede para criar uma', async () => {
    await render(<PrimeiroAcessoScreen />);
    expect(screen.queryByText('Crie uma senha.')).toBeNull();
    await sair('Nova senha');

    expect(screen.getByText('Crie uma senha.')).toBeTruthy();
  });

  it('o erro da senha acompanha cada tecla até ficar válida', async () => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Nova senha', 'segredo');
    expect(screen.getByText('A senha precisa de pelo menos 8 caracteres e um número.')).toBeTruthy();

    await digitar('Nova senha', 'segr1');
    expect(screen.getByText('A senha precisa de pelo menos 8 caracteres.')).toBeTruthy();

    await digitar('Nova senha', 'segredo12');
    await sair('Nova senha');
    expect(screen.queryByText(/A senha precisa/)).toBeNull();
  });

  it('senha válida não mostra erro', async () => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Nova senha', 'segredo123');

    expect(screen.queryByText(/A senha precisa/)).toBeNull();
  });

  it('confirmação diferente avisa que as senhas não conferem', async () => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Nova senha', 'segredo123');
    await digitar('Confirme a nova senha', 'segredo124');
    await sair('Confirme a nova senha');

    expect(screen.getByText('As senhas não conferem.')).toBeTruthy();
  });

  it.each(['0', '51'])('%p pessoas na casa está fora do limite', async (pessoas) => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Quantas pessoas moram na sua casa?', pessoas);
    await sair('Quantas pessoas moram na sua casa?');

    expect(screen.getByText('Informe de 1 a 50 pessoas.')).toBeTruthy();
  });

  it('pessoas aceita só dígitos', async () => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Quantas pessoas moram na sua casa?', '3a');

    expect(screen.getByLabelText('Quantas pessoas moram na sua casa?').props.value).toBe('3');
  });

  it('pessoas inválido impede o envio mesmo com o acesso certo', async () => {
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await digitar('Quantas pessoas moram na sua casa?', '60');
    await autorizar();
    await salvar();

    expect(screen.getByText('Informe de 1 a 50 pessoas.')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('sem autorizar o uso dos dados não envia', async () => {
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await salvar();

    expect(screen.getByText('Para continuar, autorize o uso dos seus dados.')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('tocar no texto do consentimento duas vezes desmarca', async () => {
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await autorizar();
    await autorizar();
    await salvar();

    expect(screen.getByText('Para continuar, autorize o uso dos seus dados.')).toBeTruthy();
  });
});

describe('renda', () => {
  it('mostra separador de milhar e ignora zeros à esquerda e símbolos', async () => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Renda familiar mensal (R$)', 'R$ 0012500');

    expect(screen.getByLabelText('Renda familiar mensal (R$)').props.value).toBe('12.500');
  });

  it('zero sozinho continua zero', async () => {
    await render(<PrimeiroAcessoScreen />);
    await digitar('Renda familiar mensal (R$)', '000');

    expect(screen.getByLabelText('Renda familiar mensal (R$)').props.value).toBe('0');
  });
});

describe('envio', () => {
  it('só com o obrigatório manda login, senha e consentimento, troca a sessão e segue para o tutorial', async () => {
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await fireEvent(screen.getByLabelText(CONSENTIMENTO), 'valueChange', true);
    await salvar();

    expect(mockPut).toHaveBeenCalledWith('/gestantes/primeiro-acesso', expect.any(FormData));
    expect(enviado()).toEqual({
      novoLogin: 'maria.silva',
      novaSenha: 'segredo123',
      consentimentoLgpd: 'true',
    });
    expect(anexarFoto).not.toHaveBeenCalled();
    expect(obterToken()).toBe('token-novo');
    expect(router.replace).toHaveBeenCalledWith('/tutorial');
  });

  it('com tudo preenchido manda os dados opcionais e a foto', async () => {
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await digitar('Renda familiar mensal (R$)', '2.500');
    await digitar('Quantas pessoas moram na sua casa?', '4');
    await fireEvent.press(screen.getByRole('radio', { name: 'Médio completo' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Não' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto de teste' }));
    await autorizar();
    await salvar();

    expect(enviado()).toEqual({
      novoLogin: 'maria.silva',
      novaSenha: 'segredo123',
      consentimentoLgpd: 'true',
      rendaFamiliar: '2500',
      pessoasDomicilio: '4',
      escolaridade: 'MEDIO_COMPLETO',
      beneficiariaProgramaSocial: 'false',
      foto: 'file:///cache/foto.jpg',
    });
    expect(anexarFoto).toHaveBeenCalledWith(expect.any(FormData), 'foto', 'file:///cache/foto.jpg');
  });

  it('beneficiária de programa social manda true', async () => {
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await fireEvent.press(screen.getByRole('radio', { name: 'Sim' }));
    await autorizar();
    await salvar();

    expect(enviado().beneficiariaProgramaSocial).toBe('true');
  });

  it('desmarcar a escolaridade tira o campo do envio', async () => {
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await fireEvent.press(screen.getByRole('radio', { name: 'Médio completo' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Médio completo' }));
    await autorizar();
    await salvar();

    expect(enviado()).not.toHaveProperty('escolaridade');
  });

  it('erro da API com mensagem mostra a mensagem e mantém a sessão temporária', async () => {
    mockPut.mockRejectedValue(new ApiError(409, 'Login já está em uso'));
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await autorizar();
    await salvar();

    expect(screen.getByText('Login já está em uso')).toBeTruthy();
    expect(obterToken()).toBe('token-temporario');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salvar e continuar' })).toBeEnabled();
  });

  it.each([new ApiError(500), new TypeError('Network request failed')])(
    'erro sem mensagem (%p) pede para verificar a conexão',
    async (erro) => {
      mockPut.mockRejectedValue(erro);
      await render(<PrimeiroAcessoScreen />);
      await preencherAcesso();
      await autorizar();
      await salvar();

      expect(screen.getByText(/Não foi possível salvar. Verifique sua conexão/)).toBeTruthy();
    },
  );

  it('durante o envio o botão fica desabilitado', async () => {
    let responder: (valor: unknown) => void = () => {};
    mockPut.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    await render(<PrimeiroAcessoScreen />);
    await preencherAcesso();
    await autorizar();

    // O toque só termina com a resposta: não espera aqui para ver o estado intermediário
    const toque = fireEvent.press(screen.getByRole('button', { name: 'Salvar e continuar' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();

    await act(async () => responder({ token: 'token-novo' }));
    await toque;
    expect(router.replace).toHaveBeenCalledWith('/tutorial');
  });
});
