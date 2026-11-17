/// <reference types="jest" />

import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import CuponsScreen from '@/app/(abas)/cupons';
import { get } from '@/lib/api';
import type { OfertaEmpresa, ProdutoOfertaResumo } from '@/lib/ofertas';

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

// Fora de um navegador, a aba "ganha foco" ao montar (e de novo se o efeito mudar)
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]),
  };
});

const mockGet = get as jest.Mock;
const mockPush = router.push as jest.Mock;

function produto(id: number): ProdutoOfertaResumo {
  return {
    id,
    nome: `Produto ${id}`,
    categoria: 'FRALDAS',
    imagem: null,
    menorPontos: 100,
    maiorDescontoCupom: 10,
    descontoPromocao: null,
  };
}

function empresa(id: number, totalProdutos = 1): OfertaEmpresa {
  return { id, nome: `Empresa ${id}`, segmento: null, logo: null, totalProdutos, produtos: [produto(id * 100)] };
}

function pagina(itens: OfertaEmpresa[], total = itens.length) {
  return { itens, pagina: 0, tamanho: 10, total, totalPaginas: Math.ceil(total / 10) };
}

const empresas = (inicio: number, quantidade: number) =>
  Array.from({ length: quantidade }, (_, i) => empresa(inicio + i));

// Responde o saldo e, para as ofertas, o que "ofertas" devolver para o caminho pedido
function comApi(ofertas: (caminho: string) => unknown, saldo: number | Error = 150) {
  mockGet.mockImplementation((caminho: string) => {
    if (caminho === '/gestantes/pontuacao') {
      return saldo instanceof Error ? Promise.reject(saldo) : Promise.resolve({ saldo, atividades: [] });
    }
    const resposta = ofertas(caminho);
    return resposta instanceof Error ? Promise.reject(resposta) : Promise.resolve(resposta);
  });
}

const chamadasOfertas = () =>
  mockGet.mock.calls.map(([caminho]) => caminho as string).filter((caminho) => caminho.startsWith('/ofertas'));

// O ScrollView por baixo da FlatList: é nele que a rolagem e o puxar para recarregar acontecem
const lista = () => screen.getByTestId('lista');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('carregamento', () => {
  it('mostra as abas com a Loja ativa e troca para os resgatados sem empilhar', async () => {
    comApi(() => pagina([empresa(1)]));
    await render(<CuponsScreen />);
    await screen.findByText('Empresa 1');

    expect(screen.getByRole('tab', { name: 'Loja Cupons' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Cupons resgatados' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Cupons resgatados' }));
    expect(router.replace).toHaveBeenCalledWith('/cupons/resgatados');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('mostra o saldo e as empresas com os produtos', async () => {
    comApi(() => pagina([empresa(1), empresa(2)]));
    await render(<CuponsScreen />);

    expect(await screen.findByText('Empresa 1')).toBeTruthy();
    expect(screen.getByText('Empresa 2')).toBeTruthy();
    expect(screen.getByText('Produto 100')).toBeTruthy();
    expect(screen.getByLabelText('Seu saldo: 150 pontos')).toBeTruthy();
    expect(chamadasOfertas()).toEqual(['/ofertas?pagina=0&tamanho=10']);
  });

  it('enquanto carrega mostra o aviso', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    await render(<CuponsScreen />);

    expect(screen.getByText('Carregando…')).toBeTruthy();
    expect(screen.queryByText(/Nenhuma oferta/)).toBeNull();
  });

  it('sem ofertas mostra a mensagem de lista vazia, sem "Limpar filtros"', async () => {
    comApi(() => pagina([]));
    await render(<CuponsScreen />);

    expect(await screen.findByText(/Nenhuma oferta disponível no momento/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
  });

  it('erro ao carregar mostra o alerta e tentar de novo busca outra vez', async () => {
    let falhar = true;
    comApi(() => (falhar ? new Error('sem rede') : pagina([empresa(1)])));
    await render(<CuponsScreen />);

    expect(await screen.findByText(/Não foi possível carregar as ofertas/)).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();

    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Empresa 1')).toBeTruthy();
    expect(screen.queryByText(/Não foi possível carregar as ofertas/)).toBeNull();
  });

  it('sem o saldo a lista aparece mesmo assim', async () => {
    comApi(() => pagina([empresa(1)]), new Error('sem rede'));
    await render(<CuponsScreen />);

    expect(await screen.findByText('Empresa 1')).toBeTruthy();
    expect(screen.queryByText('Seu saldo')).toBeNull();
  });
});

describe('rolagem infinita', () => {
  it('no fim da lista busca a próxima página, uma vez só, com o indicador no rodapé', async () => {
    let responderSegunda: (valor: unknown) => void = () => {};
    mockGet.mockImplementation((caminho: string) => {
      if (caminho === '/gestantes/pontuacao') {
        return Promise.resolve({ saldo: 0 });
      }
      if (caminho.includes('pagina=1')) {
        return new Promise((resolve) => (responderSegunda = resolve));
      }
      return Promise.resolve(pagina(empresas(1, 10), 12));
    });
    await render(<CuponsScreen />);
    await screen.findByText('Empresa 1');

    await fireEvent(lista(), 'endReached');
    await fireEvent(lista(), 'endReached');

    expect(chamadasOfertas()).toEqual(['/ofertas?pagina=0&tamanho=10', '/ofertas?pagina=1&tamanho=10']);
    expect(screen.getByLabelText('Carregando mais')).toBeTruthy();

    await act(async () => responderSegunda(pagina(empresas(11, 2), 12)));
    expect(screen.queryByLabelText('Carregando mais')).toBeNull();

    // Tudo carregado: o fim da lista não busca mais nada
    await fireEvent(lista(), 'endReached');
    expect(chamadasOfertas()).toHaveLength(2);
  });

  it('erro na próxima página aparece no rodapé, com a lista mantida, e dá para tentar de novo', async () => {
    let falhar = true;
    comApi((caminho) => {
      if (caminho.includes('pagina=1')) {
        return falhar ? new Error('sem rede') : pagina(empresas(11, 1), 11);
      }
      return pagina(empresas(1, 10), 11);
    });
    await render(<CuponsScreen />);
    await screen.findByText('Empresa 1');

    await fireEvent(lista(), 'endReached');
    expect(await screen.findByText(/Não foi possível carregar as ofertas/)).toBeTruthy();
    expect(screen.getByText('Empresa 1')).toBeTruthy();

    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(chamadasOfertas()).toEqual([
      '/ofertas?pagina=0&tamanho=10',
      '/ofertas?pagina=1&tamanho=10',
      '/ofertas?pagina=1&tamanho=10',
    ]);
    expect(screen.queryByText(/Não foi possível carregar as ofertas/)).toBeNull();
  });

  it('puxar para recarregar volta para a primeira página e atualiza o saldo', async () => {
    let saldo = 150;
    mockGet.mockImplementation((caminho: string) =>
      Promise.resolve(caminho === '/gestantes/pontuacao' ? { saldo } : pagina([empresa(1)])),
    );
    await render(<CuponsScreen />);
    await screen.findByText('Empresa 1');

    saldo = 40;
    await userEvent.setup().pullToRefresh(lista());

    expect(await screen.findByLabelText('Seu saldo: 40 pontos')).toBeTruthy();
    expect(chamadasOfertas()).toEqual(['/ofertas?pagina=0&tamanho=10', '/ofertas?pagina=0&tamanho=10']);
  });
});

describe('filtros', () => {
  it('categoria, tipo e "Cabe no meu saldo" vão como parâmetros para a API', async () => {
    comApi(() => pagina([empresa(1)]));
    await render(<CuponsScreen />);
    await screen.findByText('Empresa 1');

    await fireEvent.press(screen.getByRole('radio', { name: 'Roupas' }));
    expect(chamadasOfertas().at(-1)).toBe('/ofertas?categoria=ROUPAS&pagina=0&tamanho=10');

    await fireEvent.press(screen.getByRole('radio', { name: 'Promoção' }));
    expect(chamadasOfertas().at(-1)).toBe('/ofertas?categoria=ROUPAS&tipo=PROMOCAO&pagina=0&tamanho=10');

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Cabe no meu saldo' }));
    expect(screen.getByRole('checkbox', { name: 'Cabe no meu saldo' })).toBeChecked();
    expect(chamadasOfertas().at(-1)).toBe(
      '/ofertas?categoria=ROUPAS&tipo=PROMOCAO&ateMeusPontos=true&pagina=0&tamanho=10',
    );

    // Tocar de novo desmarca
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Cabe no meu saldo' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Roupas' }));
    expect(chamadasOfertas().at(-1)).toBe('/ofertas?tipo=PROMOCAO&pagina=0&tamanho=10');
    // O status é só dos resgatados
    expect(screen.queryByRole('radiogroup', { name: 'Status' })).toBeNull();
    expect(chamadasOfertas().join(' ')).not.toContain('status=');
  });

  describe('busca', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('espera parar de digitar para buscar, uma vez só', async () => {
      comApi(() => pagina([empresa(1)]));
      await render(<CuponsScreen />);
      await act(async () => {});
      const campo = screen.getByLabelText('Buscar');

      await fireEvent.changeText(campo, 'fr');
      await act(async () => jest.advanceTimersByTime(200));
      await fireEvent.changeText(campo, 'fralda ');
      await act(async () => jest.advanceTimersByTime(399));
      expect(chamadasOfertas()).toHaveLength(1);

      await act(async () => jest.advanceTimersByTime(1));
      expect(chamadasOfertas()).toEqual([
        '/ofertas?pagina=0&tamanho=10',
        '/ofertas?busca=fralda&pagina=0&tamanho=10',
      ]);
    });

    it('sem resultado com filtros oferece limpar, e limpar volta para a lista completa', async () => {
      comApi((caminho) => (caminho.includes('busca=') ? pagina([]) : pagina([empresa(1)])));
      await render(<CuponsScreen />);
      await act(async () => {});

      await fireEvent.changeText(screen.getByLabelText('Buscar'), 'xyz');
      await act(async () => jest.advanceTimersByTime(400));

      expect(screen.getByText('Nenhuma oferta encontrada com esses filtros.')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }));
      await act(async () => jest.advanceTimersByTime(400));

      expect(screen.getByLabelText('Buscar')).toHaveDisplayValue('');
      expect(screen.getByText('Empresa 1')).toBeTruthy();
      expect(chamadasOfertas().at(-1)).toBe('/ofertas?pagina=0&tamanho=10');
    });
  });
});

describe('navegação', () => {
  it('tocar num produto abre o detalhe dele', async () => {
    comApi(() => pagina([empresa(1)]));
    await render(<CuponsScreen />);

    await fireEvent.press(await screen.findByText('Produto 100'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/cupons/produto/[id]', params: { id: '100' } });
  });

  it('"Ver todos" abre a empresa levando o nome e os filtros ativos', async () => {
    comApi(() => pagina([empresa(1, 14)]));
    await render(<CuponsScreen />);
    await screen.findByText('Empresa 1');
    await fireEvent.press(screen.getByRole('radio', { name: 'Fraldas' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Cabe no meu saldo' }));

    await fireEvent.press(await screen.findByRole('button', { name: /^Ver todos/ }));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/cupons/empresa/[id]',
      params: { id: '1', nome: 'Empresa 1', categoria: 'FRALDAS', ateMeusPontos: 'true' },
    });
  });
});
