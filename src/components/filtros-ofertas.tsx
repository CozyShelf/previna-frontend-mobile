import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Campo } from '@/components/campo';
import { Opcoes, type Opcao } from '@/components/opcoes';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { ROTULO_CATEGORIA, type Categoria, type FiltrosOfertas, type TipoOferta } from '@/lib/ofertas';

const CATEGORIAS: Opcao<Categoria>[] = (Object.keys(ROTULO_CATEGORIA) as Categoria[]).map((valor) => ({
  valor,
  rotulo: ROTULO_CATEGORIA[valor],
}));

const TIPOS: Opcao<TipoOferta>[] = [
  { valor: 'CUPOM', rotulo: 'Cupom' },
  { valor: 'PROMOCAO', rotulo: 'Promoção' },
];

export interface PainelFiltrosProps {
  // O texto digitado; a tela aplica a busca com um atraso, para não buscar a cada letra
  busca: string;
  onBusca: (texto: string) => void;
  filtros: Omit<FiltrosOfertas, 'busca'>;
  onFiltros: (filtros: Omit<FiltrosOfertas, 'busca'>) => void;
}

export function PainelFiltros({ busca, onBusca, filtros, onFiltros }: PainelFiltrosProps) {
  const cabe = !!filtros.ateMeusPontos;

  return (
    <View style={styles.filtros}>
      <Campo
        rotulo="Buscar"
        placeholder="Produto ou empresa"
        value={busca}
        onChangeText={onBusca}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <Opcoes
        rotulo="Categoria"
        opcoes={CATEGORIAS}
        selecionada={filtros.categoria}
        onChange={(categoria) => onFiltros({ ...filtros, categoria })}
      />
      <Opcoes
        rotulo="Tipo"
        opcoes={TIPOS}
        selecionada={filtros.tipo}
        onChange={(tipo) => onFiltros({ ...filtros, tipo })}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Cabe no meu saldo"
        accessibilityState={{ checked: cabe }}
        accessibilityHint="Mostra só os produtos com cupom que dá para resgatar com o seu saldo"
        onPress={() => onFiltros({ ...filtros, ateMeusPontos: !cabe || undefined })}
        style={styles.marcar}>
        <View style={[styles.caixa, cabe && styles.caixaMarcada]}>
          {cabe ? <Text style={styles.visto}>✓</Text> : null}
        </View>
        <Text style={styles.marcarTexto}>Cabe no meu saldo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filtros: {
    gap: Espaco.quatro,
  },
  marcar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.dois,
  },
  caixa: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    backgroundColor: Cores.fundo,
  },
  caixaMarcada: {
    borderColor: Cores.previna600,
    backgroundColor: Cores.previna600,
  },
  visto: {
    fontFamily: Fontes.seminegrito,
    fontSize: 14,
    lineHeight: 18,
    color: Cores.fundo,
  },
  marcarTexto: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    color: Cores.texto,
  },
});
