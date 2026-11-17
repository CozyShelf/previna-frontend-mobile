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
    codigo?: string;
    constructor(status: number, texto?: string, codigo?: string) {
      super(`Erro ${status}`);
      this.status = status;
      this.mensagem = texto;
      this.codigo = codigo;
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
    router: { back: jest.fn(), push: jest.fn() },
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
  promocoes: [
    { id: 3, titulo: 'Semana do bebê', desconto: 15, dataInicio: '2026-11-01', dataFim: '2026-11-30', resgatada: false },
  ],
};

const resgatado = {
  id: 1,
  codigo: 'ABCD2345',
  descricao: '10% de desconto em Fralda RN',
  empresa: 'Farmácia Vida',
  dataValidade: '2026-12-31',
  pontosGastos: 100,
  saldo: 50,
  tipo: 'CUPOM',
};

// Resgate de promoção: mesmo formato, sem pontos gastos e com o saldo de antes
const promocaoResgatada = {
  id: 2,
  codigo: 'PROMO777',
  descricao: '15% de desconto em Fraldas',
  empresa: 'Farmácia Vida',
  dataValidade: '2026-11-30',
  status: 'ATIVO',
  dataResgate: '2026-11-16T10:00:00',
  pontosGastos: 0,
  saldo: 150,
  tipo: 'PROMOCAO',
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
// Os cupons vêm antes da promoção na tela: o último "Resgatar" é o da promoção
const botaoResgatarPromocao = () => botoesResgatar().at(-1)!;

async function abrirConfirmacao() {
  await render(<ProdutoScreen />);
  await screen.findByText('Semana do bebê');
  await fireEvent.press(botoesResgatar()[0]);
  return screen.getByRole('button', { name: 'Confirmar resgate' });
}

async function abrirConfirmacaoPromocao(produto: ProdutoOfertaDetalhe = fralda) {
  comApi(produto, 150);
  await render(<ProdutoScreen />);
  await screen.findByText('Semana do bebê');
  await fireEvent.press(botaoResgatarPromocao());
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

  it('depois de um resgate concluído, o próximo do mesmo cupom vai com chave nova', async () => {
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

  it('fechar depois da falha de rede e reabrir o mesmo cupom repete a chave pendente', async () => {
    comApi(fralda, 150);
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(resgatado);
    await fireEvent.press(await abrirConfirmacao());
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }));

    await fireEvent.press(botoesResgatar()[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));

    expect(await screen.findByText('ABCD2345')).toBeTruthy();
    expect(chaveDoEnvio(1)).toBe(chaveDoEnvio(0));
  });

  it('com a chave de um cupom pendente, outro cupom vai com chave própria', async () => {
    comApi(fralda, 1000);
    mockPost.mockRejectedValueOnce(new ApiError(503)).mockResolvedValueOnce(resgatado);
    await fireEvent.press(await abrirConfirmacao());
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }));

    await fireEvent.press(botoesResgatar()[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));

    expect(await screen.findByText('ABCD2345')).toBeTruthy();
    expect(mockPost.mock.calls[1][0]).toBe('/cupons/10/resgatar');
    expect(chaveDoEnvio(1)).not.toBe(chaveDoEnvio(0));
  });

  it.each([
    [409, 'CUPOM_INDISPONIVEL'],
    [400, undefined],
  ])('erro %p encerra o resgate: reabrir o mesmo cupom vai com chave nova', async (status, codigo) => {
    comApi(fralda, 150);
    mockPost.mockRejectedValueOnce(new ApiError(status, undefined, codigo)).mockResolvedValueOnce(resgatado);
    await fireEvent.press(await abrirConfirmacao());
    // 4xx é resposta definitiva: não oferece tentar de novo
    await screen.findByText(/Cupom indisponível|Não foi possível resgatar/);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));

    await fireEvent.press((await screen.findAllByRole('button', { name: 'Resgatar' }))[0]);
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
    [409, 'Pontos insuficientes', 'PONTOS_INSUFICIENTES'],
    [409, 'Cupom indisponível', 'CUPOM_INDISPONIVEL'],
    [404, 'Cupom não encontrado', undefined],
  ])('erro %p "%s" mostra a mensagem da API, recarrega o produto e não oferece tentar de novo', async (status, mensagem, codigo) => {
    comApi(fralda, 150);
    mockPost.mockRejectedValue(new ApiError(status, mensagem, codigo));
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
    mockPost.mockRejectedValue(new ApiError(409, undefined, 'CUPOM_INDISPONIVEL'));
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText('Cupom indisponível. As ofertas deste produto foram atualizadas.')).toBeTruthy();
  });

  it('se o produto perdeu as ofertas, a recarga depois do erro mostra que não está mais disponível', async () => {
    comApi(fralda, 150);
    mockPost.mockRejectedValue(new ApiError(409, 'Cupom indisponível', 'CUPOM_INDISPONIVEL'));
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

describe('resgate de promoção', () => {
  it('cartão mostra que é grátis e o botão Resgatar', async () => {
    comApi(fralda);
    await render(<ProdutoScreen />);
    await screen.findByText('Semana do bebê');

    expect(screen.getByText('Grátis — não usa seus pontos')).toBeTruthy();
    expect(botoesResgatar()).toHaveLength(3);
    expect(botaoResgatarPromocao()).toBeEnabled();
  });

  it('promoção já resgatada fica com o botão "Já resgatada" desabilitado', async () => {
    comApi({ ...fralda, promocoes: [{ ...fralda.promocoes[0], resgatada: true }] });
    await render(<ProdutoScreen />);

    expect(await screen.findByRole('button', { name: 'Já resgatada' })).toBeDisabled();
    // Só os dois cupons continuam resgatáveis
    expect(botoesResgatar()).toHaveLength(2);
  });

  it('confirmação diz que é grátis e que o saldo continua; cancelar não resgata', async () => {
    await abrirConfirmacaoPromocao();

    expect(screen.getByText('Resgatar promoção?')).toBeTruthy();
    expect(screen.getByText(/Semana do bebê: 15% de desconto na Farmácia Vida. Válida até 30\/11\/2026/)).toBeTruthy();
    expect(screen.getByText('Grátis')).toBeTruthy();
    expect(screen.getByText('Seu saldo continua')).toBeTruthy();
    expect(screen.getByText('Você só pode resgatar esta promoção uma vez.')).toBeTruthy();
    expect(screen.queryByText(/Custo do cupom/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Resgatar promoção?')).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('resgate válido mostra o código, não fala em pontos e marca a promoção como resgatada', async () => {
    mockPost.mockResolvedValue(promocaoResgatada);
    await fireEvent.press(await abrirConfirmacaoPromocao());

    expect(await screen.findByText('PROMO777')).toBeTruthy();
    expect(mockPost).toHaveBeenCalledWith('/promocoes/3/resgatar', {}, {
      'Idempotency-Key': expect.stringMatching(UUID_V4),
    });
    expect(screen.getByText('Promoção resgatada!')).toBeTruthy();
    expect(screen.getByText('Código da promoção')).toBeTruthy();
    expect(screen.getByText('Grátis: seus pontos continuam os mesmos.')).toBeTruthy();
    expect(screen.queryByText('Pontos usados')).toBeNull();
    expect(screen.queryByText('Novo saldo')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
    expect(screen.queryByText('PROMO777')).toBeNull();
    // Sem débito: o saldo continua o mesmo e os cupons que ele pagava continuam resgatáveis
    expect(screen.getByLabelText('Seu saldo: 150 pontos')).toBeTruthy();
    expect(botoesResgatar()[0]).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Já resgatada' })).toBeDisabled();
  });

  it('o saldo da tela não muda mesmo se a resposta trouxer outro', async () => {
    mockPost.mockResolvedValue({ ...promocaoResgatada, saldo: 0 });
    await fireEvent.press(await abrirConfirmacaoPromocao());
    await fireEvent.press(await screen.findByRole('button', { name: 'Concluir' }));

    expect(screen.getByLabelText('Seu saldo: 150 pontos')).toBeTruthy();
  });

  it('dois toques rápidos em confirmar mandam um resgate só', async () => {
    let responder: (valor: unknown) => void = () => {};
    mockPost.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const confirmar = await abrirConfirmacaoPromocao();

    await tocarDuasVezes(confirmar);
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => responder(promocaoResgatada));
    expect(await screen.findByText('PROMO777')).toBeTruthy();
  });

  it('tentar de novo depois da falha de rede repete a mesma chave; resposta sem "tipo" também vale', async () => {
    const { tipo, ...semTipo } = promocaoResgatada;
    expect(tipo).toBe('PROMOCAO');
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(semTipo);
    await fireEvent.press(await abrirConfirmacaoPromocao());

    expect(await screen.findByText(/Não foi possível resgatar a promoção. Verifique sua conexão/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('PROMO777')).toBeTruthy();
    expect(screen.getByText('Promoção resgatada!')).toBeTruthy();
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(chaveDoEnvio(1)).toBe(chaveDoEnvio(0));
  });

  it('fechar depois de um 503 e reabrir a promoção repete a chave pendente', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(503)).mockResolvedValueOnce(promocaoResgatada);
    await fireEvent.press(await abrirConfirmacaoPromocao());
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }));

    await fireEvent.press(botaoResgatarPromocao());
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));

    expect(await screen.findByText('PROMO777')).toBeTruthy();
    expect(chaveDoEnvio(1)).toBe(chaveDoEnvio(0));
  });

  it('depois de uma resposta definitiva (409), o próximo resgate vai com chave nova', async () => {
    mockPost
      .mockRejectedValueOnce(new ApiError(409, 'Promoção indisponível', 'PROMOCAO_INDISPONIVEL'))
      .mockResolvedValueOnce(promocaoResgatada);
    await fireEvent.press(await abrirConfirmacaoPromocao());
    await screen.findByText(/Promoção indisponível/);
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));

    await fireEvent.press(botaoResgatarPromocao());
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));

    expect(await screen.findByText('PROMO777')).toBeTruthy();
    expect(chaveDoEnvio(0)).toMatch(UUID_V4);
    expect(chaveDoEnvio(1)).toMatch(UUID_V4);
    expect(chaveDoEnvio(1)).not.toBe(chaveDoEnvio(0));
  });

  it.each([
    'Promoção já resgatada',
    // Outro texto com o mesmo código: a decisão não depende da mensagem
    'Você já usou esta oferta',
  ])('409 PROMOCAO_JA_RESGATADA ("%s") avisa a gestante e marca o cartão como resgatado', async (mensagem) => {
    mockPost.mockRejectedValue(new ApiError(409, mensagem, 'PROMOCAO_JA_RESGATADA'));
    await fireEvent.press(await abrirConfirmacaoPromocao());

    expect(
      await screen.findByText('Você já resgatou esta promoção. Cada promoção só pode ser resgatada uma vez.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.getByRole('button', { name: 'Já resgatada' })).toBeDisabled();
    expect(screen.getByLabelText('Seu saldo: 150 pontos')).toBeTruthy();
  });

  it.each([
    [409, 'Promoção indisponível', 'PROMOCAO_INDISPONIVEL'],
    [404, 'Promoção não encontrada', undefined],
  ])('erro %p "%s" mostra a mensagem, recarrega o produto e não oferece tentar de novo', async (status, mensagem, codigo) => {
    mockPost.mockRejectedValue(new ApiError(status, mensagem, codigo));
    await fireEvent.press(await abrirConfirmacaoPromocao());

    expect(await screen.findByText(`${mensagem}. As ofertas deste produto foram atualizadas.`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar resgate' })).toBeNull();
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4));
    // Indisponível não é "já resgatada": o cartão continua como estava
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('button', { name: 'Já resgatada' })).toBeNull();
  });

  it('409 com o texto "Promoção já resgatada" mas sem o código não marca o cartão: só o código decide', async () => {
    mockPost.mockRejectedValue(new ApiError(409, 'Promoção já resgatada'));
    await fireEvent.press(await abrirConfirmacaoPromocao());

    expect(await screen.findByText('Promoção já resgatada. As ofertas deste produto foram atualizadas.')).toBeTruthy();
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4));
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('button', { name: 'Já resgatada' })).toBeNull();
  });

  it('409 sem mensagem usa "Promoção indisponível"', async () => {
    mockPost.mockRejectedValue(new ApiError(409, undefined, 'PROMOCAO_INDISPONIVEL'));
    await fireEvent.press(await abrirConfirmacaoPromocao());

    expect(await screen.findByText('Promoção indisponível. As ofertas deste produto foram atualizadas.')).toBeTruthy();
  });

  it('erro 500 oferece tentar de novo e não recarrega', async () => {
    mockPost.mockRejectedValue(new ApiError(500));
    await fireEvent.press(await abrirConfirmacaoPromocao());

    expect(await screen.findByText(/Não foi possível resgatar a promoção/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('cupom e promoção com o mesmo id têm chaves pendentes separadas', async () => {
    // Cupom 3 e promoção 3: ids de tabelas diferentes
    const mesmoId: ProdutoOfertaDetalhe = {
      ...fralda,
      cupons: [{ id: 3, desconto: 10, pontosNecessarios: 100, dataValidade: '2026-12-31' }],
    };
    mockPost
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(promocaoResgatada)
      .mockResolvedValueOnce(resgatado);
    comApi(mesmoId, 150);
    await render(<ProdutoScreen />);
    await screen.findByText('Semana do bebê');

    // Cupom 3 falha na rede: a chave dele fica pendente
    await fireEvent.press(botoesResgatar()[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }));

    // Promoção 3 não herda a chave do cupom 3
    await fireEvent.press(botaoResgatarPromocao());
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Concluir' }));

    // E o cupom 3 continua com a chave dele, que o resgate da promoção não apagou
    await fireEvent.press(botoesResgatar()[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar resgate' }));
    expect(await screen.findByText('ABCD2345')).toBeTruthy();

    expect(mockPost.mock.calls.map((chamada) => chamada[0])).toEqual([
      '/cupons/3/resgatar',
      '/promocoes/3/resgatar',
      '/cupons/3/resgatar',
    ]);
    expect(chaveDoEnvio(1)).not.toBe(chaveDoEnvio(0));
    expect(chaveDoEnvio(2)).toBe(chaveDoEnvio(0));
  });
});

describe('depois de resgatar', () => {
  it('"Ver código" fecha o diálogo e abre o detalhe do cupom resgatado', async () => {
    comApi(fralda, 150);
    mockPost.mockResolvedValue(resgatado);
    await fireEvent.press(await abrirConfirmacao());

    expect(await screen.findByText('Você também encontra este código em Cupons resgatados.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver código' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/cupons/resgatado/[id]', params: { id: '1' } });
    expect(screen.queryByText('ABCD2345')).toBeNull();
  });

  it('"Ver código" da promoção abre o detalhe pelo id do resgate', async () => {
    mockPost.mockResolvedValue(promocaoResgatada);
    await fireEvent.press(await abrirConfirmacaoPromocao());

    await fireEvent.press(await screen.findByRole('button', { name: 'Ver código' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/cupons/resgatado/[id]', params: { id: '2' } });
    expect(screen.getByRole('button', { name: 'Já resgatada' })).toBeDisabled();
  });
});
