/// <reference types="jest" />

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import ConteudoScreen from '@/app/(abas)/inicio/conteudo/[id]';
import type { Conteudo } from '@/components/conteudo';
import { ApiError, get } from '@/lib/api';

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(codigo: number) {
      super(`Erro ${codigo}`);
      this.status = codigo;
    }
  }
  return {
    ApiError,
    get: jest.fn(),
    imagemDaApi: (caminho: string) => ({ uri: `api${caminho}` }),
  };
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

// Imagem e player falsos: mostram o que receberam, e a imagem "quebra" ao ser tocada. O logo da
// Tela (um require, sem uri) não aparece.
jest.mock('expo-image', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Image: ({ source, onError }: { source: { uri?: string }; onError?: () => void }) =>
      source?.uri ? <Text onPress={onError}>{`imagem ${source.uri}`}</Text> : null,
  };
});

jest.mock('expo-video', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    useVideoPlayer: (url: string) => ({ url }),
    VideoView: ({ player }: { player: { url: string } }) => <Text>{`player ${player.url}`}</Text>,
  };
});

const mockGet = get as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;
const mockAbrir = WebBrowser.openBrowserAsync as jest.Mock;

const BASE: Conteudo = {
  id: 7,
  titulo: 'Alimentação na gestação',
  categoria: 'NOTICIA',
  tipo: 'TEXTO',
  corpo: 'Coma de tudo um pouco.',
  publicado: true,
  criadoEm: '2026-11-01T10:00:00',
};

async function abrir(conteudo: Partial<Conteudo> = {}) {
  mockParams.mockReturnValue({ id: '7' });
  mockGet.mockResolvedValue({ ...BASE, ...conteudo });
  await render(<ConteudoScreen />);
  await screen.findByText('Alimentação na gestação');
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('carregamento', () => {
  it('mostra carregando enquanto o conteúdo não chega', async () => {
    mockParams.mockReturnValue({ id: '7' });
    mockGet.mockReturnValue(new Promise(() => {}));
    await render(<ConteudoScreen />);

    expect(screen.getByText('Carregando…')).toBeTruthy();
    expect(screen.getByText('Conteúdo')).toBeTruthy();
    expect(screen.getByText('Conteúdo educativo sobre a gestação.')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/conteudos/7');
  });

  it('mostra título, categoria e corpo do conteúdo de texto', async () => {
    await abrir();

    expect(screen.getByText('Notícia')).toBeTruthy();
    expect(screen.getByText('Coma de tudo um pouco.')).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();
    expect(screen.queryByText(/^imagem |^player /)).toBeNull();
  });

  it('sem corpo não mostra texto vazio', async () => {
    await abrir({ corpo: undefined });

    expect(screen.queryByText('Coma de tudo um pouco.')).toBeNull();
  });

  // O id vai no caminho da API: o que não é número nem chega a ser buscado
  it.each([['abc'], ['7/../usuarios'], [undefined]])('id %p é tratado como indisponível', async (id) => {
    mockParams.mockReturnValue({ id });
    await render(<ConteudoScreen />);

    expect(screen.getByText('Este conteúdo não está mais disponível.')).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('despublicado ou excluído (404) é indisponível', async () => {
    mockParams.mockReturnValue({ id: '7' });
    mockGet.mockRejectedValue(new ApiError(404));
    await render(<ConteudoScreen />);

    expect(await screen.findByText('Este conteúdo não está mais disponível.')).toBeTruthy();
  });

  it('outro erro pede para verificar a conexão', async () => {
    mockParams.mockReturnValue({ id: '7' });
    mockGet.mockRejectedValue(new Error('sem rede'));
    await render(<ConteudoScreen />);

    expect(await screen.findByText(/Não foi possível carregar o conteúdo/)).toBeTruthy();
    expect(screen.queryByText('Carregando…')).toBeNull();
  });

  it('"Voltar" volta para a tela anterior', async () => {
    await abrir();

    fireEvent.press(screen.getByText('Voltar'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('mídia', () => {
  it('foto da API vai com o caminho da API', async () => {
    await abrir({ tipo: 'FOTO', midiaUrl: '/conteudos/7/imagem' });

    expect(screen.getByText('imagem api/conteudos/7/imagem')).toBeTruthy();
  });

  it('foto quebrada vira um aviso curto', async () => {
    await abrir({ tipo: 'FOTO', midiaUrl: 'https://exemplo.com/foto.png' });

    await fireEvent.press(screen.getByText('imagem https://exemplo.com/foto.png'));
    expect(screen.getByText('A imagem deste conteúdo não pôde ser carregada.')).toBeTruthy();
    expect(screen.queryByText(/^imagem /)).toBeNull();
  });

  it('sem endereço de mídia não mostra nada além do texto', async () => {
    await abrir({ tipo: 'FOTO', midiaUrl: undefined });

    expect(screen.queryByText(/^imagem /)).toBeNull();
    expect(screen.queryByRole('button', { name: /Assistir|Abrir/ })).toBeNull();
  });

  it('arquivo de vídeo toca dentro do app', async () => {
    await abrir({ tipo: 'VIDEO', midiaUrl: 'https://cdn.exemplo.com/parto.mp4' });

    expect(screen.getByText('player https://cdn.exemplo.com/parto.mp4')).toBeTruthy();
    expect(screen.queryByText('Assistir ao vídeo')).toBeNull();
  });

  it('página de vídeo abre no navegador', async () => {
    const url = 'https://www.youtube.com/watch?v=abc';
    await abrir({ tipo: 'VIDEO', midiaUrl: url });

    expect(screen.getByText('youtube.com')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Assistir ao vídeo')));
    expect(mockAbrir).toHaveBeenCalledWith(url);
  });

  it('link abre no navegador e avisa se falhar', async () => {
    mockAbrir.mockRejectedValueOnce(new Error('sem navegador')).mockResolvedValueOnce({});
    await abrir({ tipo: 'LINK', midiaUrl: 'https://www.gov.br/saude' });

    expect(screen.getByText('gov.br')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Abrir o link')));
    expect(screen.getByText('Não foi possível abrir este conteúdo.')).toBeTruthy();

    // Tentar de novo limpa o aviso
    await act(async () => fireEvent.press(screen.getByText('Abrir o link')));
    expect(screen.queryByText('Não foi possível abrir este conteúdo.')).toBeNull();
  });

  it('tipo texto com endereço de mídia ignora a mídia', async () => {
    await abrir({ tipo: 'TEXTO', midiaUrl: 'https://exemplo.com/algo' });

    expect(screen.queryByText(/^imagem |^player /)).toBeNull();
    expect(screen.queryByText('exemplo.com')).toBeNull();
  });
});
