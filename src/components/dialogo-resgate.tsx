import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { formatarData, formatarDesconto, formatarPontos } from '@/components/cupom';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import type { CupomOferta, PromocaoOferta, TipoOferta } from '@/lib/ofertas';

// Mesmo formato do CupomResgatadoResponse no backend, que responde tanto o resgate de cupom quanto o de promoção
export interface CupomResgatado {
  id: number;
  codigo: string;
  descricao: string;
  empresa: string;
  dataValidade: string;
  // Zero na promoção, que não gasta pontos
  pontosGastos: number;
  saldo: number;
  // Opcional enquanto houver backend sem o campo: o app sabe o que resgatou pela oferta escolhida
  tipo?: TipoOferta;
}

// O cupom escolhido no detalhe do produto, com os nomes que a confirmação mostra
export interface CupomParaResgate extends CupomOferta {
  produto: string;
  empresa: string;
}

// A promoção escolhida, idem
export interface PromocaoParaResgate extends PromocaoOferta {
  produto: string;
  empresa: string;
}

// O que vai ser resgatado: cupom (gasta pontos) ou promoção (grátis, uma vez só)
export type OfertaParaResgate = ({ tipo: 'CUPOM' } & CupomParaResgate) | ({ tipo: 'PROMOCAO' } & PromocaoParaResgate);

export interface DialogoResgateProps {
  // Sem oferta, o diálogo fica fechado
  oferta?: OfertaParaResgate;
  saldo: number;
  resgatado?: CupomResgatado;
  erro?: string;
  // Com erro, mostra "Tentar de novo" em vez de só fechar (falha de rede, em que o resgate pode ser repetido)
  podeTentarDeNovo?: boolean;
  enviando: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
  // Depois do resgate: abre o detalhe com o código e o QR Code
  onVerCodigo: (resgatado: CupomResgatado) => void;
}

// Pede a confirmação antes de resgatar e, depois, mostra o código que a gestante apresenta na loja
export function DialogoResgate({
  oferta,
  saldo,
  resgatado,
  erro,
  podeTentarDeNovo,
  enviando,
  onConfirmar,
  onFechar,
  onVerCodigo,
}: DialogoResgateProps) {
  return (
    <Modal visible={!!oferta} transparent animationType="fade" onRequestClose={enviando ? undefined : onFechar}>
      <View style={styles.fundo}>
        {/* Toque fora fecha, menos durante o envio */}
        <Pressable style={StyleSheet.absoluteFill} onPress={enviando ? undefined : onFechar} accessible={false} />
        {oferta && (
          <View style={styles.caixa} accessibilityViewIsModal>
            {resgatado ? (
              <Sucesso tipo={oferta.tipo} resgatado={resgatado} onFechar={onFechar} onVerCodigo={onVerCodigo} />
            ) : (
              <>
                {oferta.tipo === 'CUPOM' ? (
                  <ConfirmacaoCupom cupom={oferta} saldo={saldo} />
                ) : (
                  <ConfirmacaoPromocao promocao={oferta} saldo={saldo} />
                )}
                <Acoes
                  erro={erro}
                  podeTentarDeNovo={podeTentarDeNovo}
                  enviando={enviando}
                  onConfirmar={onConfirmar}
                  onFechar={onFechar}
                />
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function ConfirmacaoCupom({ cupom, saldo }: { cupom: CupomParaResgate; saldo: number }) {
  return (
    <>
      <Text style={styles.titulo} accessibilityRole="header">
        Resgatar cupom?
      </Text>
      <Text style={styles.texto}>
        {formatarDesconto(cupom.desconto)} de desconto em {cupom.produto}, na {cupom.empresa}. Válido até{' '}
        {formatarData(cupom.dataValidade)}.
      </Text>

      <View style={styles.resumo}>
        <Linha rotulo="Seu saldo" valor={formatarPontos(saldo)} />
        <Linha rotulo="Custo do cupom" valor={`−${formatarPontos(cupom.pontosNecessarios)}`} />
        <View style={styles.divisor} />
        <Linha rotulo="Saldo depois do resgate" valor={formatarPontos(saldo - cupom.pontosNecessarios)} destaque />
      </View>
    </>
  );
}

// A promoção não custa pontos: o resumo deixa claro que o saldo continua o mesmo
function ConfirmacaoPromocao({ promocao, saldo }: { promocao: PromocaoParaResgate; saldo: number }) {
  return (
    <>
      <Text style={styles.titulo} accessibilityRole="header">
        Resgatar promoção?
      </Text>
      <Text style={styles.texto}>
        {promocao.titulo}: {formatarDesconto(promocao.desconto)} de desconto na {promocao.empresa}. Válida até{' '}
        {formatarData(promocao.dataFim)}.
      </Text>

      <View style={styles.resumo}>
        <Linha rotulo="Custo" valor="Grátis" />
        <View style={styles.divisor} />
        <Linha rotulo="Seu saldo continua" valor={formatarPontos(saldo)} destaque />
      </View>

      <Text style={styles.texto}>Você só pode resgatar esta promoção uma vez.</Text>
    </>
  );
}

interface AcoesProps {
  erro?: string;
  podeTentarDeNovo?: boolean;
  enviando: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}

function Acoes({ erro, podeTentarDeNovo, enviando, onConfirmar, onFechar }: AcoesProps) {
  return (
    <>
      {erro && <Alerta mensagem={erro} />}

      <View style={styles.botoes}>
        {/* Depois de um erro (oferta saiu do ar, saldo mudou, promoção já resgatada) não adianta tentar de novo: só
            fechar. Na falha de rede, sim: a nova tentativa vai com a mesma chave e não resgata duas vezes */}
        {(!erro || podeTentarDeNovo) && (
          <Botao
            rotulo={enviando ? 'Resgatando…' : erro ? 'Tentar de novo' : 'Confirmar resgate'}
            estilo="primario"
            desabilitado={enviando}
            onPress={onConfirmar}
          />
        )}
        <Botao rotulo={erro ? 'Fechar' : 'Cancelar'} estilo="secundario" desabilitado={enviando} onPress={onFechar} />
      </View>
    </>
  );
}

interface SucessoProps {
  tipo: TipoOferta;
  resgatado: CupomResgatado;
  onFechar: () => void;
  onVerCodigo: (resgatado: CupomResgatado) => void;
}

function Sucesso({ tipo, resgatado, onFechar, onVerCodigo }: SucessoProps) {
  const cupom = tipo === 'CUPOM';
  const rotuloCodigo = cupom ? 'Código do cupom' : 'Código da promoção';
  return (
    <>
      <Text style={styles.titulo} accessibilityRole="header" accessibilityLiveRegion="polite">
        {cupom ? 'Cupom resgatado!' : 'Promoção resgatada!'}
      </Text>
      <Text style={styles.texto}>
        Mostre este código no caixa da {resgatado.empresa} para ganhar {resgatado.descricao}.
      </Text>

      <View style={styles.codigoCaixa} accessible accessibilityLabel={`${rotuloCodigo}: ${resgatado.codigo.split('').join(' ')}`}>
        <Text style={styles.codigoRotulo}>{rotuloCodigo}</Text>
        <Text style={styles.codigo} selectable>
          {resgatado.codigo}
        </Text>
        <Text style={styles.codigoRotulo}>Válido até {formatarData(resgatado.dataValidade)}</Text>
      </View>

      {/* A promoção não gasta pontos: nada de "pontos usados" nem saldo novo */}
      {cupom ? (
        <View style={styles.resumo}>
          <Linha rotulo="Pontos usados" valor={formatarPontos(resgatado.pontosGastos)} />
          <Linha rotulo="Novo saldo" valor={formatarPontos(resgatado.saldo)} destaque />
        </View>
      ) : (
        <Text style={styles.texto}>Grátis: seus pontos continuam os mesmos.</Text>
      )}

      {/* O detalhe tem o QR Code; depois a gestante encontra o mesmo código em "Cupons resgatados" */}
      <View style={styles.botoes}>
        <Botao rotulo="Ver código" estilo="primario" onPress={() => onVerCodigo(resgatado)} />
        <Botao rotulo="Concluir" estilo="secundario" onPress={onFechar} />
      </View>
      <Text style={styles.dica}>Você também encontra este código em Cupons resgatados.</Text>
    </>
  );
}

// Uma linha de resumo (rótulo à esquerda, valor à direita), usada também no detalhe do resgate
export function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={styles.linha}>
      <Text style={[styles.linhaRotulo, destaque && styles.linhaDestaque]}>{rotulo}</Text>
      <Text style={[styles.linhaValor, destaque && styles.linhaDestaque]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    justifyContent: 'center',
    padding: Espaco.seis,
    backgroundColor: 'rgba(24, 24, 27, 0.5)',
  },
  caixa: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
    borderRadius: Raio * 2,
    backgroundColor: Cores.fundo,
    padding: Espaco.seis,
    gap: Espaco.quatro,
  },
  titulo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 20,
    lineHeight: 26,
    color: Cores.texto,
  },
  texto: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
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
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Espaco.dois,
  },
  linhaRotulo: {
    fontFamily: Fontes.regular,
    fontSize: 14,
    color: Cores.textoSecundario,
  },
  linhaValor: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: Fontes.media,
    fontSize: 14,
    color: Cores.texto,
  },
  linhaDestaque: {
    fontFamily: Fontes.seminegrito,
    color: Cores.texto,
  },
  botoes: {
    gap: Espaco.dois,
  },
  dica: {
    fontFamily: Fontes.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: Cores.textoSecundario,
  },
  codigoCaixa: {
    alignItems: 'center',
    borderRadius: Raio,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Cores.previna600,
    backgroundColor: Cores.previna50,
    paddingVertical: Espaco.cinco,
    gap: Espaco.um,
  },
  codigoRotulo: {
    fontFamily: Fontes.media,
    fontSize: 13,
    color: Cores.previna700,
  },
  codigo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 4,
    color: Cores.previna700,
  },
});
