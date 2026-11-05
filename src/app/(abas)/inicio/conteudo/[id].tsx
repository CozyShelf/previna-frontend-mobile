import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { dominioDe, ehVideoDireto, fonteDaMidia, type Conteudo } from '@/components/conteudo';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { ApiError, get } from '@/lib/api';

const ROTULO_CATEGORIA = { DICA: 'Dica', NOTICIA: 'Notícia', AVISO: 'Aviso' };

// Despublicado, excluído ou id inválido têm a mesma resposta: a gestante não precisa saber qual é
const INDISPONIVEL = 'Este conteúdo não está mais disponível.';

export default function ConteudoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // O id vai no caminho da API: só número, para a URL não apontar outro endpoint
  const idValido = /^\d+$/.test(id ?? '');
  const [conteudo, setConteudo] = useState<Conteudo>();
  const [erroDaBusca, setErroDaBusca] = useState<string>();
  // Id fora do formato nem chega a ser buscado: o erro é derivado, não gravado por um efeito
  const erro = idValido ? erroDaBusca : INDISPONIVEL;

  useEffect(() => {
    if (!idValido) {
      return;
    }
    get<Conteudo>(`/conteudos/${id}`)
      .then(setConteudo)
      // Despublicado ou excluído enquanto o app estava aberto responde 404, como o inexistente
      .catch((e) =>
        setErroDaBusca(
          e instanceof ApiError && e.status === 404
            ? INDISPONIVEL
            : 'Não foi possível carregar o conteúdo. Verifique sua conexão.',
        ),
      );
  }, [id, idValido]);

  return (
    <Tela
      titulo={conteudo?.titulo ?? 'Conteúdo'}
      descricao={
        conteudo ? ROTULO_CATEGORIA[conteudo.categoria] : 'Conteúdo educativo sobre a gestação.'
      }
      alinharTopo
      edges={['top', 'left', 'right']}>
      <View style={styles.conteudo}>
        {erro ? <Alerta mensagem={erro} /> : null}
        {!erro && !conteudo ? <Text style={styles.corpo}>Carregando…</Text> : null}
        {conteudo ? <Midia conteudo={conteudo} /> : null}
        {conteudo?.corpo ? <Text style={styles.corpo}>{conteudo.corpo}</Text> : null}

        <Botao rotulo="Voltar" estilo="secundario" onPress={() => router.back()} />
      </View>
    </Tela>
  );
}

function Midia({ conteudo }: { conteudo: Conteudo }) {
  const { tipo, midiaUrl } = conteudo;
  if (!midiaUrl) {
    return null;
  }
  if (tipo === 'FOTO') {
    return <Foto midiaUrl={midiaUrl} />;
  }
  if (tipo === 'VIDEO' && ehVideoDireto(midiaUrl)) {
    return <Player url={midiaUrl} />;
  }
  // Página de vídeo (YouTube e afins) e link abrem no navegador, que tem o player do próprio site
  if (tipo === 'VIDEO' || tipo === 'LINK') {
    return <AbrirFora url={midiaUrl} rotulo={tipo === 'VIDEO' ? 'Assistir ao vídeo' : 'Abrir o link'} />;
  }
  return null;
}

function Foto({ midiaUrl }: { midiaUrl: string }) {
  const [falhou, setFalhou] = useState(false);

  // Imagem quebrada não deixa um buraco na tela: vira um aviso curto
  if (falhou) {
    return <Text style={styles.indisponivel}>A imagem deste conteúdo não pôde ser carregada.</Text>;
  }
  return (
    <Image
      source={fonteDaMidia(midiaUrl)}
      style={styles.foto}
      contentFit="cover"
      transition={150}
      onError={() => setFalhou(true)}
    />
  );
}

// Arquivo de vídeo: toca dentro do app, com os controles nativos
function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url);

  return <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />;
}

function AbrirFora({ url, rotulo }: { url: string; rotulo: string }) {
  const [erro, setErro] = useState(false);

  async function abrir() {
    setErro(false);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setErro(true);
    }
  }

  return (
    <View style={styles.externo}>
      <Text style={styles.dominio}>{dominioDe(url)}</Text>
      {erro ? <Alerta mensagem="Não foi possível abrir este conteúdo." /> : null}
      <Botao rotulo={rotulo} estilo="primario" onPress={abrir} />
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Espaco.cinco,
  },
  corpo: {
    fontFamily: Fontes.regular,
    fontSize: 16,
    lineHeight: 24,
    color: Cores.texto,
  },
  foto: {
    width: '100%',
    height: 220,
    borderRadius: Raio,
    backgroundColor: Cores.fundoSutil,
  },
  video: {
    width: '100%',
    height: 220,
    borderRadius: Raio,
    backgroundColor: Cores.texto,
  },
  externo: {
    gap: Espaco.tres,
  },
  dominio: {
    fontFamily: Fontes.media,
    fontSize: 14,
    color: Cores.textoSecundario,
  },
  indisponivel: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
