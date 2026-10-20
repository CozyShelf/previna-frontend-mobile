import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';

export interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
}

export interface OpcoesProps<T extends string> {
  rotulo: string;
  opcoes: Opcao<T>[];
  selecionada?: T;
  onChange: (valor?: T) => void;
}

// Escolha única opcional: tocar de novo na opção marcada desmarca
export function Opcoes<T extends string>({ rotulo, opcoes, selecionada, onChange }: OpcoesProps<T>) {
  return (
    <View style={styles.grupo} accessibilityRole="radiogroup" accessibilityLabel={rotulo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <View style={styles.opcoes}>
        {opcoes.map((opcao) => {
          const marcada = opcao.valor === selecionada;
          return (
            <Pressable
              key={opcao.valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: marcada }}
              onPress={() => onChange(marcada ? undefined : opcao.valor)}
              style={[styles.opcao, marcada && styles.opcaoMarcada]}>
              <Text style={[styles.texto, marcada && styles.textoMarcado]}>{opcao.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
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
  opcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espaco.dois,
  },
  opcao: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    backgroundColor: Cores.fundo,
    paddingHorizontal: Espaco.tres,
  },
  opcaoMarcada: {
    borderColor: Cores.previna600,
    backgroundColor: Cores.previna50,
  },
  texto: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    color: Cores.texto,
  },
  textoMarcado: {
    fontFamily: Fontes.media,
    color: Cores.previna700,
  },
});
