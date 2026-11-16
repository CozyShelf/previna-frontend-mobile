/// <reference types="jest" />

import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import EmpresaScreen from '@/app/(abas)/cupons/empresa/[id]';
import { ApiError, get } from '@/lib/api';
import type { ProdutoOfertaResumo } from '@/lib/ofertas';

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(codigo: number) {
      super(`Erro ${codigo}`);
      this.status = codigo;
    }
  }
  return { ApiError, get: jest.fn(), imagemDaApi: (caminho: string) => ({ uri: caminho }) };
});

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: jest.fn(),
    useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]),
  };
});

const mockGet = get as jest.Mock;
const mockParametros = useLocalSearchParams as jest.Mock;

function produto(id: number): ProdutoOfertaResumo {
  return {
    id,
    nome: `Produto ${id}`,
    categoria: 'ROUPAS',
    imagem: null,
    menorPontos: null,
    maiorDescontoCupom: null,
    descontoPromocao: 20,
  };
}

const produtos = (inicio: number, quantidade: number) =>
  Array.from({ length: quantidade }, (_, i) => produto(inicio + i));

const pagina = (itens: ProdutoOfertaResumo[], total = itens.length) => ({
  itens,
  pagina: 0,
  tamanho: 10,
  total,
  totalPaginas: Math.ceil(total / 10),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParametros.mockReturnValue({ id: '7', nome: 'Loja Bebê' });
});

it('mostra os produtos da empresa em linhas de dois, com o nome dela no título', async () => {
  mockGet.mockResolvedValue(pagina(produtos(1, 3)));
  await render(<EmpresaScreen />);

  expect(await screen.findByText('Produto 1')).toBeTruthy();
  expect(screen.getByText('Produto 3')).toBeTruthy();
  expect(screen.getAllByText('Promoção 20%')).toHaveLength(3);
  expect(screen.getByRole('header', { name: 'Loja Bebê' })).toBeTruthy();
  expect(mockGet).toHaveBeenCalledWith('/ofertas/empresas/7/produtos?pagina=0&tamanho=10');
  expect(screen.queryByText(/Filtros:/)).toBeNull();
});

it('sem o nome nos parâmetros usa um título genérico', async () => {
  mockParametros.mockReturnValue({ id: '7' });
  mockGet.mockReturnValue(new Promise(() => {}));
  await render(<EmpresaScreen />);

  expect(screen.getByRole('header', { name: 'Produtos da empresa' })).toBeTruthy();
  expect(screen.getByText('Carregando…')).toBeTruthy();
});

it('aplica os filtros que vieram da lista e permite ver sem eles', async () => {
  mockParametros.mockReturnValue({ id: '7', nome: 'Loja Bebê', categoria: 'ROUPAS', ateMeusPontos: 'true' });
  mockGet.mockResolvedValue(pagina(produtos(1, 1)));
  await render(<EmpresaScreen />);

  expect(await screen.findByText('Filtros: Roupas · Cabe no meu saldo')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledWith(
    '/ofertas/empresas/7/produtos?categoria=ROUPAS&ateMeusPontos=true&pagina=0&tamanho=10',
  );

  await fireEvent.press(screen.getByRole('button', { name: 'Ver sem filtros' }));
  expect(mockGet).toHaveBeenLastCalledWith('/ofertas/empresas/7/produtos?pagina=0&tamanho=10');
  expect(screen.queryByText(/Filtros:/)).toBeNull();
});

it('rolagem infinita: o fim da lista busca a próxima página', async () => {
  mockGet
    .mockResolvedValueOnce(pagina(produtos(1, 10), 14))
    .mockResolvedValueOnce(pagina(produtos(11, 4), 14));
  await render(<EmpresaScreen />);
  await screen.findByText('Produto 1');

  await fireEvent(screen.getByTestId('lista'), 'endReached');

  expect(mockGet).toHaveBeenLastCalledWith('/ofertas/empresas/7/produtos?pagina=1&tamanho=10');
  expect(await screen.findByText('Produto 14')).toBeTruthy();
});

it('tocar num produto abre o detalhe dele', async () => {
  mockGet.mockResolvedValue(pagina(produtos(1, 2)));
  await render(<EmpresaScreen />);

  await fireEvent.press(await screen.findByText('Produto 2'));

  expect(router.push).toHaveBeenCalledWith({ pathname: '/cupons/produto/[id]', params: { id: '2' } });
});

it('empresa sem ofertas (página vazia) avisa', async () => {
  mockGet.mockResolvedValue(pagina([]));
  await render(<EmpresaScreen />);

  expect(await screen.findByText('Esta empresa não tem ofertas no momento.')).toBeTruthy();
});

it('sem produtos com os filtros avisa que é por causa deles', async () => {
  mockParametros.mockReturnValue({ id: '7', tipo: 'CUPOM' });
  mockGet.mockResolvedValue(pagina([]));
  await render(<EmpresaScreen />);

  expect(await screen.findByText('Nenhum produto desta empresa com esses filtros.')).toBeTruthy();
});

it('empresa inexistente (404) diz que não está mais disponível', async () => {
  mockGet.mockRejectedValue(new ApiError(404));
  await render(<EmpresaScreen />);

  expect(await screen.findByText('Esta empresa não está mais disponível.')).toBeTruthy();
});

it('falha de rede pede para verificar a conexão', async () => {
  mockGet.mockRejectedValue(new Error('sem rede'));
  await render(<EmpresaScreen />);

  expect(await screen.findByText(/Verifique sua conexão/)).toBeTruthy();
});

it('id fora do formato não chega a buscar', async () => {
  mockParametros.mockReturnValue({ id: '../perfil' });
  await render(<EmpresaScreen />);

  expect(screen.getByText('Esta empresa não está mais disponível.')).toBeTruthy();
  expect(mockGet).not.toHaveBeenCalled();
});

it('puxar para recarregar busca a primeira página de novo', async () => {
  mockGet.mockResolvedValue(pagina(produtos(1, 1)));
  await render(<EmpresaScreen />);
  await screen.findByText('Produto 1');

  await userEvent.setup().pullToRefresh(screen.getByTestId('lista'));

  expect(mockGet).toHaveBeenCalledTimes(2);
});

it('voltar volta para a lista', async () => {
  mockGet.mockResolvedValue(pagina([]));
  await render(<EmpresaScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Voltar' }));

  expect(router.back).toHaveBeenCalled();
});
