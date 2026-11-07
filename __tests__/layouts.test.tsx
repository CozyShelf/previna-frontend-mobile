/// <reference types="jest" />

import { act, render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import type { ReactNode } from 'react';

import AbasLayout from '@/app/(abas)/_layout';
import RootLayout from '@/app/_layout';
import InicioLayout from '@/app/(abas)/inicio/_layout';
import PontosLayout from '@/app/(abas)/pontos/_layout';
import { obterToken, restaurarSessao } from '@/lib/sessao';

jest.mock('@/lib/sessao', () => ({ obterToken: jest.fn(), restaurarSessao: jest.fn() }));

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-symbols', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    SymbolView: ({ name, tintColor }: { name: { android: string }; tintColor: string }) => (
      <Text>{`ícone ${name.android} ${tintColor}`}</Text>
    ),
  };
});

interface OpcoesAba {
  title: string;
  tabBarIcon: (p: { color: string; size: number; focused: boolean }) => ReactNode;
}

// Navegadores falsos: mostram o que receberam, e as abas desenham o próprio ícone
jest.mock('expo-router', () => {
  const { Text, View } = jest.requireActual('react-native');
  const Tabs = ({ children }: { children: ReactNode }) => <View>{children}</View>;
  Tabs.Screen = ({ name, options }: { name: string; options: OpcoesAba }) => (
    <View>
      <Text>{`aba ${name}: ${options.title}`}</Text>
      {options.tabBarIcon({ color: 'cinza', size: 24, focused: false })}
    </View>
  );
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`Redirecionou para ${href}`}</Text>,
    Stack: () => <Text>Pilha de telas</Text>,
    Tabs,
  };
});

const mockUseFonts = useFonts as jest.Mock;
const mockRestaurar = restaurarSessao as jest.Mock;
const mockObterToken = obterToken as jest.Mock;

// Chamado ao carregar o módulo, antes de qualquer limpeza dos mocks
const segurouSplash = (SplashScreen.preventAutoHideAsync as jest.Mock).mock.calls.length;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFonts.mockReturnValue([true, null]);
  mockRestaurar.mockResolvedValue(undefined);
});

describe('layout raiz', () => {
  it('segura a splash ao abrir o app', () => {
    expect(segurouSplash).toBe(1);
  });

  it('espera a sessão ser restaurada antes de mostrar as telas', async () => {
    let terminar: () => void = () => {};
    mockRestaurar.mockReturnValue(new Promise<void>((resolve) => (terminar = resolve)));
    await render(<RootLayout />);

    expect(screen.queryByText('Pilha de telas')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    await act(async () => terminar());
    expect(screen.getByText('Pilha de telas')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('espera as fontes carregarem', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    await render(<RootLayout />);

    expect(mockRestaurar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Pilha de telas')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('se as fontes falharem segue com as fontes do sistema', async () => {
    mockUseFonts.mockReturnValue([false, new Error('fonte')]);
    await render(<RootLayout />);

    expect(await screen.findByText('Pilha de telas')).toBeTruthy();
  });
});

describe('layout das abas', () => {
  it('sem sessão volta para o login', async () => {
    mockObterToken.mockReturnValue(null);
    await render(<AbasLayout />);

    expect(screen.getByText('Redirecionou para /')).toBeTruthy();
    expect(screen.queryByText(/^aba /)).toBeNull();
  });

  it('com sessão mostra as quatro abas na ordem, cada uma com seu ícone', async () => {
    mockObterToken.mockReturnValue('tok');
    await render(<AbasLayout />);

    expect(screen.getAllByText(/^aba /).map((t) => t.props.children)).toEqual([
      'aba inicio: Início',
      'aba pontos: Pontos',
      'aba cupons: Cupons',
      'aba perfil: Perfil',
    ]);
    expect(screen.getAllByText(/^ícone /).map((t) => t.props.children)).toEqual([
      'ícone home cinza',
      'ícone star cinza',
      'ícone confirmation_number cinza',
      'ícone person cinza',
    ]);
  });
});

it('layout de pontos é uma pilha', async () => {
  await render(<PontosLayout />);

  expect(screen.getByText('Pilha de telas')).toBeTruthy();
});

it('layout do início é uma pilha', async () => {
  await render(<InicioLayout />);

  expect(screen.getByText('Pilha de telas')).toBeTruthy();
});
