import { Redirect, Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Cores, Fontes } from '@/constants/theme';
import { obterToken } from '@/lib/sessao';

export default function AbasLayout() {
  if (!obterToken()) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Cores.previna600,
        tabBarInactiveTintColor: Cores.textoSecundario,
        tabBarLabelStyle: { fontFamily: Fontes.media },
      }}>
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'house.fill', android: 'home', web: 'home' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'person.fill', android: 'person', web: 'person' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
