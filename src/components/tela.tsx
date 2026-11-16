import type { ReactElement, ReactNode } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { Cores, Espaco, Fontes } from '@/constants/theme';

export interface TelaProps {
  titulo: string;
  descricao: string;
  children: ReactNode;
  // Nas abas a barra inferior já ocupa a área segura de baixo
  edges?: Edge[];
  // Listas começam no topo; as telas de autenticação seguem centralizadas
  alinharTopo?: boolean;
}

export function Tela({ titulo, descricao, children, edges, alinharTopo }: TelaProps) {
  return (
    <SafeAreaView style={styles.area} edges={edges}>
      {/* Android edge-to-edge não redimensiona a tela com o teclado; no iOS o ScrollView ajusta o inset e rola até o campo */}
      <KeyboardAvoidingView
        style={styles.area}
        behavior={Platform.OS === 'android' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.conteudo, alinharTopo && styles.noTopo]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <View style={styles.coluna}>
            <Logo />
            <View style={styles.cabecalho}>
              <Text style={styles.titulo} accessibilityRole="header">
                {titulo}
              </Text>
              <Text style={styles.descricao}>{descricao}</Text>
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export interface TelaListaProps<T> {
  titulo: string;
  descricao: string;
  // Fica entre o título e os itens (saldo, filtros, avisos). É um elemento, não um componente, para o
  // campo de busca não ser recriado (e perder o foco) a cada render
  cabecalho?: ReactNode;
  // Indefinido enquanto carrega: a lista fica vazia sem mostrar o "vazio"
  itens?: readonly T[];
  chave: (item: T) => string;
  renderizar: (item: T) => ReactElement;
  // Mostrado quando a lista chegou e não tem itens
  vazio?: ReactNode;
  rodape?: ReactNode;
  espacoEntreItens?: number;
  recarregando: boolean;
  onRecarregar: () => void;
  onFimDaLista: () => void;
}

// Variante da Tela para listas longas: a própria FlatList rola a tela inteira (dentro do ScrollView da
// Tela ela perderia a virtualização e o onEndReached), com o mesmo cabeçalho e puxar para recarregar
export function TelaLista<T>({
  titulo,
  descricao,
  cabecalho,
  itens,
  chave,
  renderizar,
  vazio,
  rodape,
  espacoEntreItens = Espaco.oito,
  recarregando,
  onRecarregar,
  onFimDaLista,
}: TelaListaProps<T>) {
  return (
    <SafeAreaView style={styles.area} edges={['top', 'left', 'right']}>
      <FlatList
        testID="lista"
        data={itens}
        keyExtractor={chave}
        renderItem={({ item }) => (
          <View style={[styles.coluna, { marginBottom: espacoEntreItens }]}>{renderizar(item)}</View>
        )}
        onEndReached={onFimDaLista}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[styles.conteudo, styles.noTopo]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={recarregando}
            onRefresh={onRecarregar}
            tintColor={Cores.previna600}
            colors={[Cores.previna600]}
          />
        }
        ListHeaderComponent={
          <View style={[styles.coluna, styles.listaCabecalho]}>
            <Logo />
            <View style={styles.cabecalho}>
              <Text style={styles.titulo} accessibilityRole="header">
                {titulo}
              </Text>
              <Text style={styles.descricao}>{descricao}</Text>
            </View>
            {cabecalho}
          </View>
        }
        ListEmptyComponent={itens && vazio ? <View style={styles.coluna}>{vazio}</View> : undefined}
        ListFooterComponent={rodape ? <View style={styles.coluna}>{rodape}</View> : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    backgroundColor: Cores.fundo,
  },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Espaco.seis,
  },
  noTopo: {
    justifyContent: 'flex-start',
  },
  coluna: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
    gap: Espaco.oito,
  },
  cabecalho: {
    gap: Espaco.um,
  },
  listaCabecalho: {
    marginBottom: Espaco.oito,
  },
  titulo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: Cores.texto,
  },
  descricao: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
