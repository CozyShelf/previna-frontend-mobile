import { StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Fontes } from '@/constants/theme';

// Mesmas cores das pílulas do portal: âmbar espera uma ação, esmeralda está bem resolvido, zinc é neutro, vermelho
// perdeu a validade e "marca" usa a cor do Previna
export const CORES_SELO = {
  ambar: { fundo: '#fffbeb', texto: '#92400e' },
  esmeralda: { fundo: '#ecfdf5', texto: '#047857' },
  zinco: { fundo: '#f4f4f5', texto: '#52525b' },
  vermelho: { fundo: Cores.erroFundo, texto: Cores.erro },
  marca: { fundo: Cores.previna50, texto: Cores.previna700 },
} as const;

export type CorSelo = keyof typeof CORES_SELO;

export function Selo({ texto, cor }: { texto: string; cor: CorSelo }) {
  const { fundo, texto: corTexto } = CORES_SELO[cor];
  return (
    <View style={[styles.selo, { backgroundColor: fundo }]}>
      <Text style={[styles.texto, { color: corTexto }]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  selo: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Espaco.dois,
    paddingVertical: 2,
  },
  texto: {
    fontFamily: Fontes.media,
    fontSize: 12,
  },
});
