import { Stack } from 'expo-router';

import { Cores } from '@/constants/theme';

// As consultas, o histórico e o detalhe do conteúdo abrem por cima da tela inicial sem esconder as abas
export default function InicioLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Cores.fundo } }} />;
}
