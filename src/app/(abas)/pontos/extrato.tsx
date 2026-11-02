import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { ItemPontos } from '@/components/item-pontos';
import { Opcoes, type Opcao } from '@/components/opcoes';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { get } from '@/lib/api';

type Tipo = 'CREDITO' | 'DEBITO';
type Periodo = '30' | '90';

interface Transacao {
  id: number;
  tipo: Tipo;
  pontos: number;
  descricao: string;
  dataHora: string;
}

interface Extrato {
  totalGanho: number;
  totalGasto: number;
  historico: Transacao[];
}

const TIPOS: Opcao<Tipo>[] = [
  { valor: 'CREDITO', rotulo: 'Ganhos' },
  { valor: 'DEBITO', rotulo: 'Gastos' },
];

const PERIODOS: Opcao<Periodo>[] = [
  { valor: '30', rotulo: 'Últimos 30 dias' },
  { valor: '90', rotulo: 'Últimos 90 dias' },
];

// Data local (AAAA-MM-DD) de alguns dias atrás, no formato que a API espera
function diasAtras(dias: number) {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export default function ExtratoScreen() {
  const [tipo, setTipo] = useState<Tipo>();
  const [periodo, setPeriodo] = useState<Periodo>();
  const [extrato, setExtrato] = useState<Extrato>();
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    // Descarta a resposta de um filtro anterior que chegue depois da do filtro atual
    let atual = true;
    const filtros = new URLSearchParams();
    if (tipo) {
      filtros.set('tipo', tipo);
    }
    if (periodo) {
      filtros.set('inicio', diasAtras(Number(periodo)));
    }
    get<Extrato>(`/gestantes/extrato?${filtros}`)
      .then((dados) => {
        if (atual) {
          setExtrato(dados);
          setErro(undefined);
        }
      })
      .catch(() => atual && setErro('Não foi possível carregar o extrato. Verifique sua conexão.'));
    return () => {
      atual = false;
    };
  }, [tipo, periodo]);

  return (
    <Tela
      titulo="Extrato de pontos"
      descricao="Os pontos que você ganhou nas consultas e exames e os que trocou por cupons."
      edges={['top', 'left', 'right']}>
      <View style={styles.conteudo}>
        <Opcoes rotulo="Tipo" opcoes={TIPOS} selecionada={tipo} onChange={setTipo} />
        <Opcoes rotulo="Período" opcoes={PERIODOS} selecionada={periodo} onChange={setPeriodo} />

        {erro && <Alerta mensagem={erro} />}
        {extrato && (
          <>
            <View style={styles.totais}>
              <View style={styles.total} accessible accessibilityLabel={`Total ganho: ${extrato.totalGanho} pontos`}>
                <Text style={styles.totalRotulo}>Total ganho</Text>
                <Text style={[styles.totalValor, styles.ganho]}>+{extrato.totalGanho}</Text>
              </View>
              <View style={styles.total} accessible accessibilityLabel={`Total gasto: ${extrato.totalGasto} pontos`}>
                <Text style={styles.totalRotulo}>Total gasto</Text>
                <Text style={styles.totalValor}>−{extrato.totalGasto}</Text>
              </View>
            </View>

            <View>
              {extrato.historico.length === 0 ? (
                <Text style={styles.vazio}>Nenhuma movimentação de pontos neste filtro.</Text>
              ) : (
                extrato.historico.map((transacao) => (
                  <ItemPontos
                    key={transacao.id}
                    titulo={transacao.descricao}
                    dataHora={transacao.dataHora}
                    pontos={transacao.tipo === 'CREDITO' ? transacao.pontos : -transacao.pontos}
                  />
                ))
              )}
            </View>
          </>
        )}

        <Botao rotulo="Voltar" estilo="secundario" onPress={() => router.back()} />
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Espaco.cinco,
  },
  totais: {
    flexDirection: 'row',
    gap: Espaco.tres,
  },
  total: {
    flex: 1,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    padding: Espaco.tres,
    gap: 2,
  },
  totalRotulo: {
    fontFamily: Fontes.media,
    fontSize: 13,
    color: Cores.textoSecundario,
  },
  totalValor: {
    fontFamily: Fontes.seminegrito,
    fontSize: 22,
    color: Cores.texto,
  },
  ganho: {
    color: Cores.sucesso,
  },
  vazio: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
