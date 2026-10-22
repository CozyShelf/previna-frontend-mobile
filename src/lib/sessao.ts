import * as SecureStore from 'expo-secure-store';

const CHAVE_TOKEN = 'previna.token';

let token: string | null = null;

function decodificar(jwt: string): { perfil: string; exp: number } {
  const payload = (jwt.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload));
}

function expirado(jwt: string) {
  try {
    return decodificar(jwt).exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function perfilDoToken(jwt: string) {
  return decodificar(jwt).perfil;
}

// Só em memória: a sessão é lembrada no aparelho depois do primeiro acesso e do tutorial
export function iniciarSessao(novo: string) {
  token = novo;
}

export async function lembrarSessao() {
  if (token) {
    await SecureStore.setItemAsync(CHAVE_TOKEN, token).catch(() => {});
  }
}

export async function restaurarSessao() {
  const salvo = await SecureStore.getItemAsync(CHAVE_TOKEN).catch(() => null);
  if (salvo && !expirado(salvo)) {
    token = salvo;
  } else if (salvo) {
    await encerrarSessao();
  }
}

export function obterToken() {
  return token;
}

export async function encerrarSessao() {
  token = null;
  await SecureStore.deleteItemAsync(CHAVE_TOKEN).catch(() => {});
}
