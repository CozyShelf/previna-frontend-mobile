import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Campo } from '@/components/campo';
import { Tela } from '@/components/tela';
import { Espaco } from '@/constants/theme';
import { ApiError, post } from '@/lib/api';
import { iniciarSessao, obterToken, perfilDoToken } from '@/lib/sessao';

interface TokenResponse {
  token: string;
  primeiroAcesso: boolean;
  tutorialPendente: boolean;
}

function destino({ primeiroAcesso, tutorialPendente }: TokenResponse) {
  if (primeiroAcesso) {
    return '/primeiro-acesso';
  }
  return tutorialPendente ? '/tutorial' : '/inicio';
}

export default function LoginScreen() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  if (obterToken()) {
    return <Redirect href="/inicio" />;
  }

  async function entrar() {
    if (!login.trim() || !senha) {
      setErro('Informe o login e a senha.');
      return;
    }
    setErro(undefined);
    setEnviando(true);
    try {
      const resposta = await post<TokenResponse>('/auth/login', { login: login.trim(), senha });
      if (perfilDoToken(resposta.token) !== 'GESTANTE') {
        setErro('Acesso permitido apenas para gestantes.');
        return;
      }
      iniciarSessao(resposta.token);
      router.replace(destino(resposta));
    } catch (e) {
      setErro(
        e instanceof ApiError && e.status === 401
          ? 'Login ou senha inválidos.'
          : 'Não foi possível entrar. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela
      titulo="Entrar no Previna"
      descricao="No primeiro acesso, use o login e a senha temporários que você recebeu do seu médico.">
      <View style={styles.formulario}>
        <Campo
          rotulo="Login"
          value={login}
          onChangeText={setLogin}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          maxLength={50}
        />
        <Campo
          rotulo="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          maxLength={72}
          returnKeyType="go"
          onSubmitEditing={entrar}
        />

        {erro && <Alerta mensagem={erro} />}

        <Botao
          rotulo={enviando ? 'Entrando…' : 'Entrar'}
          estilo="primario"
          desabilitado={enviando}
          onPress={entrar}
        />
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  formulario: {
    gap: Espaco.cinco,
  },
});
