/// <reference types="jest" />

import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import ConsultasScreen from '@/app/(abas)/inicio/consultas';
import HistoricoScreen from '@/app/(abas)/inicio/historico';
import type { Agendamento, StatusAgendamento } from '@/components/agendamento';
import { get } from '@/lib/api';

jest.mock('@/lib/api', () => ({ get: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const mockGet = get as jest.Mock;

function agendamento(
  id: number,
  tipo: string,
  status: StatusAgendamento,
  extra: Partial<Agendamento> = {},
): Agendamento {
  return { id, tipo, categoria: 'EXAME', pontosBase: 10, dataPrevista: '2026-10-01', status, ...extra };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('consultas pendentes', () => {
  const caminho = '/gestantes/agendamentos?pendentes=true';
  const itens = [agendamento(1, 'Ultrassom', 'AGENDADO'), agendamento(2, 'Hemograma', 'AGENDADO')];

  it('mostra carregando enquanto a lista não chega', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    await render(<ConsultasScreen />);

    expect(screen.getByText('Carregando…')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith(caminho);
  });

  it('lista tudo o que a API devolveu, na ordem dela', async () => {
    mockGet.mockResolvedValue(itens);
    await render(<ConsultasScreen />);

    expect(await screen.findByRole('header', { name: 'Pendentes (2)' })).toBeTruthy();
    expect(
      screen.getAllByText(/^(Ultrassom|Hemograma)$/).map((t) => t.props.children),
    ).toEqual(['Ultrassom', 'Hemograma']);
    expect(screen.queryByText('Carregando…')).toBeNull();
  });

  it('lista vazia explica o motivo', async () => {
    mockGet.mockResolvedValue([]);
    await render(<ConsultasScreen />);

    expect(await screen.findByText(/Você não tem exames nem consultas pendentes/)).toBeTruthy();
    expect(screen.queryByRole('header', { name: /Pendentes/ })).toBeNull();
  });

  it('erro ao carregar mostra o alerta no lugar do carregando', async () => {
    mockGet.mockRejectedValue(new Error('sem rede'));
    await render(<ConsultasScreen />);

    expect(await screen.findByText(/Não foi possível carregar seus exames e consultas/)).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();
  });

  it('"Voltar" volta para a tela anterior', async () => {
    mockGet.mockResolvedValue([]);
    await render(<ConsultasScreen />);

    fireEvent.press(screen.getByText('Voltar'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('histórico', () => {
  // Como a API manda sem o filtro: pendentes primeiro (data prevista), depois por status e data prevista
  const lista = [
    agendamento(3, 'Ultrassom', 'AGENDADO', { dataPrevista: '2026-11-25' }),
    agendamento(4, 'Glicemia', 'AGENDADO', { dataPrevista: '2026-12-10' }),
    agendamento(1, 'Hemograma', 'REALIZADO', { dataConfirmacao: '2026-10-02T09:00:00' }),
    agendamento(2, 'Consulta de rotina', 'NAO_COMPARECEU', { dataConfirmacao: '2026-11-03T14:30:00' }),
  ];
  const tipos = /^(Ultrassom|Glicemia|Hemograma|Consulta de rotina)$/;
  const vazioPendentes = /Você não tem exames nem consultas pendentes/;
  const vazioConcluidos = /Quando o médico confirmar um exame ou consulta/;
  const vazioTudo = /Você ainda não tem exames nem consultas/;

  it('busca tudo numa chamada só, sem o filtro de pendentes, e mostra carregando', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    await render(<HistoricoScreen />);

    expect(screen.getByText('Carregando…')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/gestantes/agendamentos');
  });

  it('separa pendentes e concluídos: pendentes na ordem da API, concluídos do mais recente', async () => {
    mockGet.mockResolvedValue(lista);
    await render(<HistoricoScreen />);

    expect(await screen.findByRole('header', { name: 'Pendentes (2)' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Concluídos (2)' })).toBeTruthy();
    expect(screen.getAllByText(tipos).map((t) => t.props.children)).toEqual([
      'Ultrassom',
      'Glicemia',
      'Consulta de rotina',
      'Hemograma',
    ]);
    // Cada cartão leva o selo do próprio status
    expect(screen.getAllByText('Pendente')).toHaveLength(2);
    expect(screen.getByText('Realizado')).toBeTruthy();
    expect(screen.getByText('Não compareceu')).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();
    expect(screen.queryByText(vazioPendentes)).toBeNull();
    expect(screen.queryByText(vazioConcluidos)).toBeNull();
  });

  it('sem nada, uma explicação só, sem as seções', async () => {
    mockGet.mockResolvedValue([]);
    await render(<HistoricoScreen />);

    expect(await screen.findByText(vazioTudo)).toBeTruthy();
    expect(screen.queryByRole('header', { name: /Pendentes|Concluídos/ })).toBeNull();
    expect(screen.queryByText(vazioPendentes)).toBeNull();
    expect(screen.queryByText(vazioConcluidos)).toBeNull();
  });

  it('só com pendentes, a seção de concluídos explica que ainda está vazia', async () => {
    mockGet.mockResolvedValue(lista.slice(0, 2));
    await render(<HistoricoScreen />);

    expect(await screen.findByRole('header', { name: 'Pendentes (2)' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Concluídos' })).toBeTruthy();
    expect(screen.getByText(vazioConcluidos)).toBeTruthy();
    expect(screen.queryByText(vazioPendentes)).toBeNull();
    expect(screen.queryByText(vazioTudo)).toBeNull();
  });

  it('só com concluídos, a seção de pendentes explica que não há nenhum', async () => {
    mockGet.mockResolvedValue(lista.slice(2));
    await render(<HistoricoScreen />);

    expect(await screen.findByRole('header', { name: 'Concluídos (2)' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Pendentes' })).toBeTruthy();
    expect(screen.getByText(vazioPendentes)).toBeTruthy();
    expect(screen.queryByText(vazioConcluidos)).toBeNull();
    expect(screen.queryByText(vazioTudo)).toBeNull();
  });

  it('erro ao carregar mostra o alerta no lugar do carregando', async () => {
    mockGet.mockRejectedValue(new Error('sem rede'));
    await render(<HistoricoScreen />);

    expect(await screen.findByText(/Não foi possível carregar seu histórico/)).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();
    expect(screen.queryByText(vazioTudo)).toBeNull();
  });

  it('puxar para recarregar busca de novo e mostra o que mudou', async () => {
    mockGet
      .mockResolvedValueOnce(lista.slice(0, 1))
      .mockResolvedValueOnce([
        agendamento(3, 'Ultrassom', 'REALIZADO', { dataConfirmacao: '2026-11-25T10:00:00' }),
      ]);
    await render(<HistoricoScreen />);
    await screen.findByRole('header', { name: 'Pendentes (1)' });

    await userEvent.setup().pullToRefresh(screen.getByTestId('tela'));

    expect(await screen.findByRole('header', { name: 'Concluídos (1)' })).toBeTruthy();
    expect(screen.getByText(vazioPendentes)).toBeTruthy();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenLastCalledWith('/gestantes/agendamentos');
  });

  it('erro ao recarregar some com o indicador e mantém a lista que já estava', async () => {
    let falhar: (e: Error) => void = () => {};
    mockGet
      .mockResolvedValueOnce(lista)
      .mockReturnValueOnce(new Promise((_, reject) => (falhar = reject)));
    await render(<HistoricoScreen />);
    await screen.findByRole('header', { name: 'Pendentes (2)' });

    await act(async () => screen.getByTestId('tela').props.refreshControl.props.onRefresh());
    expect(screen.getByTestId('tela').props.refreshControl.props.refreshing).toBe(true);

    await act(async () => falhar(new Error('sem rede')));
    expect(screen.getByTestId('tela').props.refreshControl.props.refreshing).toBe(false);
    expect(screen.getByText(/Não foi possível carregar seu histórico/)).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Pendentes (2)' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Concluídos (2)' })).toBeTruthy();
  });

  it('recarregar depois de um erro tira o alerta', async () => {
    mockGet.mockRejectedValueOnce(new Error('sem rede')).mockResolvedValueOnce(lista);
    await render(<HistoricoScreen />);
    await screen.findByText(/Não foi possível carregar seu histórico/);

    await userEvent.setup().pullToRefresh(screen.getByTestId('tela'));

    expect(await screen.findByRole('header', { name: 'Pendentes (2)' })).toBeTruthy();
    expect(screen.queryByText(/Não foi possível carregar seu histórico/)).toBeNull();
  });

  it('"Voltar" volta para a tela anterior', async () => {
    mockGet.mockResolvedValue([]);
    await render(<HistoricoScreen />);

    fireEvent.press(screen.getByText('Voltar'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
