import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { formatarData, formatarDesconto, formatarPontos, type CupomDisponivel } from '@/components/cupom';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';

// Mesmo formato do CupomResgatadoResponse no backend
export interface CupomResgatado {
  id: number;
  codigo: string;
  descricao: string;
  empresa: string;
  dataValidade: string;
  pontosGastos: number;
  saldo: number;
}

export interface DialogoResgateProps {
  // Sem cupom, o diálogo fica fechado
  cupom?: CupomDisponivel;
  saldo: number;
  resgatado?: CupomResgatado;
  erro?: string;
  enviando: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}

// Pede a confirmação antes de gastar os pontos e, depois, mostra o código que a gestante apresenta na loja
export function DialogoResgate({ cupom, saldo, resgatado, erro, enviando, onConfirmar, onFechar }: DialogoResgateProps) {
  return (
    <Modal visible={!!cupom} transparent animationType="fade" onRequestClose={enviando ? undefined : onFechar}>
      <View style={styles.fundo}>
        {/* Toque fora fecha, menos durante o envio */}
        <Pressable style={StyleSheet.absoluteFill} onPress={enviando ? undefined : onFechar} accessible={false} />
        {cupom && (
          <View style={styles.caixa} accessibilityViewIsModal>
            {resgatado ? (
              <Sucesso resgatado={resgatado} onFechar={onFechar} />
            ) : (
              <Confirmacao
                cupom={cupom}
                saldo={saldo}
                erro={erro}
                enviando={enviando}
                onConfirmar={onConfirmar}
                onFechar={onFechar}
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

interface ConfirmacaoProps {
  cupom: CupomDisponivel;
  saldo: number;
  erro?: string;
  enviando: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}

function Confirmacao({ cupom, saldo, erro, enviando, onConfirmar, onFechar }: ConfirmacaoProps) {
  return (
    <>
      <Text style={styles.titulo} accessibilityRole="header">
        Resgatar cupom?
      </Text>
      <Text style={styles.texto}>
        {formatarDesconto(cupom.desconto)} de desconto em {cupom.produto}, na {cupom.empresa.nome}. Válido até{' '}
        {formatarData(cupom.dataValidade)}.
      </Text>

      <View style={styles.resumo}>
        <Linha rotulo="Seu saldo" valor={formatarPontos(saldo)} />
        <Linha rotulo="Custo do cupom" valor={`−${formatarPontos(cupom.pontosNecessarios)}`} />
        <View style={styles.divisor} />
        <Linha rotulo="Saldo depois do resgate" valor={formatarPontos(saldo - cupom.pontosNecessarios)} destaque />
      </View>

      {erro && <Alerta mensagem={erro} />}

      <View style={styles.botoes}>
        {/* Depois de um erro (cupom saiu do ar, saldo mudou) não adianta tentar de novo: só fechar */}
        {!erro && (
          <Botao
            rotulo={enviando ? 'Resgatando…' : 'Confirmar resgate'}
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

function Sucesso({ resgatado, onFechar }: { resgatado: CupomResgatado; onFechar: () => void }) {
  return (
    <>
      <Text style={styles.titulo} accessibilityRole="header" accessibilityLiveRegion="polite">
        Cupom resgatado!
      </Text>
      <Text style={styles.texto}>
        Mostre este código no caixa da {resgatado.empresa} para ganhar {resgatado.descricao}.
      </Text>

      <View style={styles.codigoCaixa} accessible accessibilityLabel={`Código do cupom: ${resgatado.codigo.split('').join(' ')}`}>
        <Text style={styles.codigoRotulo}>Código do cupom</Text>
        <Text style={styles.codigo} selectable>
          {resgatado.codigo}
        </Text>
        <Text style={styles.codigoRotulo}>Válido até {formatarData(resgatado.dataValidade)}</Text>
      </View>

      <View style={styles.resumo}>
        <Linha rotulo="Pontos usados" valor={formatarPontos(resgatado.pontosGastos)} />
        <Linha rotulo="Novo saldo" valor={formatarPontos(resgatado.saldo)} destaque />
      </View>

      <Botao rotulo="Concluir" estilo="primario" onPress={onFechar} />
    </>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
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
