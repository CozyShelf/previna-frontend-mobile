import { Stack } from 'expo-router';

import { Cores } from '@/constants/theme';

// O "Ver todos" de uma empresa e os detalhes do produto e do resgate abrem por cima da lista sem esconder as abas.
// A Loja e os resgatados trocam de lugar (router.replace) sem animação, como abas.
export default function CuponsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Cores.fundo } }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="resgatados" options={{ animation: 'none' }} />
    </Stack>
  );
}
