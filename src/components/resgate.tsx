import { StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/botao';
import { formatarData } from '@/components/cupom';
import { Selo, type CorSelo } from '@/components/selo';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { formatarDia, ROTULO_STATUS_RESGATE, ROTULO_TIPO, type Resgate, type StatusResgate } from '@/lib/resgates';

// Esmeralda ainda vale na loja, zinc já foi usado e vermelho perdeu a validade
export const COR_STATUS_RESGATE: Record<StatusResgate, CorSelo> = {
  ATIVO: 'esmeralda',
  UTILIZADO: 'zinco',
  EXPIRADO: 'vermelho',
};

// A data que interessa em cada status: até quando vale, quando foi usado ou quando venceu
export function dataDoResgate(resgate: Resgate) {
  if (resgate.status === 'UTILIZADO') {
    return resgate.dataUso ? `Usado em ${formatarDia(resgate.dataUso)}` : 'Já usado na loja';
  }
  const validade = formatarData(resgate.dataValidade);
  return resgate.status === 'EXPIRADO' ? `Venceu em ${validade}` : `Válido até ${validade}`;
}

export function SelosResgate({ resgate }: { resgate: Resgate }) {
  return (
    <View style={styles.selos}>
      <Selo texto={ROTULO_TIPO[resgate.tipo]} cor="marca" />
      <Selo texto={ROTULO_STATUS_RESGATE[resgate.status]} cor={COR_STATUS_RESGATE[resgate.status]} />
    </View>
  );
}

export interface CartaoResgateProps {
  resgate: Resgate;
  onVerCodigo: (resgate: Resgate) => void;
}

// Um cupom ou promoção resgatado, no mesmo visual dos cartões do histórico de consultas, com o botão para abrir o
// código à direita
export function CartaoResgate({ resgate, onVerCodigo }: CartaoResgateProps) {
  const data = dataDoResgate(resgate);
  const tipo = ROTULO_TIPO[resgate.tipo];
  const status = ROTULO_STATUS_RESGATE[resgate.status];

  return (
    <View style={styles.cartao}>
      <View
        style={styles.textos}
        accessible
        accessibilityLabel={`${tipo}: ${resgate.titulo}, ${resgate.empresa.nome}, ${status}, ${data}`}>
        <Text style={styles.titulo}>{resgate.titulo}</Text>
        <Text style={styles.empresa}>{resgate.empresa.nome}</Text>
        <SelosResgate resgate={resgate} />
        <Text style={styles.data}>{data}</Text>
      </View>
      <Botao
        rotulo="Ver código"
        estilo="secundario"
        rotuloAcessivel={`Ver código: ${resgate.titulo}`}
        onPress={() => onVerCodigo(resgate)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    padding: Espaco.quatro,
    gap: Espaco.tres,
  },
  textos: {
    flex: 1,
    gap: Espaco.um,
  },
  titulo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
  },
  empresa: {
    fontFamily: Fontes.regular,
    fontSize: 14,
    color: Cores.textoSecundario,
  },
  selos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.um,
    marginVertical: 2,
  },
  data: {
    fontFamily: Fontes.regular,
    fontSize: 14,
    color: Cores.textoSecundario,
  },
});
