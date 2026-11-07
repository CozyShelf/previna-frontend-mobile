import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { imagemDaApi } from '@/lib/api';

// Mesmos valores dos enums CategoriaConteudo e TipoConteudo no backend, com os rótulos do portal
const ROTULO_CATEGORIA = {
  DICA: 'Dica',
  NOTICIA: 'Notícia',
  AVISO: 'Aviso',
} as const;

export type CategoriaConteudo = keyof typeof ROTULO_CATEGORIA;
export type TipoConteudo = 'TEXTO' | 'FOTO' | 'VIDEO' | 'LINK';

export interface Conteudo {
  id: number;
  titulo: string;
  categoria: CategoriaConteudo;
  tipo: TipoConteudo;
  resumo?: string;
  corpo?: string;
  midiaUrl?: string;
  publicado: boolean;
  criadoEm: string;
  publicadoEm?: string;
}

// A mídia é um caminho da própria API (foto enviada pelo admin, que exige o token) ou um endereço
// externo. O que começa com "/" é da API.
export function fonteDaMidia(midiaUrl: string): {
  uri: string;
  headers?: Record<string, string>;
} {
  return midiaUrl.startsWith('/') ? imagemDaApi(midiaUrl) : { uri: midiaUrl };
}

// O player só toca arquivo de vídeo. Página de vídeo (YouTube, Vimeo) não é mídia direta e abre no
// navegador, onde o site tem o próprio player.
export function ehVideoDireto(url: string) {
  return /\.(mp4|m4v|mov|webm|m3u8|mpd)(\?|#|$)/i.test(url);
}

// Só o domínio, para a gestante ver de onde vem o link antes de tocar
export function dominioDe(url: string) {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split(/[/?#]/)[0];
}

export interface CartaoConteudoProps {
  conteudo: Conteudo;
  onPress: () => void;
}

// Só leitura: o conteúdo é cadastrado pelo admin no portal. Tocar abre a tela de detalhe,
// qualquer que seja o tipo; é lá que o vídeo toca e o link abre.
export function CartaoConteudo({ conteudo, onPress }: CartaoConteudoProps) {
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const mostraFoto = conteudo.tipo === 'FOTO' && !!conteudo.midiaUrl && !imagemFalhou;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${ROTULO_CATEGORIA[conteudo.categoria]}: ${conteudo.titulo}`}
      style={({ pressed }) => [styles.cartao, pressed && styles.pressionado]}>
      {mostraFoto && conteudo.midiaUrl ? (
        // Imagem quebrada não deixa um buraco no card: ela some e sobra o texto
        <Image
          source={fonteDaMidia(conteudo.midiaUrl)}
          style={styles.foto}
          contentFit="cover"
          transition={150}
          onError={() => setImagemFalhou(true)}
        />
      ) : null}
      <View style={styles.textos}>
        <View style={styles.cabecalho}>
          <Text style={styles.categoria}>{ROTULO_CATEGORIA[conteudo.categoria]}</Text>
          <SeloTipo tipo={conteudo.tipo} />
        </View>
        <Text style={styles.titulo}>{conteudo.titulo}</Text>
        {conteudo.resumo ? <Text style={styles.resumo}>{conteudo.resumo}</Text> : null}
      </View>
    </Pressable>
  );
}

// Ícone do que vai acontecer ao tocar: assistir, abrir fora do app, ler
function SeloTipo({ tipo }: { tipo: TipoConteudo }) {
  if (tipo === 'VIDEO') {
    return (
      <SymbolView
        name={{ ios: 'play.circle.fill', android: 'play_circle', web: 'play_circle' }}
        tintColor={Cores.previna600}
        size={18}
      />
    );
  }
  if (tipo === 'LINK') {
    return (
      <SymbolView
        name={{ ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' }}
        tintColor={Cores.textoSecundario}
        size={18}
      />
    );
  }
  return null;
}

export interface SecaoConteudosProps {
  conteudos: Conteudo[];
  onAbrir: (conteudo: Conteudo) => void;
}

export function SecaoConteudos({ conteudos, onAbrir }: SecaoConteudosProps) {
  return (
    <View style={styles.secao}>
      {conteudos.map((conteudo) => (
        <CartaoConteudo
          key={conteudo.id}
          conteudo={conteudo}
          onPress={() => onAbrir(conteudo)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  secao: {
    gap: Espaco.tres,
  },
  cartao: {
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    overflow: 'hidden',
  },
  pressionado: {
    backgroundColor: Cores.fundoSutil,
  },
  foto: {
    width: '100%',
    height: 160,
    backgroundColor: Cores.fundoSutil,
  },
  textos: {
    padding: Espaco.quatro,
    gap: Espaco.um,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.dois,
  },
  categoria: {
    fontFamily: Fontes.media,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Cores.previna700,
  },
  titulo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
  },
  resumo: {
    fontFamily: Fontes.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Cores.textoSecundario,
  },
});
