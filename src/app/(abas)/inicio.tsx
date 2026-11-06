import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SecaoAgendamentos, separarPorData, type Agendamento } from '@/components/agendamento';
import { Alerta } from '@/components/alerta';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { get } from '@/lib/api';
import { lembrarSessao } from '@/lib/sessao';

export default function InicioScreen() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>();
  const [erro, setErro] = useState<string>();

  // Chegar aqui significa primeiro acesso e tutorial concluídos
  useEffect(() => {
    lembrarSessao();
  }, []);

  // Recarrega ao voltar para a aba: o médico pode ter confirmado uma consulta nesse meio-tempo
  useFocusEffect(
    useCallback(() => {
      get<Agendamento[]>('/gestantes/agendamentos')
        .then((dados) => {
          setAgendamentos(dados);
          setErro(undefined);
        })
        .catch(() =>
          setErro('Não foi possível carregar seus exames e consultas. Verifique sua conexão.'),
        );
    }, []),
  );

  return (
    <Tela
      titulo="Meus exames e consultas"
      descricao="Acompanhe o que seu médico marcou no pré-natal e o que já foi realizado."
      alinharTopo
      edges={['top', 'left', 'right']}>
      <View style={styles.lista}>
        {erro ? <Alerta mensagem={erro} /> : null}
        {!erro && !agendamentos ? <Text style={styles.aviso}>Carregando…</Text> : null}
        {agendamentos?.length === 0 ? (
          <Text style={styles.aviso}>
            Você ainda não tem exames ou consultas cadastrados. Seu médico vai cadastrá-los nas suas
            consultas de pré-natal.
          </Text>
        ) : null}
        {/* A ordem do backend é a do portal (pendentes primeiro); aqui a gestante quer saber o que
            ainda vem, então a lista é separada e reordenada por data */}
        {agendamentos ? <Agenda agendamentos={agendamentos} /> : null}
      </View>
    </Tela>
  );
}

function Agenda({ agendamentos }: { agendamentos: Agendamento[] }) {
  const { proximos, passados } = separarPorData(agendamentos);

  return (
    <>
      <SecaoAgendamentos titulo="Próximos" agendamentos={proximos} />
      <SecaoAgendamentos titulo="Já passaram" agendamentos={passados} />
    </>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: Espaco.seis,
  },
  aviso: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
