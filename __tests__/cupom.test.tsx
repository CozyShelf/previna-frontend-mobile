/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  agruparPorLoja,
  formatarData,
  formatarDesconto,
  formatarPontos,
  SecaoLoja,
  type CupomDisponivel,
} from '@/components/cupom';

jest.mock('@/lib/api', () => ({ imagemDaApi: (caminho: string) => ({ uri: caminho }) }));

function cupom(id: number, empresa: { id: number; nome: string }, pontos: number): CupomDisponivel {
  return {
    id,
    descricao: `10% de desconto em Produto ${id}`,
    produto: `Produto ${id}`,
    categoria: 'FRALDAS',
    desconto: 10,
    dataValidade: '2026-12-31',
    pontosNecessarios: pontos,
    empresa,
  };
}

const vida = { id: 1, nome: 'Farmácia Vida' };
const avora = { id: 2, nome: 'Ávora Baby' };
const bebe = { id: 3, nome: 'Bebê & Cia' };

describe('agruparPorLoja', () => {
  it('junta os cupons da mesma empresa mantendo a ordem da API (os mais baratos primeiro)', async () => {
    const lojas = agruparPorLoja([cupom(1, vida, 10), cupom(2, avora, 20), cupom(3, vida, 30)]);

    const daVida = lojas.find((loja) => loja.empresa.id === 1)!;
    expect(daVida.cupons.map((c) => c.id)).toEqual([1, 3]);
    expect(lojas).toHaveLength(2);
  });

  it('ordena as lojas pelo nome, com acento no lugar certo', async () => {
    // "Ávora" vem antes de "Bebê" e de "Farmácia"; comparando por código de caractere, iria para o fim
    const lojas = agruparPorLoja([cupom(1, vida, 10), cupom(2, bebe, 10), cupom(3, avora, 10)]);

    expect(lojas.map((loja) => loja.empresa.nome)).toEqual(['Ávora Baby', 'Bebê & Cia', 'Farmácia Vida']);
  });

  it('agrupa pelo id, e não pelo nome: duas empresas com o mesmo nome ficam separadas', async () => {
    const lojas = agruparPorLoja([cupom(1, vida, 10), cupom(2, { id: 9, nome: 'Farmácia Vida' }, 10)]);

    expect(lojas).toHaveLength(2);
  });

  it('lista vazia não tem lojas', async () => {
    expect(agruparPorLoja([])).toEqual([]);
  });
});

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

  it('data da API (aaaa-mm-dd) vira dd/mm/aaaa sem passar por fuso', async () => {
    // new Date('2026-01-01') seria meia-noite UTC: no Brasil viraria 31/12/2025
    expect(formatarData('2026-01-01')).toBe('01/01/2026');
  });
});

describe('SecaoLoja', () => {
  const loja = { empresa: vida, cupons: [cupom(1, vida, 100)] };

  it('com saldo igual ao custo mostra o botão de resgatar', async () => {
    const onResgatar = jest.fn();
    await render(<SecaoLoja loja={loja} saldo={100} onResgatar={onResgatar} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Resgatar' }));
    expect(onResgatar).toHaveBeenCalledWith(loja.cupons[0]);
  });

  it('sem saldo suficiente não mostra o botão e diz quanto falta', async () => {
    await render(<SecaoLoja loja={loja} saldo={99} onResgatar={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Resgatar' })).toBeNull();
    expect(screen.getByText('Faltam 1 ponto')).toBeTruthy();
  });

  it('mostra o nome da loja, a quantidade no singular e a inicial sem logo', async () => {
    await render(<SecaoLoja loja={loja} saldo={0} onResgatar={jest.fn()} />);

    expect(screen.getByText('Farmácia Vida')).toBeTruthy();
    expect(screen.getByText('1 cupom')).toBeTruthy();
    expect(screen.getByText('F')).toBeTruthy();
  });

  it('mostra desconto, categoria, validade e custo de cada cupom', async () => {
    await render(<SecaoLoja loja={loja} saldo={0} onResgatar={jest.fn()} />);

    expect(screen.getByText('10% de desconto')).toBeTruthy();
    expect(screen.getByText('Fraldas · Válido até 31/12/2026')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
  });
});
