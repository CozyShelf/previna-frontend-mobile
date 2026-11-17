/// <reference types="jest" />

import { act, fireEvent, render, screen, userEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import ResgatadosScreen from '@/app/(abas)/cupons/resgatados';
import { get } from '@/lib/api';
import type { Resgate } from '@/lib/resgates';

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(codigo: number) {
      super(`Erro ${codigo}`);
      this.status = codigo;
    }
  }
  return { ApiError, get: jest.fn() };
});

// Fora de um navegador, a tela "ganha foco" ao montar (e de novo se o efeito mudar)
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]),
  };
});

const mockGet = get as jest.Mock;
const mockPush = router.push as jest.Mock;
const mockReplace = router.replace as jest.Mock;

function cupom(id: number, extra: Partial<Resgate> = {}): Resgate {
  return {
    id,
    tipo: 'CUPOM',
    codigo: `COD${id}`,
    titulo: `10% de desconto em Fralda ${id}`,
    empresa: { id: 3, nome: 'Loja X' },
    produto: `Fralda ${id}`,
    categoria: 'FRALDAS',
    desconto: 10,
    dataValidade: '2026-12-31',
    status: 'ATIVO',
    dataResgate: '2026-11-16T12:00:00Z',
    dataUso: null,
    pontosGastos: 120,
    ...extra,
  };
}

const promocao = (id: number, extra: Partial<Resgate> = {}): Resgate =>
  cupom(id, { tipo: 'PROMOCAO', titulo: `Semana do bebê ${id}`, produto: null, pontosGastos: 0, ...extra });

function pagina(itens: Resgate[], total = itens.length) {
  return { itens, pagina: 0, tamanho: 10, total, totalPaginas: Math.ceil(total / 10) };
}

const cupons = (inicio: number, quantidade: number) => Array.from({ length: quantidade }, (_, i) => cupom(inicio + i));

function comApi(resposta: (caminho: string) => unknown) {
  mockGet.mockImplementation((caminho: string) => {
    const r = resposta(caminho);
    return r instanceof Error ? Promise.reject(r) : r instanceof Promise ? r : Promise.resolve(r);
  });
}

const chamadas = () => mockGet.mock.calls.map(([caminho]) => caminho as string);
const lista = () => screen.getByTestId('lista');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('carregamento', () => {
  it('mostra as abas com "Cupons resgatados" ativa', async () => {
    comApi(() => pagina([]));
    await render(<ResgatadosScreen />);

    expect(screen.getByRole('tab', { name: 'Cupons resgatados' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Loja Cupons' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Loja Cupons' }));
    expect(mockReplace).toHaveBeenCalledWith('/cupons');
  });

  it('mostra um cartão por cupom e por promoção, com os selos e a data', async () => {
    comApi(() =>
      pagina([
        cupom(1),
        promocao(2, { status: 'UTILIZADO', dataUso: '2026-11-20T12:00:00Z' }),
        cupom(3, { status: 'EXPIRADO', dataValidade: '2026-11-10' }),
      ]),
    );
    await render(<ResgatadosScreen />);

    expect(await screen.findByLabelText('Cupom: 10% de desconto em Fralda 1, Loja X, Ativo, Válido até 31/12/2026')).toBeTruthy();
    expect(screen.getByLabelText('Promoção: Semana do bebê 2, Loja X, Utilizado, Usado em 20/11/2026')).toBeTruthy();
    expect(screen.getByLabelText('Cupom: 10% de desconto em Fralda 3, Loja X, Expirado, Venceu em 10/11/2026')).toBeTruthy();
    expect(chamadas()).toEqual(['/gestantes/cupons?pagina=0&tamanho=10']);

    const cartao = screen.getByLabelText(/^Promoção: Semana do bebê 2/);
    expect(within(cartao).getByText('Semana do bebê 2')).toBeTruthy();
    expect(within(cartao).getByText('Promoção')).toBeTruthy();
    expect(within(cartao).getByText('Utilizado')).toBeTruthy();
    expect(within(cartao).getByText('Loja X')).toBeTruthy();
    expect(screen.getAllByText('Ativo')).toHaveLength(1);
    expect(screen.getAllByText('Expirado')).toHaveLength(1);
  });

  it('usado sem data de uso não aparece como válido', async () => {
    comApi(() => pagina([cupom(1, { status: 'UTILIZADO' })]));
    await render(<ResgatadosScreen />);

    expect(await screen.findByText('Já usado na loja')).toBeTruthy();
  });

  it('"Ver código" abre o detalhe do resgate', async () => {
    comApi(() => pagina([cupom(1), promocao(12)]));
    await render(<ResgatadosScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ver código: Semana do bebê 12' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/cupons/resgatado/[id]', params: { id: '12' } });
  });

  it('enquanto carrega mostra o aviso', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    await render(<ResgatadosScreen />);

    expect(screen.getByText('Carregando…')).toBeTruthy();
    expect(screen.queryByText(/ainda não resgatou/)).toBeNull();
  });

  it('sem resgates explica como resgatar e leva para a Loja', async () => {
    comApi(() => pagina([]));
    await render(<ResgatadosScreen />);

    expect(await screen.findByText(/Você ainda não resgatou cupons nem promoções/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ir para a Loja Cupons' }));
    expect(mockReplace).toHaveBeenCalledWith('/cupons');
  });

  it('erro ao carregar mostra o alerta e tentar de novo busca outra vez', async () => {
    let falhar = true;
    comApi(() => (falhar ? new Error('sem rede') : pagina([cupom(1)])));
    await render(<ResgatadosScreen />);

    expect(await screen.findByText(/Não foi possível carregar seus cupons resgatados/)).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();

    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('10% de desconto em Fralda 1')).toBeTruthy();
    expect(screen.queryByText(/Não foi possível carregar/)).toBeNull();
  });
});

describe('rolagem e recarga', () => {
  it('no fim da lista busca a próxima página, uma vez só, e para quando acabou', async () => {
    let responderSegunda: (valor: unknown) => void = () => {};
    comApi((caminho) =>
      caminho.includes('pagina=1')
        ? new Promise((resolve) => (responderSegunda = resolve))
        : pagina(cupons(1, 10), 12),
    );
    await render(<ResgatadosScreen />);
    await screen.findByText('10% de desconto em Fralda 1');

    await fireEvent(lista(), 'endReached');
    await fireEvent(lista(), 'endReached');
    expect(screen.getByLabelText('Carregando mais')).toBeTruthy();

    await act(async () => responderSegunda(pagina(cupons(11, 2), 12)));
    expect(screen.queryByLabelText('Carregando mais')).toBeNull();

    // Tudo carregado: o fim da lista não busca mais nada
    await fireEvent(lista(), 'endReached');
    expect(chamadas()).toEqual(['/gestantes/cupons?pagina=0&tamanho=10', '/gestantes/cupons?pagina=1&tamanho=10']);
  });

  it('erro na próxima página fica no rodapé, com a lista mantida', async () => {
    let falhar = true;
    comApi((caminho) => {
      if (caminho.includes('pagina=1')) {
        return falhar ? new Error('sem rede') : pagina(cupons(11, 1), 11);
      }
      return pagina(cupons(1, 10), 11);
    });
    await render(<ResgatadosScreen />);
    await screen.findByText('10% de desconto em Fralda 1');

    await fireEvent(lista(), 'endReached');
    expect(await screen.findByText(/Não foi possível carregar seus cupons resgatados/)).toBeTruthy();
    expect(screen.getByText('10% de desconto em Fralda 1')).toBeTruthy();

    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(chamadas()).toEqual([
      '/gestantes/cupons?pagina=0&tamanho=10',
      '/gestantes/cupons?pagina=1&tamanho=10',
      '/gestantes/cupons?pagina=1&tamanho=10',
    ]);
    expect(screen.queryByText(/Não foi possível carregar/)).toBeNull();
  });

  it('puxar para recarregar busca a primeira página de novo', async () => {
    let status: Resgate['status'] = 'ATIVO';
    comApi(() => pagina([cupom(1, { status })]));
    await render(<ResgatadosScreen />);
    await screen.findByText('Ativo');

    status = 'UTILIZADO';
    await userEvent.setup().pullToRefresh(lista());

    expect(await screen.findByText('Utilizado')).toBeTruthy();
    expect(chamadas()).toEqual(['/gestantes/cupons?pagina=0&tamanho=10', '/gestantes/cupons?pagina=0&tamanho=10']);
  });
});

describe('filtros', () => {
  it('categoria, tipo e status vão como parâmetros, sem o "Cabe no meu saldo"', async () => {
    comApi(() => pagina([cupom(1)]));
    await render(<ResgatadosScreen />);
    await screen.findByText('10% de desconto em Fralda 1');

    expect(screen.queryByRole('checkbox', { name: 'Cabe no meu saldo' })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Remédios' }));
    expect(chamadas().at(-1)).toBe('/gestantes/cupons?categoria=REMEDIOS&pagina=0&tamanho=10');

    await fireEvent.press(screen.getByRole('radio', { name: 'Cupom' }));
    expect(chamadas().at(-1)).toBe('/gestantes/cupons?categoria=REMEDIOS&tipo=CUPOM&pagina=0&tamanho=10');

    await fireEvent.press(screen.getByRole('radio', { name: 'Expirados' }));
    expect(screen.getByRole('radio', { name: 'Expirados' })).toBeChecked();
    expect(chamadas().at(-1)).toBe(
      '/gestantes/cupons?categoria=REMEDIOS&tipo=CUPOM&status=EXPIRADO&pagina=0&tamanho=10',
    );

    // Tocar de novo desmarca
    await fireEvent.press(screen.getByRole('radio', { name: 'Remédios' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Cupom' }));
    expect(chamadas().at(-1)).toBe('/gestantes/cupons?status=EXPIRADO&pagina=0&tamanho=10');
    expect(chamadas().join(' ')).not.toContain('ateMeusPontos');
  });

  it('status sozinho também conta como filtro na lista vazia', async () => {
    comApi((caminho) => (caminho.includes('status=') ? pagina([]) : pagina([cupom(1)])));
    await render(<ResgatadosScreen />);
    await screen.findByText('10% de desconto em Fralda 1');

    await fireEvent.press(screen.getByRole('radio', { name: 'Utilizados' }));

    expect(await screen.findByText('Nenhum cupom resgatado com esses filtros.')).toBeTruthy();
    expect(chamadas().at(-1)).toBe('/gestantes/cupons?status=UTILIZADO&pagina=0&tamanho=10');
  });

  describe('busca', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('espera parar de digitar e vai junto com o status', async () => {
      comApi(() => pagina([cupom(1)]));
      await render(<ResgatadosScreen />);
      await act(async () => {});
      await fireEvent.press(screen.getByRole('radio', { name: 'Ativos' }));
      const campo = screen.getByLabelText('Buscar');

      await fireEvent.changeText(campo, 'fr');
      await act(async () => jest.advanceTimersByTime(200));
      await fireEvent.changeText(campo, 'fralda ');
      await act(async () => jest.advanceTimersByTime(399));
      expect(chamadas()).toHaveLength(2);

      await act(async () => jest.advanceTimersByTime(1));
      expect(chamadas()).toEqual([
        '/gestantes/cupons?pagina=0&tamanho=10',
        '/gestantes/cupons?status=ATIVO&pagina=0&tamanho=10',
        '/gestantes/cupons?busca=fralda&status=ATIVO&pagina=0&tamanho=10',
      ]);
    });

    it('sem resultado oferece limpar, e limpar volta para a lista completa', async () => {
      comApi((caminho) => (caminho.includes('busca=') ? pagina([]) : pagina([cupom(1)])));
      await render(<ResgatadosScreen />);
      await act(async () => {});

      await fireEvent.press(screen.getByRole('radio', { name: 'Promoção' }));
      await fireEvent.changeText(screen.getByLabelText('Buscar'), 'xyz');
      await act(async () => jest.advanceTimersByTime(400));

      expect(screen.getByText('Nenhum cupom resgatado com esses filtros.')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }));
      await act(async () => jest.advanceTimersByTime(400));

      expect(screen.getByLabelText('Buscar')).toHaveDisplayValue('');
      expect(screen.getByRole('radio', { name: 'Promoção' })).not.toBeChecked();
      expect(screen.getByText('10% de desconto em Fralda 1')).toBeTruthy();
      expect(chamadas().at(-1)).toBe('/gestantes/cupons?pagina=0&tamanho=10');
    });
  });
});
