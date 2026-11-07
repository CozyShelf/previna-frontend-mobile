/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import InicioScreen from '@/app/(abas)/inicio';
import type { Agendamento } from '@/components/agendamento';
import type { Conteudo } from '@/components/conteudo';
import { get } from '@/lib/api';
import { lembrarSessao } from '@/lib/sessao';

jest.mock('@/lib/api', () => ({
  get: jest.fn(),
  imagemDaApi: (caminho: string) => ({ uri: caminho }),
}));
jest.mock('@/lib/sessao', () => ({ lembrarSessao: jest.fn() }));

// Fora de um navegador, a aba "ganha foco" uma vez ao montar
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]),
  };
});

const mockGet = get as jest.Mock;
const mockPush = router.push as jest.Mock;

function agendamento(id: number, tipo: string): Agendamento {
  return {
    id,
    tipo,
    categoria: 'EXAME',
    pontosBase: 10,
    dataPrevista: '2026-12-01',
    status: 'AGENDADO',
  };
}

function conteudo(id: number, titulo: string): Conteudo {
  return {
    id,
    titulo,
    categoria: 'DICA',
    tipo: 'TEXTO',
    publicado: true,
    criadoEm: '2026-11-01T10:00:00',
  };
}

const pagina = (itens: Conteudo[]) => ({
  itens,
  pagina: 0,
  tamanho: 5,
  total: itens.length,
  totalPaginas: 1,
});

// Responde as duas listas da home, como a API; uma resposta Error vira rejeição
function comApi(
  pendentes: Agendamento[] | Error | Promise<never>,
  conteudos: Conteudo[] | Error | Promise<never>,
) {
  const responder = (r: unknown) =>
    r instanceof Error ? Promise.reject(r) : r instanceof Promise ? r : Promise.resolve(r);
  mockGet.mockImplementation((caminho: string) =>
    caminho.startsWith('/gestantes/agendamentos')
      ? responder(pendentes)
      : responder(conteudos instanceof Array ? pagina(conteudos) : conteudos),
  );
}

const nunca = () => new Promise<never>(() => {});

beforeEach(() => {
  jest.clearAllMocks();
});

it('lembra a sessão no aparelho ao chegar no início', async () => {
  comApi([], []);
  await render(<InicioScreen />);

  expect(lembrarSessao).toHaveBeenCalledTimes(1);
});

it('mostra carregando nas duas seções enquanto as listas não chegam', async () => {
  comApi(nunca(), nunca());
  await render(<InicioScreen />);

  expect(screen.getAllByText('Carregando…')).toHaveLength(2);
  expect(mockGet).toHaveBeenCalledWith('/gestantes/agendamentos?pendentes=true');
  expect(mockGet).toHaveBeenCalledWith(expect.stringMatching(/^\/conteudos\?semente=\w+&tamanho=5$/));
});

it('sem pendentes explica que o médico vai cadastrar', async () => {
  comApi([], []);
  await render(<InicioScreen />);

  expect(await screen.findByText(/Você não tem exames nem consultas pendentes/)).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Pendentes' })).toBeTruthy();
  expect(screen.queryByText(/^Ver todas/)).toBeNull();
});

it('mostra só os três primeiros pendentes e leva para a lista completa', async () => {
  comApi(
    [
      agendamento(1, 'Ultrassom'),
      agendamento(2, 'Hemograma'),
      agendamento(3, 'Glicemia'),
      agendamento(4, 'Consulta de rotina'),
    ],
    [],
  );
  await render(<InicioScreen />);

  expect(await screen.findByRole('header', { name: 'Pendentes (4)' })).toBeTruthy();
  expect(screen.getByText('Ultrassom')).toBeTruthy();
  expect(screen.getByText('Glicemia')).toBeTruthy();
  expect(screen.queryByText('Consulta de rotina')).toBeNull();

  fireEvent.press(screen.getByText('Ver todas (4)'));
  expect(mockPush).toHaveBeenCalledWith('/inicio/consultas');
});

it('com até três pendentes não oferece "Ver todas"', async () => {
  comApi([agendamento(1, 'Ultrassom')], []);
  await render(<InicioScreen />);

  expect(await screen.findByRole('header', { name: 'Pendentes (1)' })).toBeTruthy();
  expect(screen.queryByText(/^Ver todas/)).toBeNull();
});

it('leva para o histórico', async () => {
  comApi([], []);
  await render(<InicioScreen />);

  fireEvent.press(screen.getByText('Ver histórico'));
  expect(mockPush).toHaveBeenCalledWith('/inicio/historico');
});

it('erro nas consultas mostra o alerta no lugar do carregando', async () => {
  comApi(new Error('sem rede'), []);
  await render(<InicioScreen />);

  expect(await screen.findByText(/Não foi possível carregar seus exames e consultas/)).toBeTruthy();
  expect(screen.queryByText('Carregando…')).toBeNull();
});

it('sem conteúdos publicados avisa para voltar depois', async () => {
  comApi([], []);
  await render(<InicioScreen />);

  expect(await screen.findByText(/Ainda não há conteúdos publicados/)).toBeTruthy();
  expect(screen.queryByText('Ver outros conteúdos')).toBeNull();
});

it('mostra os conteúdos e abre o detalhe ao tocar', async () => {
  comApi([], [conteudo(7, 'Alimentação na gestação'), conteudo(8, 'Sono')]);
  await render(<InicioScreen />);

  fireEvent.press(await screen.findByLabelText('Dica: Alimentação na gestação'));
  expect(mockPush).toHaveBeenCalledWith('/inicio/conteudo/7');
  expect(screen.getByText('Sono')).toBeTruthy();
});

it('"Ver outros conteúdos" sorteia de novo com outra semente', async () => {
  comApi([], [conteudo(7, 'Alimentação na gestação')]);
  await render(<InicioScreen />);
  await screen.findByText('Alimentação na gestação');

  const conteudosPedidos = () =>
    mockGet.mock.calls.map(([caminho]) => caminho as string).filter((c) => c.startsWith('/conteudos'));
  const antes = conteudosPedidos();

  fireEvent.press(screen.getByText('Ver outros conteúdos'));
  await screen.findByText('Alimentação na gestação');

  const depois = conteudosPedidos();
  expect(depois).toHaveLength(antes.length + 1);
  expect(depois.at(-1)).not.toBe(antes.at(-1));
});

it('descarta a resposta de um sorteio que chega depois do seguinte', async () => {
  let responderAntigo: (p: unknown) => void = () => {};
  let chamadas = 0;
  mockGet.mockImplementation((caminho: string) => {
    if (caminho.startsWith('/gestantes')) {
      return Promise.resolve([]);
    }
    chamadas += 1;
    // O primeiro sorteio fica pendurado; o segundo responde na hora
    return chamadas === 1
      ? new Promise((resolve) => (responderAntigo = resolve))
      : Promise.resolve(pagina([conteudo(2, 'Novo')]));
  });
  await render(<InicioScreen />);

  // Ao montar já são dois sorteios: o da semente inicial e o do foco, que troca a semente
  expect(await screen.findByText('Novo')).toBeTruthy();

  await act(async () => responderAntigo(pagina([conteudo(1, 'Antigo')])));
  expect(screen.queryByText('Antigo')).toBeNull();
  expect(screen.getByText('Novo')).toBeTruthy();
});

it('erro nos conteúdos mostra o alerta só na seção deles', async () => {
  comApi([agendamento(1, 'Ultrassom')], new Error('sem rede'));
  await render(<InicioScreen />);

  expect(await screen.findByText(/Não foi possível carregar os conteúdos/)).toBeTruthy();
  expect(screen.getByText('Ultrassom')).toBeTruthy();
  expect(screen.queryByText('Carregando…')).toBeNull();
});

it('erro de um sorteio já trocado não aparece', async () => {
  let falharAntigo: (e: Error) => void = () => {};
  let chamadas = 0;
  mockGet.mockImplementation((caminho: string) => {
    if (caminho.startsWith('/gestantes')) {
      return Promise.resolve([]);
    }
    chamadas += 1;
    return chamadas === 1
      ? new Promise((_, reject) => (falharAntigo = reject))
      : Promise.resolve(pagina([conteudo(2, 'Novo')]));
  });
  await render(<InicioScreen />);
  expect(await screen.findByText('Novo')).toBeTruthy();

  await act(async () => falharAntigo(new Error('atrasado')));
  expect(screen.queryByText(/Não foi possível carregar os conteúdos/)).toBeNull();
});
