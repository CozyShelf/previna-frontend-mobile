/// <reference types="jest" />

import { render, screen } from '@testing-library/react-native';

import InicioScreen from '@/app/(abas)/inicio';
import type { Agendamento } from '@/components/agendamento';
import { get } from '@/lib/api';
import { lembrarSessao } from '@/lib/sessao';

jest.mock('@/lib/api', () => ({ get: jest.fn() }));
jest.mock('@/lib/sessao', () => ({ lembrarSessao: jest.fn() }));

// Fora de um navegador, a aba "ganha foco" uma vez ao montar
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]) };
});

const mockGet = get as jest.Mock;

function dia(deslocamento: number) {
  const data = new Date();
  data.setDate(data.getDate() + deslocamento);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${String(data.getDate()).padStart(2, '0')}`;
}

function agendamento(id: number, tipo: string, dataPrevista: string): Agendamento {
  return { id, tipo, categoria: 'EXAME', pontosBase: 10, dataPrevista, status: 'AGENDADO' };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('lembra a sessão no aparelho ao chegar no início', async () => {
  mockGet.mockResolvedValue([]);
  await render(<InicioScreen />);

  expect(lembrarSessao).toHaveBeenCalledTimes(1);
});

it('mostra carregando enquanto a lista não chega', async () => {
  mockGet.mockReturnValue(new Promise(() => {}));
  await render(<InicioScreen />);

  expect(screen.getByText('Carregando…')).toBeTruthy();
  expect(mockGet).toHaveBeenCalledWith('/gestantes/agendamentos');
});

it('sem agendamentos explica que o médico vai cadastrar', async () => {
  mockGet.mockResolvedValue([]);
  await render(<InicioScreen />);

  expect(await screen.findByText(/Você ainda não tem exames ou consultas cadastrados/)).toBeTruthy();
  expect(screen.queryByText('Carregando…')).toBeNull();
  expect(screen.queryByRole('header', { name: /Próximos/ })).toBeNull();
});

it('separa próximos e passados, cada um na sua ordem', async () => {
  // A API manda na ordem do portal (pendentes primeiro); a tela reordena por data
  mockGet.mockResolvedValue([
    agendamento(1, 'Ultrassom', dia(10)),
    agendamento(2, 'Hemograma', dia(-5)),
    agendamento(3, 'Consulta de rotina', dia(0)),
    agendamento(4, 'Glicemia', dia(-1)),
  ]);
  await render(<InicioScreen />);

  expect(await screen.findByRole('header', { name: 'Próximos (2)' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Já passaram (2)' })).toBeTruthy();
  const tipos = screen
    .getAllByText(/^(Ultrassom|Hemograma|Consulta de rotina|Glicemia)$/)
    .map((texto) => texto.props.children);
  expect(tipos).toEqual(['Consulta de rotina', 'Ultrassom', 'Glicemia', 'Hemograma']);
});

it('só com passados não mostra a seção de próximos', async () => {
  mockGet.mockResolvedValue([agendamento(1, 'Ultrassom', dia(-3))]);
  await render(<InicioScreen />);

  expect(await screen.findByRole('header', { name: 'Já passaram (1)' })).toBeTruthy();
  expect(screen.queryByRole('header', { name: /Próximos/ })).toBeNull();
});

it('erro ao carregar mostra o alerta no lugar do carregando', async () => {
  mockGet.mockRejectedValue(new Error('sem rede'));
  await render(<InicioScreen />);

  expect(await screen.findByText(/Não foi possível carregar seus exames e consultas/)).toBeTruthy();
  expect(screen.queryByText('Carregando…')).toBeNull();
});
