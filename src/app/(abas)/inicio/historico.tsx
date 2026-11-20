import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecaoAgendamentos,
  separarAgendamentos,
  type AgendamentosSeparados,
  type Agendamento,
} from '@/components/agendamento';
import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { get } from '@/lib/api';

// Tudo o que o médico marcou, numa chamada só (sem o filtro "pendentes"): os pendentes primeiro e depois o
// que ele já resolveu (realizado ou não compareceu). A separação e a ordem ficam em separarAgendamentos.
export default function HistoricoScreen() {
  const [agendamentos, setAgendamentos] = useState<AgendamentosSeparados>();
  const [erro, setErro] = useState<string>();
  const [recarregando, setRecarregando] = useState(false);

  const carregar = useCallback(
    () =>
      get<Agendamento[]>('/gestantes/agendamentos')
        .then((dados) => {
          setAgendamentos(separarAgendamentos(dados));
          setErro(undefined);
        })
        .catch(() => setErro('Não foi possível carregar seu histórico. Verifique sua conexão.')),
    [],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Puxar para recarregar: o indicador some quando a resposta chega, com sucesso ou erro. Se der erro, a
  // lista que já estava na tela continua, com o alerta em cima.
  function recarregar() {
    setRecarregando(true);
    void carregar().finally(() => setRecarregando(false));
  }

  const nenhum = agendamentos?.pendentes.length === 0 && agendamentos.concluidos.length === 0;

  return (
    <Tela
      titulo="Histórico de exames e consultas"
      descricao="Primeiro o que ainda vai acontecer, da data mais próxima para a mais distante. Depois o que seu médico já confirmou, do mais recente para o mais antigo."
      alinharTopo
      edges={['top', 'left', 'right']}
      recarregando={recarregando}
      onRecarregar={recarregar}>
      <View style={styles.conteudo}>
        {erro ? <Alerta mensagem={erro} /> : null}
        {!erro && !agendamentos ? <Text style={styles.aviso}>Carregando…</Text> : null}
        {nenhum ? (
          <Text style={styles.aviso}>
            Você ainda não tem exames nem consultas. Seu médico cadastra os próximos nas consultas
            de pré-natal, e eles aparecem aqui.
          </Text>
        ) : null}
        {agendamentos && !nenhum ? (
          <>
            <SecaoAgendamentos
              titulo="Pendentes"
              agendamentos={agendamentos.pendentes}
              vazio="Você não tem exames nem consultas pendentes. Seu médico cadastra os próximos nas consultas de pré-natal."
            />
            <SecaoAgendamentos
              titulo="Concluídos"
              agendamentos={agendamentos.concluidos}
              vazio="Quando o médico confirmar um exame ou consulta, ele aparece aqui."
            />
          </>
        ) : null}

        <Botao rotulo="Voltar" estilo="secundario" onPress={() => router.back()} />
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Espaco.cinco,
  },
  aviso: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
