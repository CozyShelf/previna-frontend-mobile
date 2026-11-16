import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import {
  CartaoCupom,
  CartaoPromocao,
  FotoProduto,
  LogoEmpresa,
  OfertaAusente,
  Saldo,
} from '@/components/cupom';
import { DialogoResgate, type CupomParaResgate, type CupomResgatado } from '@/components/dialogo-resgate';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { ApiError, get, post } from '@/lib/api';
import { buscarSaldo, ROTULO_CATEGORIA, type CupomOferta, type ProdutoOfertaDetalhe } from '@/lib/ofertas';

// Inexistente, sem oferta ou id inválido têm a mesma resposta: a gestante não precisa saber qual é
const INDISPONIVEL = 'Este produto não tem mais ofertas disponíveis.';

export default function ProdutoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // O id vai no caminho da API: só número, para a URL não apontar outro endpoint
  const idValido = /^\d+$/.test(id ?? '');
  const [produto, setProduto] = useState<ProdutoOfertaDetalhe>();
  const [saldo, setSaldo] = useState(0);
  const [erroDaBusca, setErroDaBusca] = useState<string>();
  const erro = idValido ? erroDaBusca : INDISPONIVEL;

  const [selecionado, setSelecionado] = useState<CupomParaResgate>();
  const [resgatado, setResgatado] = useState<CupomResgatado>();
  const [erroResgate, setErroResgate] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  // O estado só desabilita o botão no próximo render: dois toques rápidos mandariam dois resgates e gastariam
  // os pontos em dobro. A ref barra o segundo toque na hora.
  const emEnvio = useRef(false);

  const carregar = useCallback(() => {
    if (!idValido) {
      return;
    }
    Promise.all([get<ProdutoOfertaDetalhe>(`/ofertas/produtos/${id}`), buscarSaldo()])
      .then(([dados, pontos]) => {
        setProduto(dados);
        setSaldo(pontos);
        setErroDaBusca(undefined);
      })
      .catch((e) => {
        // O produto pode ter perdido as ofertas enquanto a tela estava aberta: some com ele
        if (e instanceof ApiError && e.status === 404) {
          setProduto(undefined);
          setErroDaBusca(INDISPONIVEL);
        } else {
          setErroDaBusca('Não foi possível carregar o produto. Verifique sua conexão.');
        }
      });
  }, [id, idValido]);

  // Recarrega ao voltar para esta tela: o saldo pode ter mudado e a empresa pode ter mudado as ofertas
  useFocusEffect(carregar);

  function escolher(cupom: CupomOferta) {
    if (produto) {
      setSelecionado({ ...cupom, produto: produto.nome, empresa: produto.empresa.nome });
    }
  }

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
      // as ofertas ou o saldo na tela estavam desatualizados, então recarrega
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
        setErroResgate(`${e.mensagem ?? 'Cupom indisponível'}. As ofertas deste produto foram atualizadas.`);
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

  const categoria = produto?.categoria ? ROTULO_CATEGORIA[produto.categoria] : undefined;

  return (
    <Tela
      titulo={produto?.nome ?? 'Produto'}
      descricao={produto ? [categoria, produto.empresa.nome].filter(Boolean).join(' · ') : 'Cupons e promoções do produto.'}
      alinharTopo
      edges={['top', 'left', 'right']}>
      <View style={styles.conteudo}>
        {erro ? <Alerta mensagem={erro} /> : null}
        {!erro && !produto ? <Text style={styles.aviso}>Carregando…</Text> : null}
        {produto ? (
          <>
            <FotoProduto imagem={produto.imagem} tamanho="grande" />
            <View
              style={styles.empresa}
              accessible
              accessibilityLabel={`Vendido por ${produto.empresa.nome}`}>
              <LogoEmpresa empresa={produto.empresa} />
              <View style={styles.textos}>
                <Text style={styles.empresaNome}>{produto.empresa.nome}</Text>
                {produto.empresa.segmento ? <Text style={styles.aviso}>{produto.empresa.segmento}</Text> : null}
              </View>
            </View>
            <Saldo saldo={saldo} />

            <View style={styles.secao}>
              <Text style={styles.secaoTitulo} accessibilityRole="header">
                Cupons
              </Text>
              {produto.cupons.length === 0 ? <OfertaAusente texto="Sem cupom no momento" /> : null}
              {produto.cupons.map((cupom) => (
                <CartaoCupom key={cupom.id} cupom={cupom} saldo={saldo} onResgatar={escolher} />
              ))}
            </View>

            <View style={styles.secao}>
              <Text style={styles.secaoTitulo} accessibilityRole="header">
                Promoção
              </Text>
              {produto.promocoes.length === 0 ? <OfertaAusente texto="Sem promoção para este produto" /> : null}
              {produto.promocoes.map((promocao) => (
                <CartaoPromocao key={promocao.id} promocao={promocao} />
              ))}
            </View>
          </>
        ) : null}

        <Botao rotulo="Voltar" estilo="secundario" onPress={() => router.back()} />
      </View>

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
    gap: Espaco.seis,
  },
  empresa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.tres,
  },
  textos: {
    flex: 1,
    gap: Espaco.um,
  },
  empresaNome: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
  },
  secao: {
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
