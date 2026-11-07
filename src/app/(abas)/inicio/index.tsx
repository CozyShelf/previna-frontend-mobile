import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SecaoAgendamentos, type Agendamento } from '@/components/agendamento';
import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { SecaoConteudos, type Conteudo } from '@/components/conteudo';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { get, type Pagina } from '@/lib/api';
import { lembrarSessao } from '@/lib/sessao';

// A home mostra só uma amostra: o resto das consultas está em "Ver todas", e os conteúdos mudam a
// cada carregamento, então uma lista longa aqui não ajudaria ninguém
const LIMITE_PENDENTES = 3;
const LIMITE_CONTEUDOS = 5;

// Semente do sorteio dos conteúdos: uma por carregamento, para a ordem mudar a cada visita mas
// continuar a mesma enquanto a tela estiver aberta
const novaSemente = () => Math.random().toString(36).slice(2);

export default function InicioScreen() {
  const [pendentes, setPendentes] = useState<Agendamento[]>();
  const [conteudos, setConteudos] = useState<Conteudo[]>();
  const [erroConsultas, setErroConsultas] = useState<string>();
  const [erroConteudos, setErroConteudos] = useState<string>();
  const [semente, setSemente] = useState(novaSemente);

  // Chegar aqui significa primeiro acesso e tutorial concluídos
  useEffect(() => {
    lembrarSessao();
  }, []);

  // Recarrega ao voltar para a aba: o médico pode ter confirmado uma consulta nesse meio-tempo,
  // e o sorteio dos conteúdos é refeito
  useFocusEffect(
    useCallback(() => {
      setSemente(novaSemente());
      get<Agendamento[]>('/gestantes/agendamentos?pendentes=true')
        .then((dados) => {
          setPendentes(dados);
          setErroConsultas(undefined);
        })
        .catch(() =>
          setErroConsultas(
            'Não foi possível carregar seus exames e consultas. Verifique sua conexão.',
          ),
        );
    }, []),
  );

  // Separado do bloco acima: trocar a semente sozinha também sorteia de novo
  useEffect(() => {
    // Descarta a resposta de um sorteio anterior que chegue depois do atual
    let atual = true;
    get<Pagina<Conteudo>>(`/conteudos?semente=${semente}&tamanho=${LIMITE_CONTEUDOS}`)
      .then((pagina) => {
        if (atual) {
          setConteudos(pagina.itens);
          setErroConteudos(undefined);
        }
      })
      .catch(
        () =>
          atual &&
          setErroConteudos('Não foi possível carregar os conteúdos. Verifique sua conexão.'),
      );
    return () => {
      atual = false;
    };
  }, [semente]);

  const visiveis = pendentes?.slice(0, LIMITE_PENDENTES) ?? [];
  const restantes = (pendentes?.length ?? 0) - visiveis.length;

  return (
    <Tela
      titulo="Meus exames e consultas"
      descricao="O que seu médico marcou e ainda não confirmou, e conteúdos para acompanhar a gestação."
      alinharTopo
      edges={['top', 'left', 'right']}>
      <View style={styles.blocos}>
        <View style={styles.bloco}>
          {erroConsultas ? <Alerta mensagem={erroConsultas} /> : null}
          {!erroConsultas && !pendentes ? <Text style={styles.aviso}>Carregando…</Text> : null}
          {pendentes?.length === 0 ? (
            <>
              <Text style={styles.secaoTitulo} accessibilityRole="header">
                Pendentes
              </Text>
              <Text style={styles.aviso}>
                Você não tem exames nem consultas pendentes. Seu médico cadastra os próximos nas
                consultas de pré-natal.
              </Text>
            </>
          ) : null}
          <SecaoAgendamentos titulo="Pendentes" agendamentos={visiveis} total={pendentes?.length} />
          {restantes > 0 ? (
            <Botao
              rotulo={`Ver todas (${pendentes?.length})`}
              estilo="secundario"
              onPress={() => router.push('/inicio/consultas')}
            />
          ) : null}
          <Botao
            rotulo="Ver histórico"
            estilo="secundario"
            onPress={() => router.push('/inicio/historico')}
          />
        </View>

        <View style={styles.bloco}>
          <Text style={styles.secaoTitulo} accessibilityRole="header">
            Para você
          </Text>
          {erroConteudos ? <Alerta mensagem={erroConteudos} /> : null}
          {!erroConteudos && !conteudos ? <Text style={styles.aviso}>Carregando…</Text> : null}
          {conteudos?.length === 0 ? (
            <Text style={styles.aviso}>
              Ainda não há conteúdos publicados. Volte em breve para ver dicas sobre a gestação.
            </Text>
          ) : null}
          {conteudos?.length ? (
            <>
              <SecaoConteudos
                conteudos={conteudos}
                onAbrir={(conteudo) => router.push(`/inicio/conteudo/${conteudo.id}`)}
              />
              <Botao
                rotulo="Ver outros conteúdos"
                estilo="secundario"
                onPress={() => setSemente(novaSemente())}
              />
            </>
          ) : null}
        </View>
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  blocos: {
    gap: Espaco.oito,
  },
  bloco: {
    gap: Espaco.tres,
  },
  secaoTitulo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
  },
  aviso: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
