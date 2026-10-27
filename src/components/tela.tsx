import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
