import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { formatarData, formatarDesconto, formatarPontos } from '@/components/cupom';
import { Linha } from '@/components/dialogo-resgate';
import { dataDoResgate, SelosResgate } from '@/components/resgate';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { ApiError, get } from '@/lib/api';
import { formatarDia, ROTULO_STATUS_RESGATE, type Resgate } from '@/lib/resgates';

// Inexistente, de outra gestante ou id inválido têm a mesma resposta
const NAO_ENCONTRADO = 'Não encontramos este cupom resgatado.';

// Quanto tempo o botão fica dizendo "Código copiado"
const TEMPO_COPIADO = 2000;

export default function ResgateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // O id vai no caminho da API: só número, para a URL não apontar outro endpoint
  const idValido = /^\d+$/.test(id ?? '');
  const [resgate, setResgate] = useState<Resgate>();
  const [erroDaBusca, setErroDaBusca] = useState<string>();
  const [podeTentarDeNovo, setPodeTentarDeNovo] = useState(false);
  const erro = idValido ? erroDaBusca : NAO_ENCONTRADO;

  const carregar = useCallback(() => {
    if (!idValido) {
      return;
    }
    get<Resgate>(`/gestantes/cupons/${id}`)
      .then((dados) => {
        setResgate(dados);
        setErroDaBusca(undefined);
        setPodeTentarDeNovo(false);
      })
      .catch((e) => {
        const naoEncontrado = e instanceof ApiError && e.status === 404;
        if (naoEncontrado) {
          setResgate(undefined);
        }
        setErroDaBusca(naoEncontrado ? NAO_ENCONTRADO : 'Não foi possível carregar o cupom. Verifique sua conexão.');
        setPodeTentarDeNovo(!naoEncontrado);
      });
  }, [id, idValido]);

  // Recarrega ao voltar para esta tela: o cupom pode ter sido usado na loja ou vencido
  useFocusEffect(carregar);

  return (
    <Tela
      titulo={resgate?.titulo ?? 'Cupom resgatado'}
      descricao={resgate?.empresa.nome ?? 'O código para mostrar no caixa da loja.'}
      alinharTopo
      edges={['top', 'left', 'right']}>
      <View style={styles.conteudo}>
        {erro ? <Alerta mensagem={erro} /> : null}
        {erro && podeTentarDeNovo ? <Botao rotulo="Tentar de novo" estilo="secundario" onPress={carregar} /> : null}
        {!erro && !resgate ? <Text style={styles.aviso}>Carregando…</Text> : null}
        {resgate ? <Detalhe resgate={resgate} /> : null}

        <Botao rotulo="Voltar" estilo="secundario" onPress={() => router.back()} />
      </View>
    </Tela>
  );
}

function Detalhe({ resgate }: { resgate: Resgate }) {
  const promocao = resgate.tipo === 'PROMOCAO';
  return (
    <>
      <SelosResgate resgate={resgate} />
      {resgate.status === 'ATIVO' ? <CodigoAtivo resgate={resgate} /> : <CodigoInativo resgate={resgate} />}

      <View style={styles.resumo}>
        <Linha rotulo="Status" valor={ROTULO_STATUS_RESGATE[resgate.status]} />
        <Linha rotulo="Empresa" valor={resgate.empresa.nome} />
        {promocao ? (
          <Linha rotulo="Promoção" valor={resgate.titulo} />
        ) : (
          <Linha rotulo="Produto" valor={resgate.produto ?? resgate.titulo} />
        )}
        <Linha rotulo="Desconto" valor={formatarDesconto(resgate.desconto)} />
        <Linha rotulo="Válido até" valor={formatarData(resgate.dataValidade)} />
        <Linha rotulo="Resgatado em" valor={formatarDia(resgate.dataResgate)} />
        {resgate.dataUso ? <Linha rotulo="Usado em" valor={formatarDia(resgate.dataUso)} /> : null}
        <View style={styles.divisor} />
        <Linha rotulo="Pontos gastos" valor={promocao ? 'Nenhum' : formatarPontos(resgate.pontosGastos)} destaque />
      </View>
      {promocao ? (
        <Text style={styles.aviso}>Promoção grátis: você não gastou pontos para resgatar.</Text>
      ) : null}
    </>
  );
}

// Resgate ativo: QR Code e código em destaque, com o botão de copiar
function CodigoAtivo({ resgate }: { resgate: Resgate }) {
  const [copiado, setCopiado] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);

  // Volta para "Copiar" depois de um tempo, para dar para copiar de novo
  useEffect(() => {
    if (!copiado) {
      return;
    }
    const espera = setTimeout(() => setCopiado(false), TEMPO_COPIADO);
    return () => clearTimeout(espera);
  }, [copiado]);

  async function copiar() {
    try {
      await Clipboard.setStringAsync(resgate.codigo);
      setErroCopia(false);
      setCopiado(true);
    } catch {
      setErroCopia(true);
    }
  }

  return (
    <View style={styles.codigoCaixa}>
      <Text style={styles.codigoRotulo}>Mostre no caixa da {resgate.empresa.nome}</Text>
      <View
        style={styles.qr}
        accessible
        accessibilityRole="image"
        accessibilityLabel="QR Code do código, para a loja ler">
        <QRCode value={resgate.codigo} size={200} color={Cores.texto} backgroundColor={Cores.fundo} />
      </View>
      <View accessible accessibilityLabel={`Código: ${resgate.codigo.split('').join(' ')}`}>
        <Text style={styles.codigo} selectable>
          {resgate.codigo}
        </Text>
      </View>
      <View style={styles.copiar}>
        <Botao rotulo={copiado ? 'Código copiado' : 'Copiar'} estilo="primario" onPress={() => void copiar()} />
      </View>
      {erroCopia ? <Alerta mensagem="Não foi possível copiar o código. Mostre o QR Code ou digite o código." /> : null}
    </View>
  );
}

// Usado ou vencido: o QR some, para a loja não tentar ler um código que não vale mais. O código fica apagado, só
// para a gestante conferir
function CodigoInativo({ resgate }: { resgate: Resgate }) {
  const promocao = resgate.tipo === 'PROMOCAO';
  const nome = promocao ? 'Esta promoção' : 'Este cupom';
  const aviso =
    resgate.status === 'UTILIZADO'
      ? `${nome} já foi ${promocao ? 'usada' : 'usado'} na loja e não vale mais.`
      : `${nome} venceu e não vale mais na loja.`;
  return (
    <View style={[styles.codigoCaixa, styles.codigoCaixaInativa]}>
      <Text style={styles.avisoInativo}>{aviso}</Text>
      <Text style={styles.aviso}>{dataDoResgate(resgate)}</Text>
      <View accessible accessibilityLabel={`Código, que não vale mais: ${resgate.codigo.split('').join(' ')}`}>
        <Text style={[styles.codigo, styles.codigoInativo]}>{resgate.codigo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Espaco.seis,
  },
  aviso: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
  codigoCaixa: {
    alignItems: 'center',
    borderRadius: Raio,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Cores.previna600,
    backgroundColor: Cores.previna50,
    padding: Espaco.cinco,
    gap: Espaco.tres,
  },
  codigoCaixaInativa: {
    borderColor: Cores.borda,
    backgroundColor: Cores.fundoSutil,
  },
  codigoRotulo: {
    fontFamily: Fontes.media,
    fontSize: 14,
    textAlign: 'center',
    color: Cores.previna700,
  },
  qr: {
    padding: Espaco.tres,
    borderRadius: Raio,
    backgroundColor: Cores.fundo,
  },
  codigo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: 3,
    textAlign: 'center',
    color: Cores.previna700,
  },
  codigoInativo: {
    fontSize: 20,
    lineHeight: 26,
    color: Cores.placeholder,
    textDecorationLine: 'line-through',
  },
  avisoInativo: {
    fontFamily: Fontes.media,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: Cores.texto,
  },
  copiar: {
    alignSelf: 'stretch',
  },
  resumo: {
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    padding: Espaco.tres,
    gap: Espaco.dois,
  },
  divisor: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Cores.borda,
  },
});
