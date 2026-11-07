/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import ConsultasScreen from '@/app/(abas)/inicio/consultas';
import HistoricoScreen from '@/app/(abas)/inicio/historico';
import type { Agendamento, StatusAgendamento } from '@/components/agendamento';
import { get } from '@/lib/api';

jest.mock('@/lib/api', () => ({ get: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const mockGet = get as jest.Mock;

function agendamento(id: number, tipo: string, status: StatusAgendamento): Agendamento {
  return { id, tipo, categoria: 'EXAME', pontosBase: 10, dataPrevista: '2026-10-01', status };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// As duas telas são a mesma lista com outro filtro da API: o que muda são os textos
describe.each([
  {
    nome: 'consultas pendentes',
    Tela: ConsultasScreen,
    caminho: '/gestantes/agendamentos?pendentes=true',
    secao: 'Pendentes',
    vazio: /Você não tem exames nem consultas pendentes/,
    erro: /Não foi possível carregar seus exames e consultas/,
    itens: [agendamento(1, 'Ultrassom', 'AGENDADO'), agendamento(2, 'Hemograma', 'AGENDADO')],
  },
  {
    nome: 'histórico',
    Tela: HistoricoScreen,
    caminho: '/gestantes/agendamentos?pendentes=false',
    secao: 'Concluídos',
    vazio: /Seu histórico aparece aqui depois que o médico confirmar/,
    erro: /Não foi possível carregar seu histórico/,
    itens: [agendamento(1, 'Ultrassom', 'REALIZADO'), agendamento(2, 'Hemograma', 'NAO_COMPARECEU')],
  },
])('$nome', ({ Tela, caminho, secao, vazio, erro, itens }) => {
  it('mostra carregando enquanto a lista não chega', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    await render(<Tela />);

    expect(screen.getByText('Carregando…')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith(caminho);
  });

  it('lista tudo o que a API devolveu, na ordem dela', async () => {
    mockGet.mockResolvedValue(itens);
    await render(<Tela />);

    expect(await screen.findByRole('header', { name: `${secao} (2)` })).toBeTruthy();
    expect(
      screen.getAllByText(/^(Ultrassom|Hemograma)$/).map((t) => t.props.children),
    ).toEqual(['Ultrassom', 'Hemograma']);
    expect(screen.queryByText('Carregando…')).toBeNull();
  });

  it('lista vazia explica o motivo', async () => {
    mockGet.mockResolvedValue([]);
    await render(<Tela />);

    expect(await screen.findByText(vazio)).toBeTruthy();
    expect(screen.queryByRole('header', { name: new RegExp(secao) })).toBeNull();
  });

  it('erro ao carregar mostra o alerta no lugar do carregando', async () => {
    mockGet.mockRejectedValue(new Error('sem rede'));
    await render(<Tela />);

    expect(await screen.findByText(erro)).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();
  });

  it('"Voltar" volta para a tela anterior', async () => {
    mockGet.mockResolvedValue([]);
    await render(<Tela />);

    fireEvent.press(screen.getByText('Voltar'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
