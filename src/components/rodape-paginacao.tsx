import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Cores, Espaco } from '@/constants/theme';

export interface RodapePaginacaoProps {
  carregando: boolean;
  erro?: string;
  onTentarDeNovo: () => void;
}

// Fim da lista paginada: indicador enquanto a próxima página chega, ou o erro com a opção de tentar de novo
export function RodapePaginacao({ carregando, erro, onTentarDeNovo }: RodapePaginacaoProps) {
  if (erro) {
    return (
      <View style={styles.rodape}>
        <Alerta mensagem={erro} />
        <Botao rotulo="Tentar de novo" estilo="secundario" onPress={onTentarDeNovo} />
      </View>
    );
  }
  if (carregando) {
    return (
      <View style={styles.rodape}>
        <ActivityIndicator color={Cores.previna600} accessibilityLabel="Carregando mais" />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  rodape: {
    gap: Espaco.tres,
  },
});
