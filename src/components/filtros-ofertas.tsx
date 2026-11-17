import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Campo } from '@/components/campo';
import { Opcoes, type Opcao } from '@/components/opcoes';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { ROTULO_CATEGORIA, type Categoria, type TipoOferta } from '@/lib/ofertas';

const CATEGORIAS: Opcao<Categoria>[] = (Object.keys(ROTULO_CATEGORIA) as Categoria[]).map((valor) => ({
  valor,
  rotulo: ROTULO_CATEGORIA[valor],
}));

const TIPOS: Opcao<TipoOferta>[] = [
  { valor: 'CUPOM', rotulo: 'Cupom' },
  { valor: 'PROMOCAO', rotulo: 'Promoção' },
];

// O que as duas telas filtram igual; cada uma acrescenta os próprios campos no mesmo objeto
export interface FiltrosComuns {
  categoria?: Categoria;
  tipo?: TipoOferta;
}

export interface PainelFiltrosProps<F extends FiltrosComuns> {
  // O texto digitado; a tela aplica a busca com um atraso, para não buscar a cada letra
  busca: string;
  onBusca: (texto: string) => void;
  filtros: F;
  onFiltros: (filtros: F) => void;
  placeholder?: string;
  // O filtro que muda de uma tela para outra ("Cabe no meu saldo" na Loja, status nos resgatados), abaixo do tipo
  children?: ReactNode;
}

// Busca, categoria e tipo, comuns à Loja e aos cupons resgatados
export function PainelFiltros<F extends FiltrosComuns>({
  busca,
  onBusca,
  filtros,
  onFiltros,
  placeholder = 'Produto ou empresa',
  children,
}: PainelFiltrosProps<F>) {
  return (
    <View style={styles.filtros}>
      <Campo
        rotulo="Buscar"
        placeholder={placeholder}
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
      {children}
    </View>
  );
}

export interface FiltroCabeNoSaldoProps {
  marcado: boolean;
  onChange: (marcado: boolean) => void;
}

// Só na Loja: nos resgatados os pontos já foram gastos
export function FiltroCabeNoSaldo({ marcado, onChange }: FiltroCabeNoSaldoProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Cabe no meu saldo"
      accessibilityState={{ checked: marcado }}
      accessibilityHint="Mostra só os produtos com cupom que dá para resgatar com o seu saldo"
      onPress={() => onChange(!marcado)}
      style={styles.marcar}>
      <View style={[styles.caixa, marcado && styles.caixaMarcada]}>
        {marcado ? <Text style={styles.visto}>✓</Text> : null}
      </View>
      <Text style={styles.marcarTexto}>Cabe no meu saldo</Text>
    </Pressable>
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
