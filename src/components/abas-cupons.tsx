import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Fontes } from '@/constants/theme';

export type AbaCupons = 'loja' | 'resgatados';

const ABAS: { aba: AbaCupons; rotulo: string; rota: '/cupons' | '/cupons/resgatados' }[] = [
  { aba: 'loja', rotulo: 'Loja Cupons', rota: '/cupons' },
  { aba: 'resgatados', rotulo: 'Cupons resgatados', rota: '/cupons/resgatados' },
];

// As duas telas da aba Cupons. Trocar usa replace: uma substitui a outra, sem empilhar, e o "voltar" do celular
// não fica alternando entre elas
export function AbasCupons({ ativa }: { ativa: AbaCupons }) {
  return (
    <View style={styles.abas} accessibilityRole="tablist">
      {ABAS.map(({ aba, rotulo, rota }) => {
        const selecionada = aba === ativa;
        return (
          <Pressable
            key={aba}
            accessibilityRole="tab"
            accessibilityState={{ selected: selecionada }}
            onPress={selecionada ? undefined : () => router.replace(rota)}
            style={[styles.aba, selecionada && styles.abaAtiva]}>
            <Text style={[styles.texto, selecionada && styles.textoAtivo]}>{rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  abas: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Cores.borda,
  },
  aba: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Espaco.dois,
    // A borda de baixo fica por cima da linha das abas: a ativa ganha o sublinhado na cor principal
    marginBottom: -1,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  abaAtiva: {
    borderBottomColor: Cores.previna600,
  },
  texto: {
    fontFamily: Fontes.media,
    fontSize: 15,
    color: Cores.textoSecundario,
  },
  textoAtivo: {
    fontFamily: Fontes.seminegrito,
    color: Cores.previna700,
  },
});
