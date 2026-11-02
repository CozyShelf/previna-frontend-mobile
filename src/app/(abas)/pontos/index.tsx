import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { ItemPontos } from '@/components/item-pontos';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { get } from '@/lib/api';

interface AtividadePontuada {
  agendamento: number;
  nome: string;
  categoria: 'EXAME' | 'CONSULTA';
  pontos: number;
  dataHora: string;
}

interface Pontuacao {
  saldo: number;
  atividades: AtividadePontuada[];
}

const CATEGORIAS = { EXAME: 'Exame', CONSULTA: 'Consulta' };

export default function PontuacaoScreen() {
  const [pontuacao, setPontuacao] = useState<Pontuacao>();
  const [erro, setErro] = useState<string>();

  // Recarrega ao voltar para a aba: o médico pode ter confirmado uma consulta nesse meio-tempo
  useFocusEffect(
    useCallback(() => {
      get<Pontuacao>('/gestantes/pontuacao')
        .then((dados) => {
          setPontuacao(dados);
          setErro(undefined);
        })
        .catch(() => setErro('Não foi possível carregar seus pontos. Verifique sua conexão.'));
    }, []),
  );

  return (
    <Tela
      titulo="Minha pontuação"
      descricao="Você ganha pontos a cada consulta e exame do pré-natal e pode trocá-los por cupons."
      edges={['top', 'left', 'right']}>
      {erro && <Alerta mensagem={erro} />}
      {pontuacao && (
        <View style={styles.conteudo}>
          <View style={styles.saldo} accessible accessibilityLabel={`Saldo: ${pontuacao.saldo} pontos`}>
            <Text style={styles.saldoRotulo}>Saldo</Text>
            <Text style={styles.saldoValor}>{pontuacao.saldo}</Text>
            <Text style={styles.saldoRotulo}>pontos</Text>
          </View>

          <View>
            <Text style={styles.secao} accessibilityRole="header">
              Consultas e exames que geraram pontos
            </Text>
            {pontuacao.atividades.length === 0 ? (
              <Text style={styles.vazio}>
                Seus pontos aparecem aqui depois que o médico confirma a realização de uma consulta ou exame.
              </Text>
            ) : (
              pontuacao.atividades.map((atividade) => (
                <ItemPontos
                  key={atividade.agendamento}
                  titulo={atividade.nome}
                  categoria={CATEGORIAS[atividade.categoria]}
                  dataHora={atividade.dataHora}
                  pontos={atividade.pontos}
                />
              ))
            )}
          </View>

          <Botao rotulo="Ver extrato" estilo="secundario" onPress={() => router.push('/pontos/extrato')} />
        </View>
      )}
    </Tela>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Espaco.seis,
  },
  saldo: {
    alignItems: 'center',
    borderRadius: Raio,
    backgroundColor: Cores.previna50,
    paddingVertical: Espaco.cinco,
  },
  saldoRotulo: {
    fontFamily: Fontes.media,
    fontSize: 14,
    color: Cores.previna700,
  },
  saldoValor: {
    fontFamily: Fontes.seminegrito,
    fontSize: 40,
    lineHeight: 48,
    color: Cores.previna700,
  },
  secao: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
    marginBottom: Espaco.um,
  },
  vazio: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
