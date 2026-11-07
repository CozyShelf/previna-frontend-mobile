/// <reference types="jest" />

import { fireEvent, render } from '@testing-library/react-native';

import { CartaoConteudo, dominioDe, ehVideoDireto, fonteDaMidia, type Conteudo } from '@/components/conteudo';

jest.mock('@/lib/sessao', () => ({
  obterToken: () => 'token-de-teste',
}));

const BASE: Conteudo = {
  id: 7,
  titulo: 'Alimentação na gestação',
  categoria: 'DICA',
  tipo: 'TEXTO',
  resumo: 'Coma de tudo um pouco',
  corpo: 'Corpo do artigo',
  publicado: true,
  criadoEm: '2026-11-01T10:00:00',
  publicadoEm: '2026-11-01T11:00:00',
};

describe('ehVideoDireto', () => {
  // O player do app só toca arquivo de vídeo; página de vídeo abre no navegador
  it.each(['https://cdn.exemplo.com/parto.mp4', 'https://exemplo.com/a.m3u8?token=1'])(
    'reconhece %s como arquivo de vídeo',
    (url) => {
      expect(ehVideoDireto(url)).toBe(true);
    },
  );

  it.each([
    'https://www.youtube.com/watch?v=aXmDOW2qxCY',
    'https://vimeo.com/123456',
    'https://exemplo.com/mp4',
  ])('não trata %s como arquivo de vídeo', (url) => {
    expect(ehVideoDireto(url)).toBe(false);
  });
});

describe('dominioDe', () => {
  it('mostra só o domínio, sem protocolo, www nem caminho', () => {
    expect(dominioDe('https://www.gov.br/saude/pt-br/vacinacao')).toBe('gov.br');
    expect(dominioDe('http://exemplo.com.br?a=1')).toBe('exemplo.com.br');
  });
});

describe('fonteDaMidia', () => {
  // A foto enviada pelo admin fica atrás do token; a externa é carregada direto
  it('manda o token na foto guardada na API', () => {
    const fonte = fonteDaMidia('/conteudos/7/imagem?v=1');

    expect(fonte.uri).toContain('/conteudos/7/imagem?v=1');
    expect(fonte.headers).toEqual({ Authorization: 'Bearer token-de-teste' });
  });

  it('usa o endereço externo como está, sem token', () => {
    expect(fonteDaMidia('https://exemplo.com/foto.png')).toEqual({
      uri: 'https://exemplo.com/foto.png',
    });
  });
});

describe('CartaoConteudo', () => {
  it('mostra categoria, título e resumo e avisa ao ser tocado', async () => {
    const onPress = jest.fn();
    const vista = await render(<CartaoConteudo conteudo={BASE} onPress={onPress} />);

    expect(vista.getByText('Dica')).toBeTruthy();
    expect(vista.getByText('Alimentação na gestação')).toBeTruthy();
    expect(vista.getByText('Coma de tudo um pouco')).toBeTruthy();

    fireEvent.press(vista.getByLabelText('Dica: Alimentação na gestação'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('não mostra resumo quando o conteúdo não tem', async () => {
    const vista = await render(
      <CartaoConteudo conteudo={{ ...BASE, resumo: undefined }} onPress={jest.fn()} />,
    );

    expect(vista.queryByText('Coma de tudo um pouco')).toBeNull();
  });
});
