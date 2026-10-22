import { StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';

export interface AlertaProps {
  mensagem: string;
}

export function Alerta({ mensagem }: AlertaProps) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.alerta}>
      <Text style={styles.texto}>{mensagem}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  alerta: {
    borderWidth: 1,
    borderColor: Cores.erroBorda,
    borderRadius: Raio,
    backgroundColor: Cores.erroFundo,
    paddingHorizontal: Espaco.tres,
    paddingVertical: Espaco.dois,
  },
  texto: {
    fontFamily: Fontes.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Cores.erro,
  },
});
