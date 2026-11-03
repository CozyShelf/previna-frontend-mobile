import { Stack } from 'expo-router';

import { Cores } from '@/constants/theme';

// O extrato abre por cima da pontuação sem esconder as abas
export default function PontosLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Cores.fundo } }} />;
}
