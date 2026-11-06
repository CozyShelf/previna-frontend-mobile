/// <reference types="jest" />

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CuponsScreen from '@/app/(abas)/cupons';
import type { CupomDisponivel } from '@/components/cupom';
import { ApiError, get, post } from '@/lib/api';

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
  return {
    ApiError,
    get: jest.fn(),
    post: jest.fn(),
    imagemDaApi: (caminho: string) => ({ uri: caminho }),
  };
});

// Fora de um navegador, a aba "ganha foco" uma vez ao montar
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]) };
});

const mockGet = get as jest.Mock;
const mockPost = post as jest.Mock;

const vida = { id: 1, nome: 'Farmácia Vida' };
const fralda: CupomDisponivel = {
  id: 5,
  descricao: '10% de desconto em Fralda RN',
  produto: 'Fralda RN',
  categoria: 'FRALDAS',
  desconto: 10,
  dataValidade: '2026-12-31',
  pontosNecessarios: 100,
  empresa: vida,
};
const resgatado = {
  id: 1,
  codigo: 'ABCD2345',
  descricao: '10% de desconto em Fralda RN',
  empresa: 'Farmácia Vida',
  dataValidade: '2026-12-31',
  pontosGastos: 100,
  saldo: 50,
};

// Responde a lista de cupons e o saldo, como a API
function comApi(cupons: CupomDisponivel[], saldo: number) {
  mockGet.mockImplementation((caminho: string) =>
    Promise.resolve(caminho === '/cupons/disponiveis' ? cupons : { saldo, atividades: [] }),
  );
}

async function abrirConfirmacao() {
  await render(<CuponsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Resgatar' }));
  return screen.getByRole('button', { name: 'Confirmar resgate' });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('lista', () => {
  it('mostra o saldo e os cupons agrupados pela loja', async () => {
    comApi([fralda], 150);
    await render(<CuponsScreen />);

    expect(await screen.findByText('150 pontos')).toBeTruthy();
    expect(screen.getByText('Farmácia Vida')).toBeTruthy();
    expect(screen.getByText('Fralda RN')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/cupons/disponiveis');
  });

  it('sem cupons mostra a mensagem de lista vazia', async () => {
    comApi([], 0);
    await render(<CuponsScreen />);

    expect(await screen.findByText(/Nenhum cupom disponível/)).toBeTruthy();
  });

  it('erro ao carregar mostra o alerta e não mostra lista', async () => {
    mockGet.mockRejectedValue(new Error('sem rede'));
    await render(<CuponsScreen />);

    expect(await screen.findByText(/Não foi possível carregar os cupons/)).toBeTruthy();
    expect(screen.queryByText('Seu saldo')).toBeNull();
  });
});

describe('resgate', () => {
  it('confirmação mostra o saldo antes e depois e cancelar não resgata', async () => {
    comApi([fralda], 150);
    await abrirConfirmacao();

    expect(screen.getByText('Resgatar cupom?')).toBeTruthy();
    expect(screen.getByText('−100 pontos')).toBeTruthy();
    expect(screen.getByText('50 pontos')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Resgatar cupom?')).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('resgate válido mostra o código e atualiza o saldo da tela', async () => {
    comApi([fralda], 150);
    mockPost.mockResolvedValue(resgatado);
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText('ABCD2345')).toBeTruthy();
    expect(mockPost).toHaveBeenCalledWith('/cupons/5/resgatar', {});
    expect(screen.getAllByText('50 pontos').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
    expect(screen.queryByText('ABCD2345')).toBeNull();
    // Saldo novo (50) não paga mais o cupom de 100
    expect(screen.queryByRole('button', { name: 'Resgatar' })).toBeNull();
    expect(screen.getByText('Faltam 50 pontos')).toBeTruthy();
  });

  it('dois toques rápidos em confirmar mandam um resgate só', async () => {
    comApi([fralda], 1000);
    let responder: (valor: unknown) => void = () => {};
    mockPost.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const confirmar = await abrirConfirmacao();

    // Segundo toque no mesmo botão, com o primeiro resgate ainda em andamento
    await fireEvent.press(confirmar);
    await fireEvent.press(confirmar);
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => responder(resgatado));
    expect(await screen.findByText('ABCD2345')).toBeTruthy();
  });

  it('durante o envio o botão fica desabilitado e não dá para cancelar', async () => {
    comApi([fralda], 150);
    mockPost.mockReturnValue(new Promise(() => {}));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByRole('button', { name: 'Resgatando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });

  it.each([
    [409, 'Pontos insuficientes'],
    [409, 'Cupom indisponível'],
    [404, 'Cupom não encontrado'],
  ])('erro %p "%s" mostra a mensagem da API, recarrega a lista e não oferece tentar de novo', async (status, mensagem) => {
    comApi([fralda], 150);
    mockPost.mockRejectedValue(new ApiError(status, mensagem));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText(`${mensagem}. A lista de cupons foi atualizada.`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirmar resgate' })).toBeNull();
    // Carga inicial (2 chamadas) + recarga depois do erro (2 chamadas)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4));

    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText(mensagem, { exact: false })).toBeNull();
  });

  it('falha de rede mostra mensagem genérica e não recarrega', async () => {
    comApi([fralda], 150);
    mockPost.mockRejectedValue(new TypeError('Network request failed'));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText(/Verifique sua conexão e tente de novo/)).toBeTruthy();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('erro 500 não é tratado como cupom indisponível', async () => {
    comApi([fralda], 150);
    mockPost.mockRejectedValue(new ApiError(500));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText(/Não foi possível resgatar o cupom/)).toBeTruthy();
    expect(screen.queryByText(/foi atualizada/)).toBeNull();
  });
});
