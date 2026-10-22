// Mesmos tokens do previna-frontend (src/index.css e paleta zinc/red do Tailwind).
export const Cores = {
  previna50: '#fff1f1',
  previna600: '#d93a45',
  previna700: '#b82e39',
  fundo: '#ffffff',
  fundoSutil: '#fafafa',
  texto: '#18181b',
  rotulo: '#3f3f46',
  textoSecundario: '#52525b',
  placeholder: '#a1a1aa',
  borda: '#d4d4d8',
  erro: '#b91c1c',
  erroFundo: '#fef2f2',
  erroBorda: '#fecaca',
} as const;

export const Fontes = {
  regular: 'IBMPlexSans_400Regular',
  media: 'IBMPlexSans_500Medium',
  seminegrito: 'IBMPlexSans_600SemiBold',
  marca: 'Raleway_700Bold',
} as const;

export const Espaco = {
  um: 4,
  dois: 8,
  tres: 12,
  quatro: 16,
  cinco: 20,
  seis: 24,
  oito: 32,
} as const;

export const Raio = 6;
// 48 em vez dos 36px do desktop: alvo de toque mínimo no celular
export const AlturaControle = 48;
