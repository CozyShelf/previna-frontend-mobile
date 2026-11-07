/// <reference types="jest" />

import * as SecureStore from 'expo-secure-store';

import {
  encerrarSessao,
  iniciarSessao,
  lembrarSessao,
  obterToken,
  perfilDoToken,
  restaurarSessao,
} from '@/lib/sessao';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

const mockSet = SecureStore.setItemAsync as jest.Mock;
const mockGet = SecureStore.getItemAsync as jest.Mock;
const mockDelete = SecureStore.deleteItemAsync as jest.Mock;

// JWT com o payload em base64url, como o backend gera (sem assinatura verificada no app)
function jwt(payload: object) {
  const base64url = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `cabecalho.${base64url}.assinatura`;
}

const daquiUmaHora = () => Math.floor(Date.now() / 1000) + 3600;

beforeEach(async () => {
  await encerrarSessao();
  jest.clearAllMocks();
});

describe('perfilDoToken', () => {
  it('lê o perfil do payload', () => {
    expect(perfilDoToken(jwt({ perfil: 'GESTANTE', exp: daquiUmaHora() }))).toBe('GESTANTE');
  });

  it('entende base64url (com - e _ no lugar de + e /)', () => {
    // "~~~" e "???" geram "+" e "/" em base64, que viram "-" e "_" em base64url
    const token = jwt({ perfil: 'MEDICO', x: '~~~???>>>' });
    expect(token.split('.')[1]).toMatch(/[-_]/);

    expect(perfilDoToken(token)).toBe('MEDICO');
  });
});

describe('sessão em memória', () => {
  it('iniciarSessao guarda o token só em memória', () => {
    iniciarSessao('novo');

    expect(obterToken()).toBe('novo');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('lembrarSessao grava o token atual no aparelho', async () => {
    iniciarSessao('novo');
    await lembrarSessao();

    expect(mockSet).toHaveBeenCalledWith('previna.token', 'novo');
  });

  it('lembrarSessao sem sessão não grava nada', async () => {
    await lembrarSessao();

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('falha ao gravar não derruba o app', async () => {
    mockSet.mockRejectedValueOnce(new Error('keychain indisponível'));
    iniciarSessao('novo');

    await expect(lembrarSessao()).resolves.toBeUndefined();
  });

  it('encerrarSessao limpa a memória e o aparelho', async () => {
    iniciarSessao('novo');
    await encerrarSessao();

    expect(obterToken()).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith('previna.token');
  });

  it('falha ao apagar do aparelho ainda encerra a sessão', async () => {
    mockDelete.mockRejectedValueOnce(new Error('falhou'));
    iniciarSessao('novo');

    await expect(encerrarSessao()).resolves.toBeUndefined();
    expect(obterToken()).toBeNull();
  });
});

describe('restaurarSessao', () => {
  it('token salvo e válido volta para a memória', async () => {
    const salvo = jwt({ perfil: 'GESTANTE', exp: daquiUmaHora() });
    mockGet.mockResolvedValueOnce(salvo);
    await restaurarSessao();

    expect(mockGet).toHaveBeenCalledWith('previna.token');
    expect(obterToken()).toBe(salvo);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('token expirado é apagado', async () => {
    mockGet.mockResolvedValueOnce(jwt({ perfil: 'GESTANTE', exp: Math.floor(Date.now() / 1000) - 1 }));
    await restaurarSessao();

    expect(obterToken()).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith('previna.token');
  });

  it('token ilegível é tratado como expirado', async () => {
    mockGet.mockResolvedValueOnce('lixo');
    await restaurarSessao();

    expect(obterToken()).toBeNull();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('sem token salvo não faz nada', async () => {
    await restaurarSessao();

    expect(obterToken()).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('falha ao ler o aparelho segue sem sessão', async () => {
    mockGet.mockRejectedValueOnce(new Error('keychain indisponível'));

    await expect(restaurarSessao()).resolves.toBeUndefined();
    expect(obterToken()).toBeNull();
  });
});
