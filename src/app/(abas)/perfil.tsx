import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Campo } from '@/components/campo';
import { anexarFoto, SeletorFoto } from '@/components/seletor-foto';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { ApiError, get, imagemDaApi, put } from '@/lib/api';
import { mascararTelefone, somenteDigitos } from '@/lib/mascaras';
import { encerrarSessao } from '@/lib/sessao';

interface PerfilGestante {
  nome: string;
  email?: string;
  telefone: string;
  temFoto: boolean;
}

// Mesmas regras do AtualizacaoPerfilGestanteRequest no backend
function validar(telefone: string, email: string) {
  return {
    telefone:
      somenteDigitos(telefone).length < 10
        ? 'Informe o DDD e o número, com 10 ou 11 dígitos.'
        : undefined,
    email:
      email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'Informe um e-mail válido, como nome@exemplo.com.'
        : undefined,
  };
}

export default function PerfilScreen() {
  const [perfil, setPerfil] = useState<PerfilGestante>();
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [foto, setFoto] = useState<string | null>();
  // Muda o endereço da foto salva para o app buscar a nova depois de salvar
  const [versaoFoto, setVersaoFoto] = useState(0);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [erro, setErro] = useState<string>();
  const [salvo, setSalvo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    get<PerfilGestante>('/gestantes/perfil')
      .then((dados) => {
        setPerfil(dados);
        setTelefone(mascararTelefone(dados.telefone));
        setEmail(dados.email ?? '');
      })
      .catch(() => setErro('Não foi possível carregar seu perfil. Verifique sua conexão.'));
  }, []);

  const erros = validar(telefone, email.trim());

  async function salvar() {
    setSalvo(false);
    setMostrarErros(true);
    if (erros.telefone || erros.email) {
      return;
    }
    setErro(undefined);
    setEnviando(true);
    try {
      const dados = new FormData();
      dados.append('telefone', somenteDigitos(telefone));
      dados.append('email', email.trim());
      if (foto) {
        anexarFoto(dados, 'foto', foto);
      } else if (foto === null) {
        dados.append('removerFoto', 'true');
      }
      setPerfil(await put<PerfilGestante>('/gestantes/perfil', dados));
      setFoto(undefined);
      setVersaoFoto((atual) => atual + 1);
      setSalvo(true);
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 409
          ? 'Este e-mail já está em uso por outro cadastro.'
          : e instanceof ApiError && e.mensagem
            ? e.mensagem
            : 'Não foi possível salvar. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    await encerrarSessao();
    router.replace('/');
  }

  return (
    <Tela
      titulo="Meu perfil"
      descricao="Mantenha sua foto e seu contato em dia."
      edges={['top', 'left', 'right']}>
      <View style={styles.formulario}>
        {perfil && (
          <>
            <Text style={styles.nome} accessibilityRole="header">
              {perfil.nome}
            </Text>
            <SeletorFoto
              atual={perfil.temFoto ? imagemDaApi(`/gestantes/foto?v=${versaoFoto}`) : undefined}
              foto={foto}
              onChange={(nova) => {
                setFoto(nova);
                setSalvo(false);
              }}
            />
            <Campo
              rotulo="Telefone"
              erro={mostrarErros ? erros.telefone : undefined}
              value={telefone}
              onChangeText={(texto) => setTelefone(mascararTelefone(texto))}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={15}
            />
            <Campo
              rotulo="E-mail"
              dica="Opcional."
              erro={mostrarErros ? erros.email : undefined}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={150}
            />
          </>
        )}

        {erro && <Alerta mensagem={erro} />}
        {salvo && (
          <Text style={styles.salvo} accessibilityLiveRegion="polite">
            Alterações salvas.
          </Text>
        )}

        {perfil && (
          <Botao
            rotulo={enviando ? 'Salvando…' : 'Salvar alterações'}
            estilo="primario"
            desabilitado={enviando}
            onPress={salvar}
          />
        )}
        <Botao rotulo="Sair" estilo="secundario" onPress={sair} />
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  formulario: {
    gap: Espaco.cinco,
  },
  nome: {
    fontFamily: Fontes.seminegrito,
    fontSize: 17,
    color: Cores.texto,
  },
  salvo: {
    fontFamily: Fontes.media,
    fontSize: 15,
    color: '#047857',
  },
});
