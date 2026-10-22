import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useScrollOffset,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { AlturaControle, Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { put } from '@/lib/api';
import { obterToken } from '@/lib/sessao';

const ETAPAS = [
  {
    titulo: 'Ganhe pontos',
    descricao:
      'Cada consulta ou exame de pré-natal confirmado pelo seu médico vale pontos para você.',
    cor: Cores.previna600,
    imagem: require('@/assets/images/tutorial-pontos.png'),
  },
  {
    titulo: 'Troque por cupons',
    descricao:
      'Use seus pontos para resgatar cupons de produtos e promoções das empresas parceiras.',
    cor: '#7c3aed',
    imagem: require('@/assets/images/tutorial-cupons.png'),
  },
  {
    titulo: 'Aprenda sobre o pré-natal',
    descricao: 'Leia conteúdos educativos para acompanhar cada fase da sua gestação.',
    cor: '#0f766e',
    imagem: require('@/assets/images/tutorial-conteudos.png'),
  },
];

const POSICOES = ETAPAS.map((_, i) => i);
const CORES = ETAPAS.map((etapa) => etapa.cor);
const AVATAR = 44;

export default function TutorialScreen() {
  const { width: largura } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const paginas = useAnimatedRef<Animated.ScrollView>();
  const deslocamento = useScrollOffset(paginas);
  // Etapa contínua (0 → 1 → 2) que acompanha o dedo durante o arraste
  const progresso = useDerivedValue(() => deslocamento.value / largura);
  const cor = useDerivedValue(() => interpolateColor(progresso.value, POSICOES, CORES));
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  useAnimatedReaction(
    () => Math.round(progresso.value),
    (atual, anterior) => {
      if (atual !== anterior) {
        scheduleOnRN(setIndice, atual);
      }
    },
  );

  const fundo = useAnimatedStyle(() => ({ backgroundColor: cor.value }));
  const corTexto = useAnimatedStyle(() => ({ color: cor.value }));

  if (!obterToken()) {
    return <Redirect href="/" />;
  }

  const ultima = indice === ETAPAS.length - 1;

  function irPara(destino: number) {
    paginas.current?.scrollTo({ x: destino * largura, animated: true });
  }

  async function concluir() {
    setErro(undefined);
    setEnviando(true);
    try {
      await put('/gestantes/tutorial-concluido', {});
      router.replace('/inicio');
    } catch {
      setErro('Não foi possível concluir. Verifique sua conexão e tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Animated.View style={[styles.tela, fundo]}>
      <StatusBar style="light" />

      <View style={[styles.topo, { paddingTop: insets.top + Espaco.quatro }]}>
        <View style={styles.coluna}>
          <Text style={styles.marca}>Previna</Text>
          <Caminho progresso={progresso} indice={indice} />
        </View>
      </View>

      <Animated.ScrollView
        ref={paginas}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.paginas}>
        {ETAPAS.map((etapa, i) => (
          <Ilustracao
            key={etapa.titulo}
            indice={i}
            imagem={etapa.imagem}
            progresso={progresso}
            largura={largura}
          />
        ))}
      </Animated.ScrollView>

      <View style={[styles.cartao, { paddingBottom: insets.bottom + Espaco.seis }]}>
        <View style={[styles.coluna, styles.conteudoCartao]}>
          <Animated.Text style={[styles.contador, corTexto]}>
            Etapa {indice + 1} de {ETAPAS.length}
          </Animated.Text>

          <View style={styles.textos}>
            {ETAPAS.map((etapa, i) => (
              <Textos
                key={etapa.titulo}
                indice={i}
                titulo={etapa.titulo}
                descricao={etapa.descricao}
                atual={i === indice}
                progresso={progresso}
                largura={largura}
              />
            ))}
          </View>

          {erro && <Alerta mensagem={erro} />}

          <View style={styles.acoes}>
            {indice > 0 && (
              <View style={styles.acao}>
                <Botao rotulo="Voltar" estilo="secundario" onPress={() => irPara(indice - 1)} />
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: enviando }}
              disabled={enviando}
              onPress={ultima ? concluir : () => irPara(indice + 1)}
              style={({ pressed }) => [styles.acao, (pressed || enviando) && styles.pressionado]}>
              <Animated.View style={[styles.avancar, fundo]}>
                <Text style={styles.textoAvancar}>
                  {ultima ? (enviando ? 'Concluindo…' : 'Começar') : 'Próximo'}
                </Text>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

interface CaminhoProps {
  progresso: SharedValue<number>;
  indice: number;
}

// A gestante (logo) caminha pela trilha até a etapa atual, dando um pulinho no meio do trajeto
function Caminho({ progresso, indice }: CaminhoProps) {
  const [largura, setLargura] = useState(0);
  const percurso = Math.max(largura - AVATAR, 0);

  const avanco = useAnimatedStyle(() => ({
    width: interpolate(progresso.value, [0, ETAPAS.length - 1], [0, percurso], 'clamp'),
  }));
  const gestante = useAnimatedStyle(() => {
    const pulo = Math.abs(Math.sin(progresso.value * Math.PI));
    return {
      transform: [
        {
          translateX: interpolate(progresso.value, [0, ETAPAS.length - 1], [0, percurso], 'clamp'),
        },
        { translateY: -pulo * 10 },
        { rotate: `${pulo * 12}deg` },
      ],
    };
  });

  return (
    <View
      style={styles.caminho}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={styles.trilha} />
      <Animated.View style={[styles.trilha, styles.trilhaPercorrida, avanco]} />
      <View style={styles.paradas}>
        {ETAPAS.map((etapa, i) => (
          <View key={etapa.titulo} style={styles.parada}>
            <View style={[styles.marco, i <= indice && styles.marcoAlcancado]} />
          </View>
        ))}
      </View>
      <Animated.View style={[styles.gestante, gestante]}>
        <Image source={require('@/assets/images/logo.png')} style={styles.imagemGestante} />
      </Animated.View>
    </View>
  );
}

interface IlustracaoProps {
  indice: number;
  imagem: number;
  progresso: SharedValue<number>;
  largura: number;
}

function Ilustracao({ indice, imagem, progresso, largura }: IlustracaoProps) {
  const disco = Math.min(largura * 0.56, 240);

  // Parallax: a ilustração anda mais devagar que a página, encolhe e gira ao sair
  const movimento = useAnimatedStyle(() => {
    const distancia = progresso.value - indice;
    return {
      opacity: interpolate(Math.abs(distancia), [0, 1], [1, 0.3], 'clamp'),
      transform: [
        { translateX: distancia * largura * 0.4 },
        { scale: interpolate(Math.abs(distancia), [0, 1], [1, 0.6], 'clamp') },
        { rotate: `${-distancia * 15}deg` },
      ],
    };
  });

  return (
    <View style={[styles.pagina, { width: largura }]}>
      <Animated.View style={[styles.halo, movimento]}>
        <View style={styles.haloInterno}>
          <View style={[styles.disco, { width: disco, height: disco }]}>
            <Image
              source={imagem}
              style={{ width: disco * 0.82, height: disco * 0.82 }}
              contentFit="contain"
              accessible={false}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

interface TextosProps {
  indice: number;
  titulo: string;
  descricao: string;
  atual: boolean;
  progresso: SharedValue<number>;
  largura: number;
}

function Textos({ indice, titulo, descricao, atual, progresso, largura }: TextosProps) {
  const movimento = useAnimatedStyle(() => {
    const distancia = progresso.value - indice;
    return {
      opacity: interpolate(Math.abs(distancia), [0, 0.6], [1, 0], 'clamp'),
      transform: [{ translateX: -distancia * largura * 0.25 }],
    };
  });

  return (
    <Animated.View
      style={[styles.texto, indice > 0 && styles.textoSobreposto, movimento]}
      accessibilityElementsHidden={!atual}
      importantForAccessibility={atual ? 'auto' : 'no-hide-descendants'}>
      <Text style={styles.titulo} accessibilityRole="header">
        {titulo}
      </Text>
      <Text style={styles.descricao}>{descricao}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  coluna: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
  },
  topo: {
    paddingHorizontal: Espaco.seis,
  },
  marca: {
    fontFamily: Fontes.marca,
    fontSize: 18,
    color: Cores.fundo,
    marginBottom: Espaco.cinco,
  },
  caminho: {
    height: AVATAR + Espaco.dois,
    justifyContent: 'flex-end',
  },
  trilha: {
    position: 'absolute',
    left: AVATAR / 2,
    right: AVATAR / 2,
    bottom: AVATAR / 2 - 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  trilhaPercorrida: {
    right: undefined,
    backgroundColor: Cores.fundo,
  },
  paradas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  parada: {
    width: AVATAR,
    height: AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marco: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  marcoAlcancado: {
    backgroundColor: Cores.fundo,
  },
  gestante: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    padding: 3,
    backgroundColor: Cores.fundo,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
  },
  imagemGestante: {
    flex: 1,
    borderRadius: AVATAR / 2,
  },
  paginas: {
    flex: 1,
  },
  pagina: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    padding: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  haloInterno: {
    padding: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  disco: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Cores.fundo,
  },
  cartao: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Cores.fundo,
    paddingTop: Espaco.oito,
    paddingHorizontal: Espaco.seis,
  },
  conteudoCartao: {
    gap: Espaco.cinco,
  },
  contador: {
    fontFamily: Fontes.seminegrito,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Todos os textos ficam empilhados no mesmo lugar; a altura é a do maior
  textos: {
    flexDirection: 'row',
    marginTop: -Espaco.dois,
  },
  texto: {
    width: '100%',
    gap: Espaco.dois,
  },
  textoSobreposto: {
    marginLeft: '-100%',
  },
  titulo: {
    fontFamily: Fontes.marca,
    fontSize: 26,
    lineHeight: 32,
    color: Cores.texto,
  },
  descricao: {
    fontFamily: Fontes.regular,
    fontSize: 16,
    lineHeight: 24,
    color: Cores.textoSecundario,
  },
  acoes: {
    flexDirection: 'row',
    gap: Espaco.tres,
    marginTop: Espaco.um,
  },
  acao: {
    flex: 1,
  },
  pressionado: {
    opacity: 0.8,
  },
  avancar: {
    height: AlturaControle,
    borderRadius: Raio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoAvancar: {
    fontFamily: Fontes.media,
    fontSize: 16,
    color: Cores.fundo,
  },
});
