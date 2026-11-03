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

// sv-SE formata a data local como aaaa-mm-dd, o mesmo formato em que a API devolve dataPrevista
const hoje = () => new Date().toLocaleDateString('sv-SE');

// O dia de hoje conta como próximo: ainda pode acontecer. As datas são aaaa-mm-dd, então a comparação
// de texto já é cronológica. O id desempata para a ordem não mudar entre carregamentos.
export function separarPorData(agendamentos: Agendamento[]) {
  const limite = hoje();
  return {
    proximos: agendamentos
      .filter((agendamento) => agendamento.dataPrevista >= limite)
      .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista) || a.id - b.id),
    // Do mais recente para o mais antigo: o que acabou de passar interessa mais
    passados: agendamentos
      .filter((agendamento) => agendamento.dataPrevista < limite)
      .sort((a, b) => b.dataPrevista.localeCompare(a.dataPrevista) || b.id - a.id),
  };
}

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
      {/* O valor creditado é pontosBase x fator de ponderação, e a API não devolve esse número por
          agendamento: mostrar pontosBase aqui mentiria assim que o fator deixar de ser 1,00. */}
    </View>
  );
}

export interface SecaoAgendamentosProps {
  titulo: string;
  agendamentos: Agendamento[];
}

// Seção vazia não aparece: a gestante só vê o que ela tem
export function SecaoAgendamentos({ titulo, agendamentos }: SecaoAgendamentosProps) {
  if (agendamentos.length === 0) {
    return null;
  }

  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo} accessibilityRole="header">
        {titulo} ({agendamentos.length})
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
