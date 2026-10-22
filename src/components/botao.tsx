import { Pressable, StyleSheet, Text } from 'react-native';

import { AlturaControle, Cores, Espaco, Fontes, Raio } from '@/constants/theme';

export interface BotaoProps {
  rotulo: string;
  estilo: 'primario' | 'secundario';
  desabilitado?: boolean;
  onPress: () => void;
}

export function Botao({ rotulo, estilo, desabilitado, onPress }: BotaoProps) {
  const primario = estilo === 'primario';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primario ? styles.primario : styles.secundario,
        pressed && (primario ? styles.primarioPressionado : styles.secundarioPressionado),
        desabilitado && styles.desabilitado,
      ]}>
      <Text style={[styles.texto, primario && styles.textoPrimario]}>{rotulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: AlturaControle,
    borderRadius: Raio,
    paddingHorizontal: Espaco.quatro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primario: {
    backgroundColor: Cores.previna600,
  },
  primarioPressionado: {
    backgroundColor: Cores.previna700,
  },
  secundario: {
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.fundo,
  },
  secundarioPressionado: {
    backgroundColor: Cores.fundoSutil,
  },
  desabilitado: {
    opacity: 0.6,
  },
  texto: {
    fontFamily: Fontes.media,
    fontSize: 16,
    color: Cores.texto,
  },
  textoPrimario: {
    color: Cores.fundo,
  },
});
