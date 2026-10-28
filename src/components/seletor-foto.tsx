import { File } from 'expo-file-system';
import { Image, type ImageSource } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Cores, Espaco, Fontes } from '@/constants/theme';

const TAMANHO = 112;

const OPCOES: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: true,
  aspect: [1, 1],
  cameraType: ImagePicker.CameraType.front,
};

// Foto nova vai como arquivo no multipart; o fetch do Expo só aceita File/Blob, não o { uri } do React Native
export function anexarFoto(dados: FormData, campo: string, uri: string) {
  dados.append(campo, new File(uri));
}

export interface SeletorFotoProps {
  // Foto já salva no servidor
  atual?: ImageSource;
  // undefined: sem mudança; null: removida; texto: endereço local da foto nova
  foto: string | null | undefined;
  onChange: (foto: string | null | undefined) => void;
}

// Foto do perfil tirada na hora (câmera frontal) ou escolhida na galeria, sempre opcional
export function SeletorFoto({ atual, foto, onChange }: SeletorFotoProps) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string>();
  const exibida = foto === null ? undefined : foto ? { uri: foto } : atual;

  async function escolher(origem: 'camera' | 'galeria') {
    setErro(undefined);
    if (origem === 'camera') {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        setErro('Permita o uso da câmera nas configurações do celular para tirar a foto.');
        return;
      }
    }
    const resultado =
      origem === 'camera'
        ? await ImagePicker.launchCameraAsync(OPCOES)
        : await ImagePicker.launchImageLibraryAsync(OPCOES);
    if (resultado.canceled) {
      return;
    }

    setProcessando(true);
    try {
      // A foto do celular passa fácil dos 2 MB do servidor e pode vir em HEIC: reduz e converte para JPEG
      const imagem = await ImageManipulator.manipulate(resultado.assets[0].uri)
        .resize({ width: 512 })
        .renderAsync();
      const salva = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      onChange(salva.uri);
    } catch {
      setErro('Não foi possível usar esta imagem. Tente outra.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <View style={styles.grupo}>
      <View style={styles.linha}>
        <View style={styles.foto} accessibilityLabel={exibida ? 'Sua foto' : 'Sem foto'}>
          {processando ? (
            <ActivityIndicator color={Cores.previna600} />
          ) : exibida ? (
            <Image source={exibida} style={styles.imagem} contentFit="cover" cachePolicy="none" />
          ) : (
            <SymbolView
              name={{ ios: 'person.fill', android: 'person', web: 'person' }}
              tintColor={Cores.placeholder}
              size={48}
            />
          )}
        </View>
        <View style={styles.acoes}>
          <Botao
            rotulo="Tirar foto"
            estilo="secundario"
            desabilitado={processando}
            onPress={() => escolher('camera')}
          />
          <Botao
            rotulo="Escolher da galeria"
            estilo="secundario"
            desabilitado={processando}
            onPress={() => escolher('galeria')}
          />
        </View>
      </View>
      {exibida && !processando && (
        <Text style={styles.remover} accessibilityRole="button" onPress={() => onChange(null)}>
          Remover foto
        </Text>
      )}
      {erro && <Alerta mensagem={erro} />}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: Espaco.tres,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.quatro,
  },
  foto: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cores.fundoSutil,
    borderWidth: 1,
    borderColor: Cores.borda,
  },
  imagem: {
    width: '100%',
    height: '100%',
  },
  acoes: {
    flex: 1,
    gap: Espaco.dois,
  },
  remover: {
    alignSelf: 'flex-start',
    paddingVertical: Espaco.um,
    fontFamily: Fontes.media,
    fontSize: 15,
    color: Cores.erro,
  },
});
