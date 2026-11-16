import { Stack } from 'expo-router';

import { Cores } from '@/constants/theme';

// O "Ver todos" de uma empresa e o detalhe do produto abrem por cima da lista sem esconder as abas
export default function CuponsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Cores.fundo } }} />;
}
