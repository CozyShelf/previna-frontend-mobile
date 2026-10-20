import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Cores, Fontes } from '@/constants/theme';

export function Logo() {
  return (
    <View style={styles.logo}>
      <Image source={require('@/assets/images/logo.png')} style={styles.imagem} />
      <Text style={styles.nome}>Previna</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  imagem: {
    width: 28,
    height: 28,
  },
  nome: {
    fontFamily: Fontes.marca,
    fontSize: 18,
    color: Cores.previna600,
  },
});
