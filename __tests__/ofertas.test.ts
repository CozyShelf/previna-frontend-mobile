/// <reference types="jest" />

import { get } from '@/lib/api';
import {
  buscarSaldo,
  comFiltros,
  descreverFiltros,
  filtrosParaParametros,
  parametrosParaFiltros,
  temFiltro,
} from '@/lib/ofertas';

jest.mock('@/lib/api', () => ({ get: jest.fn() }));

describe('comFiltros', () => {
  it('sem filtros não acrescenta query string', () => {
    expect(comFiltros('/ofertas', {})).toBe('/ofertas');
  });

  it('manda cada filtro com o nome do contrato da API', () => {
    expect(
      comFiltros('/ofertas', { busca: 'fralda rn', categoria: 'FRALDAS', tipo: 'CUPOM', ateMeusPontos: true }),
    ).toBe('/ofertas?busca=fralda+rn&categoria=FRALDAS&tipo=CUPOM&ateMeusPontos=true');
  });

  it('busca só com espaços não vai, e a busca vai sem os espaços das pontas', () => {
    expect(comFiltros('/ofertas', { busca: '   ' })).toBe('/ofertas');
    expect(comFiltros('/ofertas', { busca: '  loja  ' })).toBe('/ofertas?busca=loja');
  });

  it('codifica caracteres especiais da busca', () => {
    expect(comFiltros('/ofertas', { busca: 'Bebê & Cia' })).toBe('/ofertas?busca=Beb%C3%AA+%26+Cia');
  });

  it('"Cabe no meu saldo" desmarcado não vai', () => {
    expect(comFiltros('/ofertas', { ateMeusPontos: false })).toBe('/ofertas');
  });
});

describe('temFiltro', () => {
  it.each([
    [{}, false],
    [{ busca: '  ' }, false],
    [{ busca: 'x' }, true],
    [{ categoria: 'ROUPAS' as const }, true],
    [{ tipo: 'PROMOCAO' as const }, true],
    [{ ateMeusPontos: true }, true],
  ])('%p -> %p', (filtros, esperado) => {
    expect(temFiltro(filtros)).toBe(esperado);
  });
});

describe('filtros como parâmetros de rota', () => {
  it('vão e voltam iguais', () => {
    const filtros = { busca: 'fralda', categoria: 'REMEDIOS' as const, tipo: 'PROMOCAO' as const, ateMeusPontos: true };

    const parametros = filtrosParaParametros(filtros);

    expect(parametros).toEqual({ busca: 'fralda', categoria: 'REMEDIOS', tipo: 'PROMOCAO', ateMeusPontos: 'true' });
    expect(parametrosParaFiltros(parametros)).toEqual(filtros);
  });

  it('filtros vazios não viram parâmetros', () => {
    expect(filtrosParaParametros({ busca: ' ', ateMeusPontos: false })).toEqual({});
  });

  it('valores fora do esperado são ignorados', () => {
    expect(
      parametrosParaFiltros({ busca: '  ', categoria: 'BRINQUEDOS', tipo: 'outro', ateMeusPontos: 'sim' }),
    ).toEqual({ busca: undefined, categoria: undefined, tipo: undefined, ateMeusPontos: undefined });
  });
});

describe('descreverFiltros', () => {
  it('junta os filtros ativos em uma linha', () => {
    expect(
      descreverFiltros({ busca: 'fralda', categoria: 'FRALDAS', tipo: 'CUPOM', ateMeusPontos: true }),
    ).toBe('“fralda” · Fraldas · Cupons · Cabe no meu saldo');
  });

  it('promoção no plural', () => {
    expect(descreverFiltros({ tipo: 'PROMOCAO' })).toBe('Promoções');
  });
});

it('buscarSaldo devolve só o saldo da pontuação', async () => {
  (get as jest.Mock).mockResolvedValue({ saldo: 120, atividades: [] });

  await expect(buscarSaldo()).resolves.toBe(120);
  expect(get).toHaveBeenCalledWith('/gestantes/pontuacao');
});
