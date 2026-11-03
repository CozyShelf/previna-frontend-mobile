import { StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Fontes } from '@/constants/theme';

export interface ItemPontosProps {
  titulo: string;
  // Instante vindo da API (ISO com Z), mostrado no fuso do celular
  dataHora: string;
  // Negativo nos pontos gastos
  pontos: number;
  categoria?: string;
}

export function ItemPontos({ titulo, dataHora, pontos, categoria }: ItemPontosProps) {
  const data = new Date(dataHora).toLocaleDateString('pt-BR');
  const detalhe = categoria ? `${categoria} · ${data}` : data;
  const ganho = pontos > 0;

  return (
    <View
      style={styles.item}
      accessible
      accessibilityLabel={`${titulo}, ${detalhe}, ${ganho ? 'ganhou' : 'gastou'} ${Math.abs(pontos)} pontos`}>
      <View style={styles.textos}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.detalhe}>{detalhe}</Text>
      </View>
      <Text style={[styles.pontos, ganho && styles.ganho]}>
        {ganho ? '+' : '−'}
        {Math.abs(pontos)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.tres,
    paddingVertical: Espaco.tres,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Cores.borda,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontFamily: Fontes.media,
    fontSize: 15,
    color: Cores.texto,
  },
  detalhe: {
    fontFamily: Fontes.regular,
    fontSize: 13,
    color: Cores.textoSecundario,
  },
  pontos: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
  },
  ganho: {
    color: Cores.sucesso,
  },
});
