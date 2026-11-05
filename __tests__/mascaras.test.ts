/// <reference types="jest" />

import { mascararTelefone, somenteDigitos } from '@/lib/mascaras';

describe('somenteDigitos', () => {
  it('remove tudo o que não é dígito', () => {
    expect(somenteDigitos('(11) 98765-4321')).toBe('11987654321');
    expect(somenteDigitos('R$ 2.500,00')).toBe('250000');
    expect(somenteDigitos('abc')).toBe('');
  });
});

describe('mascararTelefone', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['11', '11'],
    ['119', '(11) 9'],
    ['1198765', '(11) 98765'],
    ['1123456789', '(11) 2345-6789'],
    ['11987654321', '(11) 98765-4321'],
  ])('%p vira %p', (entrada, saida) => {
    expect(mascararTelefone(entrada)).toBe(saida);
  });

  it('remascara um valor já mascarado (edição no campo)', () => {
    expect(mascararTelefone('(11) 2345-67890')).toBe('(11) 23456-7890');
  });

  it('corta no 11º dígito', () => {
    expect(mascararTelefone('119876543219999')).toBe('(11) 98765-4321');
  });
});
