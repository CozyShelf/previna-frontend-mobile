/// <reference types="jest" />

import { gerarChaveIdempotencia } from '@/lib/idempotencia';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const criptoOriginal = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

function comCripto(cripto: object | undefined) {
  Object.defineProperty(globalThis, 'crypto', { value: cripto, configurable: true, writable: true });
}

afterEach(() => {
  if (criptoOriginal) {
    Object.defineProperty(globalThis, 'crypto', criptoOriginal);
  }
});

it('usa o randomUUID do runtime quando existe', () => {
  comCripto({ randomUUID: () => '3b241101-e2bb-4255-8caf-4136c566a962' });

  expect(gerarChaveIdempotencia()).toBe('3b241101-e2bb-4255-8caf-4136c566a962');
});

it('sem randomUUID monta o UUID v4 com getRandomValues', () => {
  comCripto({ getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff) });

  expect(gerarChaveIdempotencia()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
});

it('sem crypto cai no Math.random e ainda gera UUID v4, um diferente a cada chamada', () => {
  comCripto(undefined);

  const chaves = new Set(Array.from({ length: 50 }, gerarChaveIdempotencia));
  expect(chaves.size).toBe(50);
  for (const chave of chaves) {
    expect(chave).toMatch(UUID_V4);
  }
});
