import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SecaoAgendamentos, type Agendamento } from '@/components/agendamento';
import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { get } from '@/lib/api';

// Tudo o que a home mostra em parte: os exames e consultas que o médico ainda não resolveu
export default function ConsultasScreen() {
  const [pendentes, setPendentes] = useState<Agendamento[]>();
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    get<Agendamento[]>('/gestantes/agendamentos?pendentes=true')
      .then(setPendentes)
      .catch(() =>
        setErro('Não foi possível carregar seus exames e consultas. Verifique sua conexão.'),
      );
  }, []);

  return (
    <Tela
      titulo="Exames e consultas pendentes"
      descricao="O que seu médico marcou e ainda não confirmou, da data mais próxima para a mais distante."
      alinharTopo
      edges={['top', 'left', 'right']}>
      <View style={styles.conteudo}>
        {erro ? <Alerta mensagem={erro} /> : null}
        {!erro && !pendentes ? <Text style={styles.aviso}>Carregando…</Text> : null}
        {pendentes?.length === 0 ? (
          <Text style={styles.aviso}>
            Você não tem exames nem consultas pendentes. Seu médico cadastra os próximos nas
            consultas de pré-natal.
          </Text>
        ) : null}
        {pendentes ? <SecaoAgendamentos titulo="Pendentes" agendamentos={pendentes} /> : null}

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
