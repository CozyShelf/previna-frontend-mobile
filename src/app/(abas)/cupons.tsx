import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { agruparPorLoja, formatarPontos, SecaoLoja, type CupomDisponivel, type Loja } from '@/components/cupom';
import { DialogoResgate, type CupomResgatado } from '@/components/dialogo-resgate';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { ApiError, get, post } from '@/lib/api';

interface Pontuacao {
  saldo: number;
}

export default function CuponsScreen() {
  const [lojas, setLojas] = useState<Loja[]>();
  const [saldo, setSaldo] = useState(0);
  const [erro, setErro] = useState<string>();
  const [selecionado, setSelecionado] = useState<CupomDisponivel>();
  const [resgatado, setResgatado] = useState<CupomResgatado>();
  const [erroResgate, setErroResgate] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  // O estado só desabilita o botão no próximo render: dois toques rápidos mandariam dois resgates e gastariam
  // os pontos em dobro. A ref barra o segundo toque na hora.
  const emEnvio = useRef(false);

  const carregar = useCallback(() => {
    Promise.all([get<CupomDisponivel[]>('/cupons/disponiveis'), get<Pontuacao>('/gestantes/pontuacao')])
      .then(([cupons, pontuacao]) => {
        setLojas(agruparPorLoja(cupons));
        setSaldo(pontuacao.saldo);
        setErro(undefined);
      })
      .catch(() => setErro('Não foi possível carregar os cupons. Verifique sua conexão.'));
  }, []);

  // Recarrega ao voltar para a aba: a empresa pode ter desativado um cupom e o saldo pode ter mudado
  useFocusEffect(carregar);

  async function resgatar() {
    if (!selecionado || emEnvio.current) {
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErroResgate(undefined);
    try {
      const resposta = await post<CupomResgatado>(`/cupons/${selecionado.id}/resgatar`, {});
      setResgatado(resposta);
      setSaldo(resposta.saldo);
    } catch (e) {
      // 404 "Cupom não encontrado", 409 "Cupom indisponível" ou "Pontos insuficientes", com a mensagem da API:
      // a lista ou o saldo na tela estavam desatualizados, então recarrega
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
        setErroResgate(`${e.mensagem ?? 'Cupom indisponível'}. A lista de cupons foi atualizada.`);
        carregar();
      } else {
        setErroResgate('Não foi possível resgatar o cupom. Verifique sua conexão e tente de novo.');
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  function fechar() {
    setSelecionado(undefined);
    setResgatado(undefined);
    setErroResgate(undefined);
  }

  return (
    <Tela
      titulo="Cupons"
      descricao="Troque seus pontos por descontos nos produtos das empresas parceiras."
      alinharTopo
      edges={['top', 'left', 'right']}>
      {erro && <Alerta mensagem={erro} />}
      {lojas && (
        <View style={styles.conteudo}>
          <View style={styles.saldo} accessible accessibilityLabel={`Seu saldo: ${formatarPontos(saldo)}`}>
            <Text style={styles.saldoRotulo}>Seu saldo</Text>
            <Text style={styles.saldoValor}>{formatarPontos(saldo)}</Text>
          </View>

          {lojas.length === 0 ? (
            <Text style={styles.vazio}>
              Nenhum cupom disponível no momento. Novos cupons das empresas parceiras aparecem aqui.
            </Text>
          ) : (
            lojas.map((loja) => (
              <SecaoLoja key={loja.empresa.id} loja={loja} saldo={saldo} onResgatar={setSelecionado} />
            ))
          )}
        </View>
      )}

      <DialogoResgate
        cupom={selecionado}
        saldo={saldo}
        resgatado={resgatado}
        erro={erroResgate}
        enviando={enviando}
        onConfirmar={() => void resgatar()}
        onFechar={fechar}
      />
    </Tela>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Espaco.oito,
  },
  saldo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Raio,
    backgroundColor: Cores.previna50,
    paddingHorizontal: Espaco.quatro,
    paddingVertical: Espaco.tres,
  },
  saldoRotulo: {
    fontFamily: Fontes.media,
    fontSize: 14,
    color: Cores.previna700,
  },
  saldoValor: {
    fontFamily: Fontes.seminegrito,
    fontSize: 20,
    color: Cores.previna700,
  },
  vazio: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
