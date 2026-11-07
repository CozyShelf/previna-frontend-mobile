import { StyleSheet, Text, View } from 'react-native';

import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';

// Mesmos valores do enum StatusAgendamento no backend, com os mesmos rótulos do portal web
const ROTULO_STATUS = {
  AGENDADO: 'Pendente',
  REALIZADO: 'Realizado',
  NAO_COMPARECEU: 'Não compareceu',
} as const;

export type StatusAgendamento = keyof typeof ROTULO_STATUS;

export interface Agendamento {
  id: number;
  tipo: string;
  categoria: 'EXAME' | 'CONSULTA';
  pontosBase: number;
  dataPrevista: string;
  status: StatusAgendamento;
  dataConfirmacao?: string;
  observacao?: string;
}

// aaaa-mm-dd -> dd/mm/aaaa
const formatarData = (data: string) => data.split('-').reverse().join('/');

// A separação deixou de ser por data: pendente é o que o médico ainda não resolveu, mesmo com a data
// já passada. O backend separa e ordena (/gestantes/agendamentos?pendentes=true|false).

export interface CartaoAgendamentoProps {
  agendamento: Agendamento;
}

// Só leitura: quem confirma a realização é o médico, no portal
export function CartaoAgendamento({ agendamento }: CartaoAgendamentoProps) {
  const selo = CORES_SELO[agendamento.status];

  return (
    <View style={styles.cartao}>
      <View style={styles.cabecalho}>
        <Text style={styles.tipo}>{agendamento.tipo}</Text>
        <View style={[styles.selo, { backgroundColor: selo.fundo }]}>
          <Text style={[styles.seloTexto, { color: selo.texto }]}>
            {ROTULO_STATUS[agendamento.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.data}>{formatarData(agendamento.dataPrevista)}</Text>
      {agendamento.observacao ? (
        <Text style={styles.observacao}>{agendamento.observacao}</Text>
      ) : null}
      {/* O valor creditado é pontosBase x fator de ponderação e aparece na aba Pontos: mostrar
          pontosBase aqui mentiria assim que o fator deixar de ser 1,00. */}
    </View>
  );
}

export interface SecaoAgendamentosProps {
  titulo: string;
  agendamentos: Agendamento[];
  // Quantos existem ao todo, quando a tela mostra só uma parte (a home mostra os primeiros pendentes)
  total?: number;
}

// Seção vazia não aparece: a gestante só vê o que ela tem
export function SecaoAgendamentos({ titulo, agendamentos, total }: SecaoAgendamentosProps) {
  if (agendamentos.length === 0) {
    return null;
  }

  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo} accessibilityRole="header">
        {titulo} ({total ?? agendamentos.length})
      </Text>
      {agendamentos.map((agendamento) => (
        <CartaoAgendamento key={agendamento.id} agendamento={agendamento} />
      ))}
    </View>
  );
}

// Mesmas cores das pílulas do portal: âmbar espera uma ação do médico, esmeralda concluiu, zinc é neutro
const CORES_SELO: Record<StatusAgendamento, { fundo: string; texto: string }> = {
  AGENDADO: { fundo: '#fffbeb', texto: '#92400e' },
  REALIZADO: { fundo: '#ecfdf5', texto: '#047857' },
  NAO_COMPARECEU: { fundo: '#f4f4f5', texto: '#52525b' },
};

const styles = StyleSheet.create({
  secao: {
    gap: Espaco.tres,
  },
  secaoTitulo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
  },
  cartao: {
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    padding: Espaco.quatro,
    gap: Espaco.um,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Espaco.dois,
  },
  tipo: {
    flex: 1,
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
  },
  selo: {
    borderRadius: 999,
    paddingHorizontal: Espaco.dois,
    paddingVertical: 2,
  },
  seloTexto: {
    fontFamily: Fontes.media,
    fontSize: 12,
  },
  data: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    color: Cores.textoSecundario,
  },
  observacao: {
    fontFamily: Fontes.regular,
    fontSize: 14,
    color: Cores.textoSecundario,
  },
});
