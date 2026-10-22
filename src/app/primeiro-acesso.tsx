import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Campo } from '@/components/campo';
import { Opcoes, type Opcao } from '@/components/opcoes';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { ApiError, put } from '@/lib/api';
import { iniciarSessao, obterToken } from '@/lib/sessao';

const TEXTO_CONSENTIMENTO =
  'Autorizo o Previna a usar meus dados pessoais e de saúde para acompanhar meu pré-natal, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).';

type Escolaridade =
  | 'SEM_ESCOLARIDADE'
  | 'FUNDAMENTAL_INCOMPLETO'
  | 'FUNDAMENTAL_COMPLETO'
  | 'MEDIO_INCOMPLETO'
  | 'MEDIO_COMPLETO'
  | 'SUPERIOR_INCOMPLETO'
  | 'SUPERIOR_COMPLETO';

const ESCOLARIDADES: Opcao<Escolaridade>[] = [
  { valor: 'SEM_ESCOLARIDADE', rotulo: 'Sem escolaridade' },
  { valor: 'FUNDAMENTAL_INCOMPLETO', rotulo: 'Fundamental incompleto' },
  { valor: 'FUNDAMENTAL_COMPLETO', rotulo: 'Fundamental completo' },
  { valor: 'MEDIO_INCOMPLETO', rotulo: 'Médio incompleto' },
  { valor: 'MEDIO_COMPLETO', rotulo: 'Médio completo' },
  { valor: 'SUPERIOR_INCOMPLETO', rotulo: 'Superior incompleto' },
  { valor: 'SUPERIOR_COMPLETO', rotulo: 'Superior completo' },
];

const SIM_NAO: Opcao<'sim' | 'nao'>[] = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];

function somenteDigitos(texto: string) {
  return texto.replace(/\D/g, '');
}

// 2500 -> 2.500
function separarMilhar(digitos: string) {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ['a', 'b', 'c'] -> 'a, b e c'
function listar(itens: string[]) {
  return itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}` : itens[0];
}

// Mesmas regras do PrimeiroAcessoRequest no backend, dizendo o que corrigir
function erroLogin(login: string) {
  if (!login) {
    return 'Informe o novo login.';
  }
  if (/[^A-Za-z0-9._-]/.test(login)) {
    return 'Use só letras sem acento, números, ponto, hífen ou sublinhado, sem espaços.';
  }
  if (login.length < 4) {
    return 'O login deve ter pelo menos 4 caracteres.';
  }
  if (!/[A-Za-z]/.test(login)) {
    return 'O login precisa ter pelo menos uma letra.';
  }
}

function erroSenha(senha: string) {
  if (!senha) {
    return 'Crie uma senha.';
  }
  const faltando = [
    senha.length < 8 && 'pelo menos 8 caracteres',
    !/[A-Za-z]/.test(senha) && 'uma letra',
    !/\d/.test(senha) && 'um número',
  ].filter((item) => typeof item === 'string');
  if (faltando.length) {
    return `A senha precisa de ${listar(faltando)}.`;
  }
}

function erroConfirmacao(senha: string, confirmacao: string) {
  if (!confirmacao) {
    return 'Repita a nova senha.';
  }
  if (confirmacao !== senha) {
    return 'As senhas não conferem.';
  }
}

type CampoValidado = 'login' | 'senha' | 'confirmacao' | 'pessoas';
const CAMPOS: CampoValidado[] = ['login', 'senha', 'confirmacao', 'pessoas'];

function validar(login: string, senha: string, confirmacao: string, pessoas: string) {
  return {
    login: erroLogin(login),
    senha: erroSenha(senha),
    confirmacao: erroConfirmacao(senha, confirmacao),
    pessoas:
      pessoas && (Number(pessoas) < 1 || Number(pessoas) > 50)
        ? 'Informe de 1 a 50 pessoas.'
        : undefined,
  };
}

export default function PrimeiroAcessoScreen() {
  const [novoLogin, setNovoLogin] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [renda, setRenda] = useState('');
  const [pessoas, setPessoas] = useState('');
  const [escolaridade, setEscolaridade] = useState<Escolaridade>();
  const [programaSocial, setProgramaSocial] = useState<'sim' | 'nao'>();
  const [consentimento, setConsentimento] = useState(false);
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [visiveis, setVisiveis] = useState<CampoValidado[]>([]);
  const refLogin = useRef<TextInput>(null);
  const refSenha = useRef<TextInput>(null);
  const refConfirmacao = useRef<TextInput>(null);
  const refPessoas = useRef<TextInput>(null);

  if (!obterToken()) {
    return <Redirect href="/" />;
  }

  const erros = validar(novoLogin.trim(), novaSenha, confirmacao, pessoas);
  // O erro aparece ao sair do campo e daí em diante acompanha a digitação; a senha mostra o que falta desde a primeira tecla
  const erroDe = (campo: CampoValidado) => (visiveis.includes(campo) ? erros[campo] : undefined);
  const mostrar = (campo: CampoValidado) =>
    setVisiveis((atuais) => (atuais.includes(campo) ? atuais : [...atuais, campo]));

  async function salvar() {
    setVisiveis(CAMPOS);
    const invalido = CAMPOS.find((campo) => erros[campo]);
    if (invalido) {
      setErro(undefined);
      const refs = { login: refLogin, senha: refSenha, confirmacao: refConfirmacao, pessoas: refPessoas };
      refs[invalido].current?.focus();
      return;
    }
    if (!consentimento) {
      setErro('Para continuar, autorize o uso dos seus dados.');
      return;
    }
    setErro(undefined);
    setEnviando(true);
    try {
      // O token da senha temporária só servia para esta etapa; segue com o novo
      const { token } = await put<{ token: string }>('/gestantes/primeiro-acesso', {
        novoLogin: novoLogin.trim(),
        novaSenha,
        consentimentoLgpd: consentimento,
        rendaFamiliar: renda ? Number(renda) : undefined,
        pessoasDomicilio: pessoas ? Number(pessoas) : undefined,
        escolaridade,
        beneficiariaProgramaSocial: programaSocial === undefined ? undefined : programaSocial === 'sim',
      });
      iniciarSessao(token);
      router.replace('/tutorial');
    } catch (e) {
      setErro(
        e instanceof ApiError && e.mensagem
          ? e.mensagem
          : 'Não foi possível salvar. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela
      titulo="Crie seu acesso"
      descricao="Para sua segurança, troque o login e a senha temporários por outros que só você saiba.">
      <View style={styles.formulario}>
        <Campo
          ref={refLogin}
          rotulo="Novo login"
          dica="De 4 a 50 caracteres, com pelo menos uma letra. Pode usar números, ponto, hífen e sublinhado."
          erro={erroDe('login')}
          value={novoLogin}
          onChangeText={setNovoLogin}
          onBlur={() => mostrar('login')}
          autoComplete="username-new"
          textContentType="username"
          maxLength={50}
        />
        <Campo
          ref={refSenha}
          rotulo="Nova senha"
          dica="Mínimo de 8 caracteres, com letras e números."
          erro={erroDe('senha')}
          value={novaSenha}
          onChangeText={(texto) => {
            setNovaSenha(texto);
            mostrar('senha');
          }}
          onBlur={() => mostrar('senha')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={72}
        />
        <Campo
          ref={refConfirmacao}
          rotulo="Confirme a nova senha"
          erro={erroDe('confirmacao')}
          value={confirmacao}
          onChangeText={setConfirmacao}
          onBlur={() => mostrar('confirmacao')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={72}
        />

        <View style={styles.secao}>
          <Text style={styles.tituloSecao} accessibilityRole="header">
            Sobre você
          </Text>
          <Text style={styles.textoSecao}>
            Opcional. Essas informações ajudam o programa a apoiar quem mais precisa.
          </Text>
        </View>
        <Campo
          rotulo="Renda familiar mensal (R$)"
          placeholder="Ex.: 2.500"
          value={separarMilhar(renda)}
          onChangeText={(texto) => setRenda(somenteDigitos(texto).replace(/^0+(?=\d)/, ''))}
          keyboardType="number-pad"
          maxLength={9}
        />
        <Campo
          ref={refPessoas}
          rotulo="Quantas pessoas moram na sua casa?"
          erro={erroDe('pessoas')}
          value={pessoas}
          onChangeText={(texto) => setPessoas(somenteDigitos(texto))}
          onBlur={() => mostrar('pessoas')}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Opcoes
          rotulo="Escolaridade"
          opcoes={ESCOLARIDADES}
          selecionada={escolaridade}
          onChange={setEscolaridade}
        />
        <Opcoes
          rotulo="Recebe benefício de programa social, como o Bolsa Família?"
          opcoes={SIM_NAO}
          selecionada={programaSocial}
          onChange={setProgramaSocial}
        />

        <View style={styles.consentimento}>
          <Switch
            value={consentimento}
            onValueChange={setConsentimento}
            accessibilityLabel={TEXTO_CONSENTIMENTO}
            trackColor={{ true: Cores.previna600, false: Cores.borda }}
            thumbColor={Cores.fundo}
          />
          <Text style={styles.textoConsentimento} onPress={() => setConsentimento(!consentimento)}>
            {TEXTO_CONSENTIMENTO}
          </Text>
        </View>

        {erro && <Alerta mensagem={erro} />}

        <Botao
          rotulo={enviando ? 'Salvando…' : 'Salvar e continuar'}
          estilo="primario"
          desabilitado={enviando}
          onPress={salvar}
        />
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  formulario: {
    gap: Espaco.cinco,
  },
  secao: {
    gap: Espaco.um,
    marginTop: Espaco.tres,
  },
  tituloSecao: {
    fontFamily: Fontes.seminegrito,
    fontSize: 17,
    color: Cores.texto,
  },
  textoSecao: {
    fontFamily: Fontes.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Cores.textoSecundario,
  },
  consentimento: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Espaco.tres,
    marginTop: Espaco.tres,
  },
  textoConsentimento: {
    flex: 1,
    fontFamily: Fontes.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Cores.rotulo,
  },
});
