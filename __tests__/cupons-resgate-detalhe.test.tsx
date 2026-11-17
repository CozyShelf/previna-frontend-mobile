/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';

import ResgateScreen from '@/app/(abas)/cupons/resgatado/[id]';
import { ApiError, get } from '@/lib/api';
import type { Resgate } from '@/lib/resgates';

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number) {
      super(`Erro ${status}`);
      this.status = status;
    }
  }
  return { ApiError, get: jest.fn() };
});

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { back: jest.fn() },
    useLocalSearchParams: jest.fn(),
    useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]),
  };
});

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

// O QR de verdade desenha SVG; aqui basta saber o valor que ele codifica
jest.mock('react-native-qrcode-svg', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ value }: { value: string }) => <Text testID="qr">{`QR ${value}`}</Text> };
});

const mockGet = get as jest.Mock;
const mockCopiar = Clipboard.setStringAsync as jest.Mock;
const mockParametros = useLocalSearchParams as jest.Mock;

const cupom: Resgate = {
  id: 12,
  tipo: 'CUPOM',
  codigo: 'AB12CD34EF56',
  titulo: '10% de desconto em Fralda RN',
  empresa: { id: 3, nome: 'Loja X' },
  produto: 'Fralda RN',
  categoria: 'FRALDAS',
  desconto: 10,
  dataValidade: '2026-12-31',
  status: 'ATIVO',
  dataResgate: '2026-11-16T12:00:00Z',
  dataUso: null,
  pontosGastos: 120,
};

const promocao: Resgate = {
  ...cupom,
  id: 13,
  tipo: 'PROMOCAO',
  codigo: 'PROMO777',
  titulo: 'Semana do bebê',
  produto: null,
  categoria: null,
  desconto: 15,
  pontosGastos: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParametros.mockReturnValue({ id: '12' });
  mockCopiar.mockResolvedValue(true);
});

describe('resgate ativo', () => {
  it('mostra o código, o QR Code com o mesmo código e os dados do cupom', async () => {
    mockGet.mockResolvedValue(cupom);
    await render(<ResgateScreen />);

    expect(await screen.findByText('AB12CD34EF56')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/gestantes/cupons/12');
    expect(screen.getByTestId('qr')).toHaveTextContent('QR AB12CD34EF56');
    expect(screen.getByLabelText('Código: A B 1 2 C D 3 4 E F 5 6')).toBeTruthy();
    expect(screen.getByRole('header', { name: '10% de desconto em Fralda RN' })).toBeTruthy();
    expect(screen.getByText('Mostre no caixa da Loja X')).toBeTruthy();

    expect(screen.getByText('Cupom')).toBeTruthy();
    expect(screen.getAllByText('Ativo')).toHaveLength(2);
    expect(screen.getByText('Fralda RN')).toBeTruthy();
    expect(screen.getByText('10%')).toBeTruthy();
    expect(screen.getByText('31/12/2026')).toBeTruthy();
    expect(screen.getByText('16/11/2026')).toBeTruthy();
    expect(screen.queryByText('Usado em')).toBeNull();
    expect(screen.getByText('120 pontos')).toBeTruthy();
    expect(screen.queryByText(/não gastou pontos/)).toBeNull();
  });

  it('Copiar põe o código na área de transferência e avisa que copiou, por um tempo', async () => {
    jest.useFakeTimers();
    try {
      mockGet.mockResolvedValue(cupom);
      await render(<ResgateScreen />);
      await act(async () => {});

      await fireEvent.press(screen.getByRole('button', { name: 'Copiar' }));

      expect(mockCopiar).toHaveBeenCalledWith('AB12CD34EF56');
      expect(screen.getByRole('button', { name: 'Código copiado' })).toBeTruthy();

      await act(async () => jest.advanceTimersByTime(2000));
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('se não der para copiar, sugere mostrar o QR Code', async () => {
    mockCopiar.mockRejectedValue(new Error('sem permissão'));
    mockGet.mockResolvedValue(cupom);
    await render(<ResgateScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Copiar' }));

    expect(await screen.findByText(/Não foi possível copiar o código/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
  });

  it('promoção mostra que não gastou pontos', async () => {
    mockParametros.mockReturnValue({ id: '13' });
    mockGet.mockResolvedValue(promocao);
    await render(<ResgateScreen />);

    expect(await screen.findByTestId('qr')).toHaveTextContent('QR PROMO777');
    // O selo do tipo e a linha da promoção, com o título dela
    expect(screen.getAllByText('Promoção')).toHaveLength(2);
    expect(screen.getAllByText('Semana do bebê')).toHaveLength(2);
    expect(screen.queryByText('Produto')).toBeNull();
    expect(screen.getByText('Nenhum')).toBeTruthy();
    expect(screen.getByText('Promoção grátis: você não gastou pontos para resgatar.')).toBeTruthy();
    expect(screen.getByText('15%')).toBeTruthy();
  });
});

describe('resgate que não vale mais', () => {
  it('usado: esconde o QR e o Copiar, avisa e mostra a data de uso', async () => {
    mockGet.mockResolvedValue({ ...cupom, status: 'UTILIZADO', dataUso: '2026-11-20T12:00:00Z' });
    await render(<ResgateScreen />);

    expect(await screen.findByText('Este cupom já foi usado na loja e não vale mais.')).toBeTruthy();
    expect(screen.queryByTestId('qr')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull();
    expect(screen.getAllByText('Utilizado')).toHaveLength(2);
    expect(screen.getByText('Usado em 20/11/2026')).toBeTruthy();
    expect(screen.getByText('20/11/2026')).toBeTruthy();
    expect(screen.getByLabelText('Código, que não vale mais: A B 1 2 C D 3 4 E F 5 6')).toBeTruthy();
  });

  it('promoção usada fala no feminino', async () => {
    mockGet.mockResolvedValue({ ...promocao, status: 'UTILIZADO', dataUso: '2026-11-20T12:00:00Z' });
    await render(<ResgateScreen />);

    expect(await screen.findByText('Esta promoção já foi usada na loja e não vale mais.')).toBeTruthy();
  });

  it('expirado: esconde o QR e diz quando venceu', async () => {
    mockGet.mockResolvedValue({ ...cupom, status: 'EXPIRADO', dataValidade: '2026-11-10' });
    await render(<ResgateScreen />);

    expect(await screen.findByText('Este cupom venceu e não vale mais na loja.')).toBeTruthy();
    expect(screen.queryByTestId('qr')).toBeNull();
    expect(screen.getAllByText('Expirado')).toHaveLength(2);
    expect(screen.getByText('Venceu em 10/11/2026')).toBeTruthy();
  });
});

describe('erros', () => {
  it('404 diz que não encontrou, sem tentar de novo', async () => {
    mockGet.mockRejectedValue(new ApiError(404));
    await render(<ResgateScreen />);

    expect(await screen.findByText('Não encontramos este cupom resgatado.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    expect(screen.queryByTestId('qr')).toBeNull();
  });

  it('id que não é número nem chega à API', async () => {
    mockParametros.mockReturnValue({ id: '../ofertas' });
    await render(<ResgateScreen />);

    expect(screen.getByText('Não encontramos este cupom resgatado.')).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('falha de rede permite tentar de novo', async () => {
    mockGet.mockRejectedValueOnce(new Error('sem rede')).mockResolvedValueOnce(cupom);
    await render(<ResgateScreen />);

    expect(await screen.findByText(/Não foi possível carregar o cupom/)).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('AB12CD34EF56')).toBeTruthy();
    expect(screen.queryByText(/Não foi possível carregar/)).toBeNull();
  });

  it('enquanto carrega mostra o aviso e "Voltar" volta', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    await render(<ResgateScreen />);

    expect(screen.getByText('Carregando…')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalled();
  });
});
