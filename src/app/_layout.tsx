import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { Raleway_700Bold } from '@expo-google-fonts/raleway';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { Cores } from '@/constants/theme';
import { restaurarSessao } from '@/lib/sessao';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [carregadas, erro] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    Raleway_700Bold,
  });
  const [sessaoRestaurada, setSessaoRestaurada] = useState(false);
  const pronto = (carregadas || erro) && sessaoRestaurada;

  useEffect(() => {
    restaurarSessao().finally(() => setSessaoRestaurada(true));
  }, []);

  useEffect(() => {
    if (pronto) {
      SplashScreen.hideAsync();
    }
  }, [pronto]);

  if (!pronto) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Cores.fundo } }} />
  );
}
