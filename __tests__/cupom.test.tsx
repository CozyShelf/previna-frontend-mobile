/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  CartaoCupom,
  CartaoProduto,
  CartaoPromocao,
  FotoProduto,
  formatarData,
  formatarDesconto,
  formatarPontos,
  LogoEmpresa,
  OfertaAusente,
  Saldo,
  SecaoEmpresa,
  selosDoProduto,
} from '@/components/cupom';
import type { OfertaEmpresa, ProdutoOfertaResumo } from '@/lib/ofertas';

jest.mock('@/lib/api', () => ({ imagemDaApi: (caminho: string) => ({ uri: caminho }) }));

function produto(id: number, extra: Partial<ProdutoOfertaResumo> = {}): ProdutoOfertaResumo {
  return {
    id,
    nome: `Produto ${id}`,
    categoria: 'FRALDAS',
    imagem: null,
    menorPontos: 120,
    maiorDescontoCupom: 10,
    descontoPromocao: null,
    ...extra,
  };
}

function oferta(produtos: ProdutoOfertaResumo[], totalProdutos = produtos.length): OfertaEmpresa {
  return { id: 1, nome: 'Farmácia Vida', segmento: 'Farmácia', logo: null, totalProdutos, produtos };
}

describe('formatação', () => {
  it.each([
    [10, '10%'],
    [12.5, '12,5%'],
    [100, '100%'],
    [0.75, '0,75%'],
  ])('desconto %p vira %p', (desconto, esperado) => {
    expect(formatarDesconto(desconto)).toBe(esperado);
  });

  it.each([
    [0, '0 pontos'],
    [1, '1 ponto'],
    [2, '2 pontos'],
  ])('%p pontos vira %p', (pontos, esperado) => {
    expect(formatarPontos(pontos)).toBe(esperado);
  });

  it('data da API (aaaa-mm-dd) vira dd/mm/aaaa sem passar por fuso', () => {
    // new Date('2026-01-01') seria meia-noite UTC: no Brasil viraria 31/12/2025
    expect(formatarData('2026-01-01')).toBe('01/01/2026');
  });
});

describe('selosDoProduto', () => {
  it('cupom e promoção', () => {
    expect(selosDoProduto(produto(1, { menorPontos: 80, descontoPromocao: 15 }))).toEqual([
      'Cupom · a partir de 80 pts',
      'Promoção 15%',
    ]);
  });

  it('só promoção', () => {
    expect(selosDoProduto(produto(1, { menorPontos: null, descontoPromocao: 12.5 }))).toEqual(['Promoção 12,5%']);
  });

  it('só cupom, mesmo de 0 pontos', () => {
    expect(selosDoProduto(produto(1, { menorPontos: 0 }))).toEqual(['Cupom · a partir de 0 pts']);
  });
});

describe('CartaoProduto', () => {
  it('mostra nome e selos e abre o produto ao tocar', async () => {
    const onAbrir = jest.fn();
    const item = produto(5, { descontoPromocao: 15 });
    await render(<CartaoProduto produto={item} onAbrir={onAbrir} />);

    expect(screen.getByText('Produto 5')).toBeTruthy();
    expect(screen.getByText('Cupom · a partir de 120 pts')).toBeTruthy();
    expect(screen.getByText('Promoção 15%')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Produto 5, cupom a partir de 120 pontos, promoção de 15% de desconto',
      }),
    );
    expect(onAbrir).toHaveBeenCalledWith(item);
  });

  it('na grade ocupa a coluna', async () => {
    await render(<CartaoProduto produto={produto(1)} onAbrir={jest.fn()} largura="coluna" />);

    expect(screen.getByRole('button')).toHaveStyle({ flex: 1 });
  });
});

describe('SecaoEmpresa', () => {
  it('mostra logo (inicial), nome, segmento, quantidade e o carrossel de produtos', async () => {
    await render(
      <SecaoEmpresa oferta={oferta([produto(1), produto(2)])} onAbrirProduto={jest.fn()} onVerTodos={jest.fn()} />,
    );

    expect(screen.getByRole('header', { name: 'Farmácia Vida, 2 produtos' })).toBeTruthy();
    expect(screen.getByText('F')).toBeTruthy();
    expect(screen.getByText('Farmácia · 2 produtos')).toBeTruthy();
    expect(screen.getByText('Produto 1')).toBeTruthy();
    expect(screen.getByText('Produto 2')).toBeTruthy();
  });

  it('sem mais produtos que os exibidos não mostra "Ver todos"', async () => {
    await render(<SecaoEmpresa oferta={oferta([produto(1)])} onAbrirProduto={jest.fn()} onVerTodos={jest.fn()} />);

    expect(screen.getByText('Farmácia · 1 produto')).toBeTruthy();
    expect(screen.queryByText('Ver todos')).toBeNull();
  });

  it('com mais produtos mostra "Ver todos"', async () => {
    const onVerTodos = jest.fn();
    const dados = { ...oferta([produto(1)], 14), segmento: null };
    await render(<SecaoEmpresa oferta={dados} onAbrirProduto={jest.fn()} onVerTodos={onVerTodos} />);

    expect(screen.getByText('14 produtos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todos os 14 produtos de Farmácia Vida' }));
    expect(onVerTodos).toHaveBeenCalledWith(dados);
  });

  it('tocar num produto do carrossel abre o produto', async () => {
    const onAbrirProduto = jest.fn();
    await render(
      <SecaoEmpresa oferta={oferta([produto(1), produto(2)])} onAbrirProduto={onAbrirProduto} onVerTodos={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText('Produto 2'));
    expect(onAbrirProduto).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });
});

describe('imagens', () => {
  it('logo da empresa vem da API, sem a inicial no lugar', async () => {
    await render(<LogoEmpresa empresa={{ id: 1, nome: 'Loja', segmento: null, logo: '/empresas/1/logo' }} />);

    expect(screen.queryByText('L')).toBeNull();
  });

  it.each(['pequena', 'grande'] as const)('foto %s do produto: da API ou, sem foto, uma etiqueta', async (tamanho) => {
    const { rerender } = await render(<FotoProduto imagem="/produtos/1/imagem" tamanho={tamanho} />);
    expect(screen.toJSON()).toBeTruthy();

    await rerender(<FotoProduto imagem={null} tamanho={tamanho} />);
    expect(screen.toJSON()).toBeTruthy();
  });
});

describe('CartaoCupom', () => {
  const cupom = { id: 9, desconto: 10, pontosNecessarios: 100, dataValidade: '2026-12-31' };

  it('com saldo igual ao custo o botão de resgatar fica habilitado', async () => {
    const onResgatar = jest.fn();
    await render(<CartaoCupom cupom={cupom} saldo={100} onResgatar={onResgatar} />);

    expect(screen.getByText('10% de desconto')).toBeTruthy();
    expect(screen.getByText('Válido até 31/12/2026')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.queryByText(/Faltam/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Resgatar' }));
    expect(onResgatar).toHaveBeenCalledWith(cupom);
  });

  it('sem saldo suficiente o botão fica desabilitado e diz quanto falta', async () => {
    const onResgatar = jest.fn();
    await render(<CartaoCupom cupom={cupom} saldo={99} onResgatar={onResgatar} />);

    expect(screen.getByRole('button', { name: 'Resgatar' })).toBeDisabled();
    expect(screen.getByText('Faltam 1 ponto para resgatar')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Resgatar' }));
    expect(onResgatar).not.toHaveBeenCalled();
  });

  it('cupom de 1 ponto no singular', async () => {
    await render(<CartaoCupom cupom={{ ...cupom, pontosNecessarios: 1 }} saldo={5} onResgatar={jest.fn()} />);

    expect(screen.getByText('ponto')).toBeTruthy();
  });
});

it('CartaoPromocao mostra percentual, título e validade, sem pontos', async () => {
  await render(
    <CartaoPromocao
      promocao={{ id: 3, titulo: 'Semana do bebê', desconto: 15, dataInicio: '2026-11-01', dataFim: '2026-11-30' }}
    />,
  );

  expect(screen.getByText('Promoção 15%')).toBeTruthy();
  expect(screen.getByText('Semana do bebê')).toBeTruthy();
  expect(screen.getByText('Válida até 30/11/2026')).toBeTruthy();
  expect(screen.getByText(/sem gastar pontos/)).toBeTruthy();
});

it('OfertaAusente aparece desabilitada', async () => {
  await render(<OfertaAusente texto="Sem cupom no momento" />);

  expect(screen.getByLabelText('Sem cupom no momento')).toBeDisabled();
});

it('Saldo mostra os pontos', async () => {
  await render(<Saldo saldo={1} />);

  expect(screen.getByLabelText('Seu saldo: 1 ponto')).toBeTruthy();
});
