/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TutorialScreen from '@/app/tutorial';
import { put } from '@/lib/api';
import { obterToken } from '@/lib/sessao';

jest.mock('@/lib/api', () => ({ put: jest.fn() }));
jest.mock('@/lib/sessao', () => ({ obterToken: jest.fn() }));

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`Redirecionou para ${href}`}</Text>,
    router: { replace: jest.fn() },
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (funcao: (...args: unknown[]) => void, ...args: unknown[]) => funcao(...args),
}));

interface MockRefPaginas {
  mockRolar?: (x: number) => void;
  current: unknown;
}

// Reanimated sem a parte nativa: o deslocamento do carrossel vira estado do React, e
// scrollTo na referência das páginas "rola" na hora, como se a animação já tivesse terminado
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual('react');
  const { ScrollView, Text, View } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: { View, ScrollView, Text },
    interpolate: (valor: number, entrada: number[], saida: number[]) => {
      const [a, b] = [entrada[0], entrada[entrada.length - 1]];
      const [c, d] = [saida[0], saida[saida.length - 1]];
      const t = Math.min(Math.max((valor - a) / (b - a), 0), 1);
      return c + t * (d - c);
    },
    interpolateColor: () => '#000000',
    useAnimatedStyle: (estilo: () => object) => estilo(),
    useDerivedValue: (calcular: () => unknown) => ({ value: calcular() }),
    useAnimatedRef: () => {
      const ref = React.useRef(null);
      if (!ref.current) {
        const paginas: MockRefPaginas = { current: null };
        // O ScrollView tenta guardar a própria instância em current; aqui current é sempre o rolador falso
        Object.defineProperty(paginas, 'current', {
          get: () => ({
            scrollTo: ({ x }: { x: number }) => {
              paginas.mockRolar?.(x);
            },
          }),
          set: () => {},
        });
        ref.current = paginas;
      }
      return ref.current;
    },
    useScrollOffset: (ref: MockRefPaginas) => {
      const [x, setX] = React.useState(0);
      ref.mockRolar = setX;
      return { value: x };
    },
    useAnimatedReaction: (preparar: () => unknown, reagir: (atual: unknown, anterior: unknown) => void) => {
      const anterior = React.useRef(null);
      // Como no Reanimated, reage a cada mudança do deslocamento, mesmo que a etapa arredondada não mude
      React.useEffect(() => {
        const atual = preparar();
        reagir(atual, anterior.current);
        anterior.current = atual;
      });
    },
  };
});

const mockPut = put as jest.Mock;

const METRICAS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function abrir() {
  await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <TutorialScreen />
    </SafeAreaProvider>,
  );
}

async function proximo() {
  await fireEvent.press(screen.getByRole('button', { name: 'Próximo' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (obterToken as jest.Mock).mockReturnValue('tok');
  mockPut.mockResolvedValue(undefined);
});

it('sem sessão volta para o login', async () => {
  (obterToken as jest.Mock).mockReturnValue(null);
  await abrir();

  expect(screen.getByText('Redirecionou para /')).toBeTruthy();
});

it('começa na primeira etapa, sem botão de voltar', async () => {
  await abrir();

  expect(screen.getByText('Etapa 1 de 3')).toBeTruthy();
  expect(screen.getByText('Ganhe pontos')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Próximo' })).toBeTruthy();
});

it('só a etapa atual fica visível para o leitor de tela', async () => {
  await abrir();

  expect(screen.getByRole('header', { name: 'Ganhe pontos' })).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'Troque por cupons' })).toBeNull();
});

it('próximo e voltar andam pelas etapas', async () => {
  await abrir();

  await proximo();
  expect(screen.getByText('Etapa 2 de 3')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Troque por cupons' })).toBeTruthy();

  await proximo();
  expect(screen.getByText('Etapa 3 de 3')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Começar' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Próximo' })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
  expect(screen.getByText('Etapa 2 de 3')).toBeTruthy();
  expect(mockPut).not.toHaveBeenCalled();
});

it('começar marca o tutorial como concluído e vai para o início', async () => {
  await abrir();
  await proximo();
  await proximo();

  await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));
  expect(mockPut).toHaveBeenCalledWith('/gestantes/tutorial-concluido', {});
  expect(router.replace).toHaveBeenCalledWith('/inicio');
});

it('falha ao concluir mostra o erro e deixa tentar de novo', async () => {
  mockPut.mockRejectedValueOnce(new TypeError('Network request failed'));
  await abrir();
  await proximo();
  await proximo();

  await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));
  expect(screen.getByText(/Não foi possível concluir/)).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Começar' }));
  expect(screen.queryByText(/Não foi possível concluir/)).toBeNull();
  expect(router.replace).toHaveBeenCalledWith('/inicio');
});

it('durante o envio o botão fica desabilitado', async () => {
  let responder: () => void = () => {};
  mockPut.mockReturnValue(new Promise<void>((resolve) => (responder = resolve)));
  await abrir();
  await proximo();
  await proximo();

  // O toque só termina com a resposta: não espera aqui para ver o estado intermediário
  const toque = fireEvent.press(screen.getByRole('button', { name: 'Começar' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.getByRole('button', { name: 'Concluindo…' })).toBeDisabled();

  await act(async () => responder());
  await toque;
  expect(router.replace).toHaveBeenCalledWith('/inicio');
});

it('a gestante anda pela trilha medida até a última etapa', async () => {
  await abrir();
  const trilha = screen.container.queryAll(
    (no) => typeof no.props.onLayout === 'function' && no.props.accessibilityElementsHidden === true,
  )[0];
  // Trilha de 300 menos o avatar de 44: o percurso total é 256
  await fireEvent(trilha, 'layout', { nativeEvent: { layout: { width: 300, height: 44, x: 0, y: 0 } } });
  await proximo();
  await proximo();

  const deslocamentos = screen.container
    .queryAll(() => true)
    .map((no) => StyleSheet.flatten(no.props.style)?.transform?.[0])
    .filter((t): t is { translateX: number } => !!t && 'translateX' in t)
    .map((t) => t.translateX);
  expect(deslocamentos).toContain(256);
});
