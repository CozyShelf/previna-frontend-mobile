import { router } from 'expo-router';

import { API_URL } from '@/constants/api';
import { encerrarSessao, obterToken } from '@/lib/sessao';

// Resposta das listagens paginadas (PaginaResponse no backend); pagina começa em 0
export interface Pagina<T> {
  itens: T[];
  pagina: number;
  tamanho: number;
  total: number;
  totalPaginas: number;
}

// Códigos que a API manda no corpo de alguns erros ({ "message": "...", "codigo": "..." }). O app decide pelo código,
// nunca pelo texto da mensagem, que pode mudar no backend.
export type CodigoErroApi =
  | 'PROMOCAO_JA_RESGATADA'
  | 'PROMOCAO_INDISPONIVEL'
  | 'PROMOCAO_SOBREPOSTA'
  | 'CUPOM_INDISPONIVEL'
  | 'PONTOS_INSUFICIENTES'
  | 'AGENDAMENTO_PENDENTE_REPETIDO';

export class ApiError extends Error {
  constructor(
    public status: number,
    public mensagem?: string,
    // Código conhecido ou outro que o backend venha a criar: `string & {}` mantém o autocompletar dos conhecidos
    public codigo?: CodigoErroApi | (string & {}),
  ) {
    super(`Erro ${status} na requisição`);
  }
}

// Corpo de erro lido de forma tolerante: sem corpo, corpo que não é JSON (ex.: página de erro do proxy) ou campos
// de outro tipo deixam mensagem e código indefinidos
function erroDaResposta(status: number, corpo: string) {
  let json: unknown;
  try {
    json = corpo ? JSON.parse(corpo) : undefined;
  } catch {
    json = undefined;
  }
  const campos = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : undefined);
  return new ApiError(status, texto(campos.message), texto(campos.codigo));
}

type Cabecalhos = Record<string, string>;

async function requisicao<T>(caminho: string, init: RequestInit = {}, cabecalhos: Cabecalhos = {}): Promise<T> {
  const token = obterToken();
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...init,
    headers: {
      // FormData (upload) leva o próprio Content-Type, com o separador do multipart
      ...(!(init.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...cabecalhos,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (resposta.status === 401 && token) {
    void encerrarSessao();
    router.replace('/');
  }
  const corpo = await resposta.text();
  if (!resposta.ok) {
    throw erroDaResposta(resposta.status, corpo);
  }
  return corpo ? JSON.parse(corpo) : (undefined as T);
}

export function get<T>(caminho: string) {
  return requisicao<T>(caminho);
}

// cabecalhos: extras da chamada, como o Idempotency-Key do resgate
export function post<T>(caminho: string, corpo: unknown, cabecalhos?: Cabecalhos) {
  return requisicao<T>(caminho, { method: 'POST', body: JSON.stringify(corpo) }, cabecalhos);
}

export function put<T>(caminho: string, corpo: unknown) {
  const body = corpo instanceof FormData ? corpo : JSON.stringify(corpo);
  return requisicao<T>(caminho, { method: 'PUT', body });
}

// Imagem protegida da API (ex.: foto da gestante): o expo-image envia o token no cabeçalho
export function imagemDaApi(caminho: string) {
  const token = obterToken();
  return {
    uri: `${API_URL}${caminho}`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}
