import { useState, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { AlturaControle, Cores, Espaco, Fontes, Raio } from '@/constants/theme';

export interface CampoProps extends TextInputProps {
  rotulo: string;
  dica?: string;
  erro?: string;
  ref?: Ref<TextInput>;
}

export function Campo({ rotulo, dica, erro, ref, ...inputProps }: CampoProps) {
  const [focado, setFocado] = useState(false);

  return (
    <View style={styles.grupo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={rotulo}
        accessibilityHint={erro ?? dica}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={Cores.placeholder}
        {...inputProps}
        onFocus={(e) => {
          setFocado(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocado(false);
          inputProps.onBlur?.(e);
        }}
        style={[styles.input, focado && styles.inputFocado, !!erro && styles.inputComErro]}
      />
      {erro ? (
        <Text style={styles.erro} accessibilityLiveRegion="polite">
          {erro}
        </Text>
      ) : (
        dica && <Text style={styles.dica}>{dica}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: 6,
  },
  rotulo: {
    fontFamily: Fontes.media,
    fontSize: 14,
    color: Cores.rotulo,
  },
  input: {
    height: AlturaControle,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    backgroundColor: Cores.fundo,
    paddingHorizontal: Espaco.tres,
    fontFamily: Fontes.regular,
    fontSize: 16,
    color: Cores.texto,
  },
  inputFocado: {
    borderColor: Cores.previna600,
  },
  inputComErro: {
    borderColor: Cores.erro,
  },
  dica: {
    fontFamily: Fontes.regular,
    fontSize: 13,
    color: Cores.textoSecundario,
  },
  erro: {
    fontFamily: Fontes.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Cores.erro,
  },
});
