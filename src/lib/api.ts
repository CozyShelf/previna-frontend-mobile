import { router } from 'expo-router';

import { API_URL } from '@/constants/api';
import { encerrarSessao, obterToken } from '@/lib/sessao';

export class ApiError extends Error {
  constructor(
    public status: number,
    public mensagem?: string,
  ) {
    super(`Erro ${status} na requisição`);
  }
}

async function requisicao<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = obterToken();
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (resposta.status === 401 && token) {
    void encerrarSessao();
    router.replace('/');
  }
  const corpo = await resposta.text();
  const json = corpo ? JSON.parse(corpo) : undefined;
  if (!resposta.ok) {
    throw new ApiError(resposta.status, json?.message);
  }
  return json;
}

export function post<T>(caminho: string, corpo: unknown) {
  return requisicao<T>(caminho, { method: 'POST', body: JSON.stringify(corpo) });
}

export function put<T>(caminho: string, corpo: unknown) {
  return requisicao<T>(caminho, { method: 'PUT', body: JSON.stringify(corpo) });
}
