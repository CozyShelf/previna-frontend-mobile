/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react-native';

import { ApiError, get } from '@/lib/api';
import { usePaginacao } from '@/lib/paginacao';

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
  return { ApiError, get: jest.fn() };
});

const mockGet = get as jest.Mock;

const ERRO = 'Falhou.';
const SUMIU = 'Não existe mais.';

// Itens numerados a partir de "inicio", na página que a API devolveria
function pagina(inicio: number, quantidade: number, total: number) {
  return {
    itens: Array.from({ length: quantidade }, (_, i) => inicio + i),
    pagina: 0,
    tamanho: 10,
    total,
    totalPaginas: Math.ceil(total / 10),
  };
}

// Promessa que o teste resolve na hora que quiser
function pendente<T>() {
  let resolver: (valor: T) => void = () => {};
  let rejeitar: (erro: unknown) => void = () => {};
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

async function montar(caminho = '/ofertas', naoEncontrado?: string) {
  return await renderHook(
    ({ c }: { c: string }) => usePaginacao<number>(c, ERRO, naoEncontrado),
    { initialProps: { c: caminho } },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('nada é buscado até a tela pedir', async () => {
  const { result } = await montar();

  expect(mockGet).not.toHaveBeenCalled();
  expect(result.current.itens).toBeUndefined();
});

it('busca a primeira página com 10 itens, acrescentando a paginação à query string', async () => {
  mockGet.mockResolvedValue(pagina(0, 10, 25));
  const { result } = await montar('/ofertas?busca=fralda');

  await act(async () => result.current.atualizar());

  expect(mockGet).toHaveBeenCalledWith('/ofertas?busca=fralda&pagina=0&tamanho=10');
  expect(result.current.itens).toHaveLength(10);
  expect(result.current.erro).toBeUndefined();
});

it('carregarMais busca a próxima página e junta à lista, até o fim', async () => {
  mockGet
    .mockResolvedValueOnce(pagina(0, 10, 25))
    .mockResolvedValueOnce(pagina(10, 10, 25))
    .mockResolvedValueOnce(pagina(20, 5, 25));
  const { result } = await montar();

  await act(async () => result.current.atualizar());
  await act(async () => result.current.carregarMais());
  await act(async () => result.current.carregarMais());

  expect(mockGet).toHaveBeenNthCalledWith(2, '/ofertas?pagina=1&tamanho=10');
  expect(mockGet).toHaveBeenNthCalledWith(3, '/ofertas?pagina=2&tamanho=10');
  expect(result.current.itens).toEqual(Array.from({ length: 25 }, (_, i) => i));

  // Chegou ao total: não pede a página 3
  await act(async () => result.current.carregarMais());
  expect(mockGet).toHaveBeenCalledTimes(3);
});

it('página incompleta encerra a lista mesmo que o total diga que há mais', async () => {
  mockGet.mockResolvedValueOnce(pagina(0, 7, 30));
  const { result } = await montar();

  await act(async () => result.current.atualizar());
  await act(async () => result.current.carregarMais());

  expect(mockGet).toHaveBeenCalledTimes(1);
});

it('não pede mais nada enquanto a primeira página não chega', async () => {
  const primeira = pendente<unknown>();
  mockGet.mockReturnValueOnce(primeira.promessa);
  const { result } = await montar();

  await act(async () => result.current.atualizar());
  await act(async () => result.current.carregarMais());

  expect(mockGet).toHaveBeenCalledTimes(1);
  await act(async () => primeira.resolver(pagina(0, 10, 20)));
});

it('o fim da lista disparando várias vezes seguidas pede a próxima página uma vez só', async () => {
  const segunda = pendente<unknown>();
  mockGet.mockResolvedValueOnce(pagina(0, 10, 30)).mockReturnValueOnce(segunda.promessa);
  const { result } = await montar();
  await act(async () => result.current.atualizar());

  await act(async () => {
    result.current.carregarMais();
    result.current.carregarMais();
    result.current.carregarMais();
  });

  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(result.current.carregandoMais).toBe(true);
  await act(async () => segunda.resolver(pagina(10, 10, 30)));
  expect(result.current.carregandoMais).toBe(false);
  expect(result.current.itens).toHaveLength(20);
});

it('erro na primeira página fica no lugar da lista', async () => {
  mockGet.mockRejectedValue(new Error('sem rede'));
  const { result } = await montar();

  await act(async () => result.current.atualizar());

  expect(result.current.erro).toBe(ERRO);
  expect(result.current.itens).toBeUndefined();
});

it('404 usa a mensagem própria quando a tela dá uma; outros erros, a genérica', async () => {
  mockGet.mockRejectedValueOnce(new ApiError(404)).mockRejectedValueOnce(new ApiError(500));
  const { result } = await montar('/ofertas', SUMIU);

  await act(async () => result.current.atualizar());
  expect(result.current.erro).toBe(SUMIU);

  await act(async () => result.current.recarregar());
  expect(result.current.erro).toBe(ERRO);
});

it('404 sem mensagem própria usa a genérica', async () => {
  mockGet.mockRejectedValue(new ApiError(404));
  const { result } = await montar();

  await act(async () => result.current.atualizar());

  expect(result.current.erro).toBe(ERRO);
});

it('erro ao buscar mais mantém a lista e só tenta de novo quando pedido', async () => {
  mockGet
    .mockResolvedValueOnce(pagina(0, 10, 20))
    .mockRejectedValueOnce(new Error('sem rede'))
    .mockResolvedValueOnce(pagina(10, 10, 20));
  const { result } = await montar();
  await act(async () => result.current.atualizar());

  await act(async () => result.current.carregarMais());
  expect(result.current.erroMais).toBe(ERRO);
  expect(result.current.itens).toHaveLength(10);

  // O fim da lista continua disparando com a rolagem, mas não fica repetindo a requisição que falhou
  await act(async () => result.current.carregarMais());
  expect(mockGet).toHaveBeenCalledTimes(2);

  await act(async () => result.current.tentarMaisDeNovo());
  expect(mockGet).toHaveBeenLastCalledWith('/ofertas?pagina=1&tamanho=10');
  expect(result.current.erroMais).toBeUndefined();
  expect(result.current.itens).toHaveLength(20);
});

it('atualizar com o mesmo caminho busca de uma vez tudo o que já estava na tela', async () => {
  mockGet
    .mockResolvedValueOnce(pagina(0, 10, 25))
    .mockResolvedValueOnce(pagina(10, 10, 25))
    .mockResolvedValueOnce(pagina(20, 5, 25))
    .mockResolvedValueOnce(pagina(0, 24, 24));
  const { result } = await montar();
  await act(async () => result.current.atualizar());
  await act(async () => result.current.carregarMais());
  await act(async () => result.current.carregarMais());

  await act(async () => result.current.atualizar());

  // 25 itens na tela: as três páginas de 10 viram uma de 30
  expect(mockGet).toHaveBeenLastCalledWith('/ofertas?pagina=0&tamanho=30');
  // A lista não some enquanto atualiza, e chega com o que mudou (um item a menos)
  expect(result.current.itens).toHaveLength(24);
});

it('a atualização continua a paginação de onde parou', async () => {
  mockGet
    .mockResolvedValueOnce(pagina(0, 10, 40))
    .mockResolvedValueOnce(pagina(10, 10, 40))
    .mockResolvedValueOnce(pagina(0, 20, 40))
    .mockResolvedValueOnce(pagina(20, 10, 40));
  const { result } = await montar();
  await act(async () => result.current.atualizar());
  await act(async () => result.current.carregarMais());
  await act(async () => result.current.atualizar());

  await act(async () => result.current.carregarMais());

  expect(mockGet).toHaveBeenLastCalledWith('/ofertas?pagina=2&tamanho=10');
  expect(result.current.itens).toHaveLength(30);
});

it('a atualização não passa do limite de 100 itens por página da API', async () => {
  mockGet.mockImplementation((caminho: string) => {
    const numero = Number(/pagina=(\d+)/.exec(caminho)![1]);
    return Promise.resolve(pagina(numero * 10, 10, 500));
  });
  const { result } = await montar();
  await act(async () => result.current.atualizar());
  for (let i = 0; i < 11; i++) {
    await act(async () => result.current.carregarMais());
  }

  await act(async () => result.current.atualizar());

  expect(mockGet).toHaveBeenLastCalledWith('/ofertas?pagina=0&tamanho=100');
});

it('trocar o caminho recomeça a lista e descarta a resposta do caminho anterior', async () => {
  const antiga = pendente<unknown>();
  mockGet.mockReturnValueOnce(antiga.promessa).mockResolvedValueOnce(pagina(100, 3, 3));
  const { result, rerender } = await montar('/ofertas');
  await act(async () => result.current.atualizar());

  await rerender({ c: '/ofertas?tipo=CUPOM' });
  await act(async () => result.current.atualizar());
  expect(mockGet).toHaveBeenLastCalledWith('/ofertas?tipo=CUPOM&pagina=0&tamanho=10');
  expect(result.current.itens).toEqual([100, 101, 102]);

  // A resposta do filtro anterior chega atrasada e é ignorada
  await act(async () => antiga.resolver(pagina(0, 10, 10)));
  expect(result.current.itens).toEqual([100, 101, 102]);
});

it('erro de um caminho anterior que chega atrasado também é ignorado', async () => {
  const antiga = pendente<unknown>();
  mockGet.mockReturnValueOnce(antiga.promessa).mockResolvedValueOnce(pagina(0, 2, 2));
  const { result, rerender } = await montar('/ofertas');
  await act(async () => result.current.atualizar());
  await rerender({ c: '/ofertas?tipo=CUPOM' });
  await act(async () => result.current.atualizar());

  await act(async () => antiga.rejeitar(new Error('sem rede')));

  expect(result.current.erro).toBeUndefined();
  expect(result.current.itens).toEqual([0, 1]);
});

it('trocar o caminho limpa a lista enquanto a nova primeira página não chega', async () => {
  mockGet.mockResolvedValueOnce(pagina(0, 2, 2)).mockReturnValueOnce(new Promise(() => {}));
  const { result, rerender } = await montar('/ofertas');
  await act(async () => result.current.atualizar());

  await rerender({ c: '/ofertas?tipo=PROMOCAO' });
  await act(async () => result.current.atualizar());

  expect(result.current.itens).toBeUndefined();
});

it('recarregar volta para a primeira página e marca o recarregamento até a resposta', async () => {
  const recarga = pendente<unknown>();
  mockGet
    .mockResolvedValueOnce(pagina(0, 10, 30))
    .mockResolvedValueOnce(pagina(10, 10, 30))
    .mockReturnValueOnce(recarga.promessa);
  const { result } = await montar();
  await act(async () => result.current.atualizar());
  await act(async () => result.current.carregarMais());

  await act(async () => result.current.recarregar());
  expect(result.current.recarregando).toBe(true);
  expect(mockGet).toHaveBeenLastCalledWith('/ofertas?pagina=0&tamanho=10');

  await act(async () => recarga.resolver(pagina(0, 10, 30)));
  expect(result.current.recarregando).toBe(false);
  expect(result.current.itens).toHaveLength(10);
});

it('uma página extra que chega depois da recarga é descartada', async () => {
  const mais = pendente<unknown>();
  mockGet
    .mockResolvedValueOnce(pagina(0, 10, 30))
    .mockReturnValueOnce(mais.promessa)
    .mockResolvedValueOnce(pagina(50, 10, 30));
  const { result } = await montar();
  await act(async () => result.current.atualizar());
  await act(async () => result.current.carregarMais());

  await act(async () => result.current.recarregar());
  await act(async () => mais.resolver(pagina(10, 10, 30)));

  expect(result.current.itens).toEqual(Array.from({ length: 10 }, (_, i) => 50 + i));
  expect(result.current.carregandoMais).toBe(false);
});
