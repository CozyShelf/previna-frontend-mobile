// Chave de idempotência (UUID v4) para o header Idempotency-Key: o servidor guarda o resultado da primeira
// requisição com a chave e devolve o mesmo resultado nas repetições, sem gravar de novo.
//
// Usa o crypto do runtime quando existe; o Hermes nem sempre tem, e aí cai no Math.random. A chave só precisa
// ser única entre as requisições da própria gestante, não imprevisível, então isso basta.
export function gerarChaveIdempotencia(): string {
  const cripto = globalThis.crypto;
  if (typeof cripto?.randomUUID === 'function') {
    return cripto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof cripto?.getRandomValues === 'function') {
    cripto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Versão 4 e variante RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
