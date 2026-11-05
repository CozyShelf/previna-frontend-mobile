/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import LoginScreen from '@/app/index';
import { ApiError, post } from '@/lib/api';
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
  return { ApiError, post: jest.fn() };
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

const mockPost = post as jest.Mock;

function jwt(perfil: string) {
  return `h.${btoa(JSON.stringify({ perfil, exp: 9999999999 }))}.s`;
}

async function preencher(login: string, senha: string) {
  await fireEvent.changeText(screen.getByLabelText('Login'), login);
  await fireEvent.changeText(screen.getByLabelText('Senha'), senha);
}

async function entrar() {
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await encerrarSessao();
});

it('com sessão ativa vai direto para o início', async () => {
  iniciarSessao(jwt('GESTANTE'));
  await render(<LoginScreen />);

  expect(screen.getByText('Redirecionou para /inicio')).toBeTruthy();
});

it.each([
  ['', 'segredo1'],
  ['   ', 'segredo1'],
  ['maria', ''],
])('login %p e senha %p pedem os dois campos sem chamar a API', async (login, senha) => {
  await render(<LoginScreen />);
  await preencher(login, senha);
  await entrar();

  expect(screen.getByText('Informe o login e a senha.')).toBeTruthy();
  expect(mockPost).not.toHaveBeenCalled();
});

it.each([
  [{ primeiroAcesso: true, tutorialPendente: true }, '/primeiro-acesso'],
  [{ primeiroAcesso: false, tutorialPendente: true }, '/tutorial'],
  [{ primeiroAcesso: false, tutorialPendente: false }, '/inicio'],
])('gestante %p segue para %p', async (situacao, destino) => {
  const token = jwt('GESTANTE');
  mockPost.mockResolvedValue({ token, ...situacao });
  await render(<LoginScreen />);
  await preencher('  maria  ', 'segredo1');
  await entrar();

  expect(mockPost).toHaveBeenCalledWith('/auth/login', { login: 'maria', senha: 'segredo1' });
  expect(obterToken()).toBe(token);
  expect(router.replace).toHaveBeenCalledWith(destino);
});

it('enviar pelo teclado no campo de senha também entra', async () => {
  mockPost.mockResolvedValue({ token: jwt('GESTANTE'), primeiroAcesso: false, tutorialPendente: false });
  await render(<LoginScreen />);
  await preencher('maria', 'segredo1');
  await fireEvent(screen.getByLabelText('Senha'), 'submitEditing');

  expect(router.replace).toHaveBeenCalledWith('/inicio');
});

it('outro perfil (médico) não entra no app', async () => {
  mockPost.mockResolvedValue({ token: jwt('MEDICO'), primeiroAcesso: false, tutorialPendente: false });
  await render(<LoginScreen />);
  await preencher('dr.joao', 'segredo1');
  await entrar();

  expect(screen.getByText('Acesso permitido apenas para gestantes.')).toBeTruthy();
  expect(obterToken()).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
});

it('401 diz que login ou senha estão errados', async () => {
  mockPost.mockRejectedValue(new ApiError(401, 'Credenciais inválidas'));
  await render(<LoginScreen />);
  await preencher('maria', 'errada');
  await entrar();

  expect(screen.getByText('Login ou senha inválidos.')).toBeTruthy();
});

it.each([new ApiError(500), new TypeError('Network request failed')])(
  'outros erros (%p) pedem para verificar a conexão',
  async (erro) => {
    mockPost.mockRejectedValue(erro);
    await render(<LoginScreen />);
    await preencher('maria', 'segredo1');
    await entrar();

    expect(screen.getByText(/Verifique sua conexão/)).toBeTruthy();
  },
);

it('nova tentativa limpa o erro anterior e durante o envio o botão fica desabilitado', async () => {
  mockPost.mockRejectedValueOnce(new ApiError(401));
  let responder: (valor: unknown) => void = () => {};
  mockPost.mockReturnValueOnce(new Promise((resolve) => (responder = resolve)));
  await render(<LoginScreen />);
  await preencher('maria', 'segredo1');
  await entrar();
  expect(screen.getByText('Login ou senha inválidos.')).toBeTruthy();

  // O toque só termina com a resposta: não espera aqui para ver o estado intermediário
  const toque = fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByText('Login ou senha inválidos.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled();

  await act(async () => responder({ token: jwt('GESTANTE'), primeiroAcesso: false, tutorialPendente: false }));
  await toque;
  expect(router.replace).toHaveBeenCalledWith('/inicio');
});
