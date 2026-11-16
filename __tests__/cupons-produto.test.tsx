/// <reference types="jest" />

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import ProdutoScreen from '@/app/(abas)/cupons/produto/[id]';
import { ApiError, get, post } from '@/lib/api';
import type { ProdutoOfertaDetalhe } from '@/lib/ofertas';

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

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { back: jest.fn() },
    useLocalSearchParams: jest.fn(),
    useFocusEffect: (efeito: () => void) => useEffect(() => efeito(), [efeito]),
  };
});

const mockGet = get as jest.Mock;
const mockPost = post as jest.Mock;
const mockParametros = useLocalSearchParams as jest.Mock;

const fralda: ProdutoOfertaDetalhe = {
  id: 5,
  nome: 'Fralda RN',
  categoria: 'FRALDAS',
  imagem: '/produtos/5/imagem',
  empresa: { id: 1, nome: 'Farmácia Vida', segmento: 'Farmácia', logo: null },
  cupons: [
    { id: 9, desconto: 10, pontosNecessarios: 100, dataValidade: '2026-12-31' },
    { id: 10, desconto: 25, pontosNecessarios: 300, dataValidade: '2027-01-31' },
  ],
  promocoes: [{ id: 3, titulo: 'Semana do bebê', desconto: 15, dataInicio: '2026-11-01', dataFim: '2026-11-30' }],
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

// Responde o produto e o saldo, como a API; uma resposta Error vira rejeição
function comApi(produto: ProdutoOfertaDetalhe | Error, saldo = 150) {
  mockGet.mockImplementation((caminho: string) => {
    if (caminho === '/gestantes/pontuacao') {
      return Promise.resolve({ saldo, atividades: [] });
    }
    return produto instanceof Error ? Promise.reject(produto) : Promise.resolve(produto);
  });
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Idempotency-Key mandada na n-ésima chamada de resgate
function chaveDoEnvio(n: number): string {
  return mockPost.mock.calls[n][2]['Idempotency-Key'];
}

// Dois toques no mesmo instante, sem render entre eles: o botão ainda está habilitado no segundo. O onClick do
// Pressable (o clique de acessibilidade) chama o onPress direto, então os dois cabem num act só.
async function tocarDuasVezes(botao: { props: Record<string, unknown> }) {
  const clicar = botao.props.onClick as (evento: object) => void;
  await act(async () => {
    clicar({});
    clicar({});
  });
}

const botoesResgatar = () => screen.getAllByRole('button', { name: 'Resgatar' });

async function abrirConfirmacao() {
  await render(<ProdutoScreen />);
  await screen.findByText('Semana do bebê');
  await fireEvent.press(botoesResgatar()[0]);
  return screen.getByRole('button', { name: 'Confirmar resgate' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParametros.mockReturnValue({ id: '5' });
});

describe('detalhe', () => {
  it('mostra nome, categoria, empresa, saldo, os cupons e a promoção', async () => {
    comApi(fralda);
    await render(<ProdutoScreen />);

    expect(await screen.findByRole('header', { name: 'Fralda RN' })).toBeTruthy();
    expect(screen.getByText('Fraldas · Farmácia Vida')).toBeTruthy();
    expect(screen.getByLabelText('Vendido por Farmácia Vida')).toBeTruthy();
    expect(screen.getByLabelText('Seu saldo: 150 pontos')).toBeTruthy();
    expect(screen.getByText('10% de desconto')).toBeTruthy();
    expect(screen.getByText('25% de desconto')).toBeTruthy();
    expect(screen.getByText('Promoção 15%')).toBeTruthy();
    expect(screen.getByText('Válida até 30/11/2026')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/ofertas/produtos/5');
    expect(screen.queryByText('Sem cupom no momento')).toBeNull();
    expect(screen.queryByText('Sem promoção para este produto')).toBeNull();
  });

  it('cupom que o saldo paga fica habilitado; o que não paga fica desabilitado e diz quanto falta', async () => {
    comApi(fralda, 150);
    await render(<ProdutoScreen />);
    await screen.findByText('Semana do bebê');

    const [barato, caro] = botoesResgatar();
    expect(barato).toBeEnabled();
    expect(caro).toBeDisabled();
    expect(screen.getByText('Faltam 150 pontos para resgatar')).toBeTruthy();
  });

  it('sem cupom e sem promoção mostra os dois avisos desabilitados', async () => {
    comApi({ ...fralda, categoria: null, empresa: { ...fralda.empresa, segmento: null }, cupons: [], promocoes: [] });
    await render(<ProdutoScreen />);

    expect(await screen.findByLabelText('Sem cupom no momento')).toBeDisabled();
    expect(screen.getByLabelText('Sem promoção para este produto')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Resgatar' })).toBeNull();
    // Sem categoria a descrição fica só com a empresa (e o nome dela aparece também ao lado do logo)
    expect(screen.getAllByText('Farmácia Vida')).toHaveLength(2);
  });

  it('enquanto carrega mostra o aviso', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    await render(<ProdutoScreen />);

    expect(screen.getByText('Carregando…')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Produto' })).toBeTruthy();
  });

  it('produto sem ofertas ou inexistente (404) diz que não está mais disponível', async () => {
    comApi(new ApiError(404, 'Produto não encontrado'));
    await render(<ProdutoScreen />);

    expect(await screen.findByText('Este produto não tem mais ofertas disponíveis.')).toBeTruthy();
  });

  it('falha de rede pede para verificar a conexão', async () => {
    comApi(new Error('sem rede'));
    await render(<ProdutoScreen />);

    expect(await screen.findByText(/Não foi possível carregar o produto/)).toBeTruthy();
  });

  it('id fora do formato não chega a buscar', async () => {
    mockParametros.mockReturnValue({ id: '5/../../cupons' });
    await render(<ProdutoScreen />);

    expect(screen.getByText('Este produto não tem mais ofertas disponíveis.')).toBeTruthy();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('voltar volta para a lista', async () => {
    comApi(fralda);
    await render(<ProdutoScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('resgate', () => {
  it('confirmação mostra produto, empresa e o saldo antes e depois; cancelar não resgata', async () => {
    comApi(fralda, 150);
    await abrirConfirmacao();

    expect(screen.getByText('Resgatar cupom?')).toBeTruthy();
    expect(screen.getByText(/10% de desconto em Fralda RN, na Farmácia Vida/)).toBeTruthy();
    expect(screen.getByText('−100 pontos')).toBeTruthy();
    expect(screen.getByText('50 pontos')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Resgatar cupom?')).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('resgate válido mostra o código e o novo saldo, que passa a valer na tela', async () => {
    comApi(fralda, 150);
    mockPost.mockResolvedValue(resgatado);
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText('ABCD2345')).toBeTruthy();
    expect(mockPost).toHaveBeenCalledWith('/cupons/9/resgatar', {}, {
      'Idempotency-Key': expect.stringMatching(UUID_V4),
    });
    expect(screen.getByText('Novo saldo')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
    expect(screen.queryByText('ABCD2345')).toBeNull();
    expect(screen.getByLabelText('Seu saldo: 50 pontos')).toBeTruthy();
    // Saldo novo (50) não paga mais o cupom de 100
    expect(botoesResgatar()[0]).toBeDisabled();
    expect(screen.getByText('Faltam 50 pontos para resgatar')).toBeTruthy();
  });

  it('dois toques rápidos em confirmar mandam um resgate só', async () => {
    comApi(fralda, 1000);
    let responder: (valor: unknown) => void = () => {};
    mockPost.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const confirmar = await abrirConfirmacao();

    await tocarDuasVezes(confirmar);
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => responder(resgatado));
    expect(await screen.findByText('ABCD2345')).toBeTruthy();
  });

  it('cada resgate vai com uma chave de idempotência nova', async () => {
    comApi(fralda, 1000);
    mockPost.mockResolvedValue({ ...resgatado, saldo: 900 });
    await fireEvent.press(await abrirConfirmacao());
    await fireEvent.press(await screen.findByRole('button', { name: 'Concluir' }));

    await fireEvent.press(botoesResgatar()[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));
    await screen.findByText('ABCD2345');

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(chaveDoEnvio(0)).toMatch(UUID_V4);
    expect(chaveDoEnvio(1)).toMatch(UUID_V4);
    expect(chaveDoEnvio(1)).not.toBe(chaveDoEnvio(0));
  });

  it('tentar de novo depois da falha de rede repete a mesma chave, e a resposta (200) conclui o resgate', async () => {
    comApi(fralda, 150);
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(resgatado);
    await fireEvent.press(await abrirConfirmacao());

    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('ABCD2345')).toBeTruthy();
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(chaveDoEnvio(1)).toBe(chaveDoEnvio(0));
  });

  it('fechar depois da falha de rede e escolher o cupom de novo começa outro resgate, com chave nova', async () => {
    comApi(fralda, 150);
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(resgatado);
    await fireEvent.press(await abrirConfirmacao());
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }));

    await fireEvent.press(botoesResgatar()[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));

    expect(await screen.findByText('ABCD2345')).toBeTruthy();
    expect(chaveDoEnvio(1)).not.toBe(chaveDoEnvio(0));
  });

  it('durante o envio o botão fica desabilitado e não dá para cancelar', async () => {
    comApi(fralda, 150);
    mockPost.mockReturnValue(new Promise(() => {}));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByRole('button', { name: 'Resgatando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });

  it.each([
    [409, 'Pontos insuficientes'],
    [409, 'Cupom indisponível'],
    [404, 'Cupom não encontrado'],
  ])('erro %p "%s" mostra a mensagem da API, recarrega o produto e não oferece tentar de novo', async (status, mensagem) => {
    comApi(fralda, 150);
    mockPost.mockRejectedValue(new ApiError(status, mensagem));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText(`${mensagem}. As ofertas deste produto foram atualizadas.`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirmar resgate' })).toBeNull();
    // Carga inicial (2 chamadas) + recarga depois do erro (2 chamadas)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4));

    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText(mensagem, { exact: false })).toBeNull();
  });

  it('409 sem mensagem usa "Cupom indisponível"', async () => {
    comApi(fralda, 150);
    mockPost.mockRejectedValue(new ApiError(409));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText('Cupom indisponível. As ofertas deste produto foram atualizadas.')).toBeTruthy();
  });

  it('se o produto perdeu as ofertas, a recarga depois do erro mostra que não está mais disponível', async () => {
    comApi(fralda, 150);
    mockPost.mockRejectedValue(new ApiError(409, 'Cupom indisponível'));
    const confirmar = await abrirConfirmacao();
    comApi(new ApiError(404, 'Produto não encontrado'));

    await fireEvent.press(confirmar);
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }));

    expect(await screen.findByText('Este produto não tem mais ofertas disponíveis.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resgatar' })).toBeNull();
  });

  it('falha de rede mostra mensagem genérica e não recarrega', async () => {
    comApi(fralda, 150);
    mockPost.mockRejectedValue(new TypeError('Network request failed'));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText(/Verifique sua conexão e tente de novo/)).toBeTruthy();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('erro 500 não é tratado como cupom indisponível', async () => {
    comApi(fralda, 150);
    mockPost.mockRejectedValue(new ApiError(500));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText(/Não foi possível resgatar o cupom/)).toBeTruthy();
    expect(screen.queryByText(/foram atualizadas/)).toBeNull();
  });
});
