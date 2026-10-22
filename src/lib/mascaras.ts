export function somenteDigitos(texto: string) {
  return texto.replace(/\D/g, '');
}

// Mesma máscara do previna-frontend: 10 dígitos -> (11) 2345-6789; 11 dígitos -> (11) 98765-4321
export function mascararTelefone(valor: string) {
  return somenteDigitos(valor)
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2');
}
