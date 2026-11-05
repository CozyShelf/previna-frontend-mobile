import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SecaoAgendamentos, type Agendamento } from '@/components/agendamento';
import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { get } from '@/lib/api';

// Só o que já foi resolvido pelo médico: realizado ou não comparecido. O backend devolve do desfecho
// mais recente para o mais antigo.
export default function HistoricoScreen() {
  const [historico, setHistorico] = useState<Agendamento[]>();
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    get<Agendamento[]>('/gestantes/agendamentos?pendentes=false')
      .then(setHistorico)
      .catch(() => setErro('Não foi possível carregar seu histórico. Verifique sua conexão.'));
  }, []);

  return (
    <Tela
      titulo="Histórico de consultas"
      descricao="Os exames e consultas que seu médico já confirmou, do mais recente para o mais antigo."
      alinharTopo
      edges={['top', 'left', 'right']}>
      <View style={styles.conteudo}>
        {erro ? <Alerta mensagem={erro} /> : null}
        {!erro && !historico ? <Text style={styles.aviso}>Carregando…</Text> : null}
        {historico?.length === 0 ? (
          <Text style={styles.aviso}>
            Seu histórico aparece aqui depois que o médico confirmar a realização de um exame ou
            consulta.
          </Text>
        ) : null}
        {historico ? <SecaoAgendamentos titulo="Concluídos" agendamentos={historico} /> : null}

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
