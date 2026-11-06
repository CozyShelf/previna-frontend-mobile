/// <reference types="jest" />

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import ExtratoScreen from '@/app/(abas)/pontos/extrato';
import PontuacaoScreen from '@/app/(abas)/pontos/index';
import { get } from '@/lib/api';

jest.mock('@/lib/api', () => ({ get: jest.fn() }));

// Fora de um navegador, a aba "ganha foco" uma vez ao montar
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]),
    router: { push: jest.fn(), back: jest.fn() },
  };
});

const mockGet = get as jest.Mock;

// Data local (aaaa-mm-dd) de alguns dias atrás
function diasAtras(dias: number) {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${String(data.getDate()).padStart(2, '0')}`;
}

function extrato(descricao: string, extra: object = {}) {
  return {
    totalGanho: 150,
    totalGasto: 100,
    historico: [
      { id: 1, tipo: 'CREDITO', pontos: 150, descricao, dataHora: '2026-03-10T12:00:00Z' },
      { id: 2, tipo: 'DEBITO', pontos: 100, descricao: 'Cupom Fralda RN', dataHora: '2026-03-11T12:00:00Z' },
    ],
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pontuação', () => {
  it('mostra o saldo e as atividades com a categoria', async () => {
    mockGet.mockResolvedValue({
      saldo: 150,
      atividades: [
        { agendamento: 1, nome: 'Ultrassom', categoria: 'EXAME', pontos: 50, dataHora: '2026-03-10T12:00:00Z' },
        { agendamento: 2, nome: 'Pré-natal', categoria: 'CONSULTA', pontos: 100, dataHora: '2026-03-12T12:00:00Z' },
      ],
    });
    await render(<PontuacaoScreen />);

    expect(await screen.findByLabelText('Saldo: 150 pontos')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/gestantes/pontuacao');
    expect(screen.getByText('Exame · 10/03/2026')).toBeTruthy();
    expect(screen.getByText('Consulta · 12/03/2026')).toBeTruthy();
    expect(screen.getByText('+100')).toBeTruthy();
  });

  it('sem atividades explica quando os pontos aparecem', async () => {
    mockGet.mockResolvedValue({ saldo: 0, atividades: [] });
    await render(<PontuacaoScreen />);

    expect(await screen.findByText(/Seus pontos aparecem aqui/)).toBeTruthy();
  });

  it('erro ao carregar mostra o alerta e esconde o saldo', async () => {
    mockGet.mockRejectedValue(new Error('sem rede'));
    await render(<PontuacaoScreen />);

    expect(await screen.findByText(/Não foi possível carregar seus pontos/)).toBeTruthy();
    expect(screen.queryByText('Saldo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver extrato' })).toBeNull();
  });

  it('ver extrato abre a tela do extrato', async () => {
    mockGet.mockResolvedValue({ saldo: 0, atividades: [] });
    await render(<PontuacaoScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ver extrato' }));
    expect(router.push).toHaveBeenCalledWith('/pontos/extrato');
  });
});

describe('extrato', () => {
  const ultimaConsulta = () => mockGet.mock.calls.at(-1)[0];

  it('sem filtro busca tudo e mostra totais e movimentações', async () => {
    mockGet.mockResolvedValue(extrato('Ultrassom'));
    await render(<ExtratoScreen />);

    expect(await screen.findByLabelText('Total ganho: 150 pontos')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/gestantes/extrato?');
    expect(screen.getByLabelText('Total gasto: 100 pontos')).toBeTruthy();
    expect(screen.getByLabelText('Ultrassom, 10/03/2026, ganhou 150 pontos')).toBeTruthy();
    // Débito chega positivo da API e aparece como gasto
    expect(screen.getByLabelText('Cupom Fralda RN, 11/03/2026, gastou 100 pontos')).toBeTruthy();
  });

  it('filtro de tipo vai na consulta e tocar de novo tira o filtro', async () => {
    mockGet.mockResolvedValue(extrato('Ultrassom'));
    await render(<ExtratoScreen />);
    await screen.findByLabelText('Total ganho: 150 pontos');

    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    await waitFor(() => expect(ultimaConsulta()).toBe('/gestantes/extrato?tipo=DEBITO'));

    await fireEvent.press(screen.getByRole('radio', { name: 'Ganhos' }));
    await waitFor(() => expect(ultimaConsulta()).toBe('/gestantes/extrato?tipo=CREDITO'));

    await fireEvent.press(screen.getByRole('radio', { name: 'Ganhos' }));
    await waitFor(() => expect(ultimaConsulta()).toBe('/gestantes/extrato?'));
  });

  it.each([
    ['Últimos 30 dias', 30],
    ['Últimos 90 dias', 90],
  ])('período %p manda a data de início local', async (rotulo, dias) => {
    mockGet.mockResolvedValue(extrato('Ultrassom'));
    await render(<ExtratoScreen />);
    await screen.findByLabelText('Total ganho: 150 pontos');

    await fireEvent.press(screen.getByRole('radio', { name: rotulo }));
    await waitFor(() => expect(ultimaConsulta()).toBe(`/gestantes/extrato?inicio=${diasAtras(dias)}`));
  });

  it('tipo e período juntos', async () => {
    mockGet.mockResolvedValue(extrato('Ultrassom'));
    await render(<ExtratoScreen />);
    await screen.findByLabelText('Total ganho: 150 pontos');

    await fireEvent.press(screen.getByRole('radio', { name: 'Ganhos' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Últimos 30 dias' }));
    await waitFor(() =>
      expect(ultimaConsulta()).toBe(`/gestantes/extrato?tipo=CREDITO&inicio=${diasAtras(30)}`),
    );
  });

  it('filtro sem movimentações mostra a mensagem de vazio', async () => {
    mockGet.mockResolvedValue({ totalGanho: 0, totalGasto: 0, historico: [] });
    await render(<ExtratoScreen />);

    expect(await screen.findByText('Nenhuma movimentação de pontos neste filtro.')).toBeTruthy();
  });

  it('resposta atrasada de um filtro anterior é descartada', async () => {
    const respostas: ((valor: unknown) => void)[] = [];
    mockGet.mockImplementation(() => new Promise((resolve) => respostas.push(resolve)));
    await render(<ExtratoScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(respostas).toHaveLength(2);

    // A do filtro atual chega primeiro; a da carga inicial chega depois e não pode sobrescrever
    await act(async () => respostas[1](extrato('Só gastos')));
    await act(async () => respostas[0](extrato('Tudo')));

    expect(screen.getByText('Só gastos')).toBeTruthy();
    expect(screen.queryByText('Tudo')).toBeNull();
  });

  it('erro atrasado de um filtro anterior também é descartado', async () => {
    const respostas: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];
    mockGet.mockImplementation(() => new Promise((resolve, reject) => respostas.push({ resolve, reject })));
    await render(<ExtratoScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    await act(async () => respostas[1].resolve(extrato('Só gastos')));
    await act(async () => respostas[0].reject(new Error('sem rede')));

    expect(screen.getByText('Só gastos')).toBeTruthy();
    expect(screen.queryByText(/Não foi possível carregar o extrato/)).toBeNull();
  });

  it('erro do filtro atual mostra o alerta e some quando outro filtro carrega', async () => {
    mockGet.mockRejectedValueOnce(new Error('sem rede'));
    mockGet.mockResolvedValue(extrato('Ultrassom'));
    await render(<ExtratoScreen />);

    expect(await screen.findByText(/Não foi possível carregar o extrato/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Ganhos' }));
    expect(await screen.findByText('Ultrassom')).toBeTruthy();
    expect(screen.queryByText(/Não foi possível carregar o extrato/)).toBeNull();
  });

  it('voltar retorna para a pontuação', async () => {
    mockGet.mockResolvedValue(extrato('Ultrassom'));
    await render(<ExtratoScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalled();
  });
});
