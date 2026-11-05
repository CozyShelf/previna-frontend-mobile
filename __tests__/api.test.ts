/// <reference types="jest" />

import { router } from 'expo-router';

import { API_URL } from '@/constants/api';
import { ApiError, get, imagemDaApi, post, put } from '@/lib/api';
import { encerrarSessao, obterToken } from '@/lib/sessao';

jest.mock('@/lib/sessao', () => ({
  obterToken: jest.fn(),
  encerrarSessao: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockObterToken = obterToken as jest.Mock;
const mockFetch = jest.fn();

// Resposta mínima do fetch: a api só usa status, ok e text()
function resposta(status: number, corpo = '') {
  return { status, ok: status >= 200 && status < 300, text: () => Promise.resolve(corpo) };
}

function cabecalhosEnviados(): Record<string, string> {
  return mockFetch.mock.calls[0][1].headers;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockObterToken.mockReturnValue(null);
  mockFetch.mockResolvedValue(resposta(200, '{}'));
  globalThis.fetch = mockFetch;
});

describe('cabeçalhos', () => {
  it('sem sessão não manda Authorization', async () => {
    await get('/cupons/disponiveis');

    expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/cupons/disponiveis`, expect.any(Object));
    expect(cabecalhosEnviados()).toEqual({ 'Content-Type': 'application/json' });
  });

  it('com sessão manda o token como Bearer', async () => {
    mockObterToken.mockReturnValue('abc.def.ghi');
    await get('/gestantes/perfil');

    expect(cabecalhosEnviados()).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer abc.def.ghi',
    });
  });

  it('post manda o corpo em JSON', async () => {
    await post('/auth/login', { login: 'maria', senha: 'segredo1' });

    const init = mockFetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"login":"maria","senha":"segredo1"}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('put com objeto manda JSON', async () => {
    await put('/gestantes/tutorial-concluido', {});

    const init = mockFetch.mock.calls[0][1];
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('put com FormData manda o FormData sem Content-Type (o multipart define o próprio)', async () => {
    mockObterToken.mockReturnValue('tok');
    const dados = new FormData();
    dados.append('telefone', '11987654321');
    await put('/gestantes/perfil', dados);

    const init = mockFetch.mock.calls[0][1];
    expect(init.body).toBe(dados);
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
  });
});

describe('respostas', () => {
  it('devolve o JSON da resposta', async () => {
    mockFetch.mockResolvedValue(resposta(200, '{"saldo":150}'));

    await expect(get('/gestantes/pontuacao')).resolves.toEqual({ saldo: 150 });
  });

  it('corpo vazio vira undefined', async () => {
    mockFetch.mockResolvedValue(resposta(204));

    await expect(put('/gestantes/tutorial-concluido', {})).resolves.toBeUndefined();
  });

  it('erro carrega o status e a mensagem da API', async () => {
    mockFetch.mockResolvedValue(resposta(409, '{"message":"Pontos insuficientes"}'));

    const erro = await post('/cupons/5/resgatar', {}).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({ status: 409, mensagem: 'Pontos insuficientes' });
    expect((erro as ApiError).message).toBe('Erro 409 na requisição');
  });

  it('erro sem corpo fica sem mensagem', async () => {
    mockFetch.mockResolvedValue(resposta(500));

    await expect(get('/qualquer')).rejects.toMatchObject({ status: 500, mensagem: undefined });
  });

  it('falha de rede é repassada como está', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    await expect(get('/qualquer')).rejects.toThrow('Network request failed');
  });
});

describe('sessão expirada', () => {
  it('401 com token encerra a sessão e volta para o login', async () => {
    mockObterToken.mockReturnValue('vencido');
    mockFetch.mockResolvedValue(resposta(401, '{"message":"Token expirado"}'));

    await expect(get('/gestantes/perfil')).rejects.toMatchObject({ status: 401 });
    expect(encerrarSessao).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('401 sem token (login errado) não mexe na sessão nem navega', async () => {
    mockFetch.mockResolvedValue(resposta(401, '{"message":"Credenciais inválidas"}'));

    await expect(post('/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(encerrarSessao).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('403 com token não encerra a sessão', async () => {
    mockObterToken.mockReturnValue('tok');
    mockFetch.mockResolvedValue(resposta(403));

    await expect(get('/gestantes/perfil')).rejects.toMatchObject({ status: 403 });
    expect(encerrarSessao).not.toHaveBeenCalled();
  });
});

describe('imagemDaApi', () => {
  it('com sessão leva o token no cabeçalho', () => {
    mockObterToken.mockReturnValue('tok');

    expect(imagemDaApi('/gestantes/foto?v=0')).toEqual({
      uri: `${API_URL}/gestantes/foto?v=0`,
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('sem sessão não tem cabeçalhos', () => {
    expect(imagemDaApi('/empresas/1/logo')).toEqual({
      uri: `${API_URL}/empresas/1/logo`,
      headers: undefined,
    });
  });
});

describe('API_URL', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = original;
  });

  it('usa a variável de ambiente quando definida', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://exemplo.test/api';
    jest.isolateModules(() => {
      expect(require('@/constants/api').API_URL).toBe('http://exemplo.test/api');
    });
  });

  it('sem a variável cai no backend local', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    jest.isolateModules(() => {
      expect(require('@/constants/api').API_URL).toBe('http://localhost/backend');
    });
  });
});
