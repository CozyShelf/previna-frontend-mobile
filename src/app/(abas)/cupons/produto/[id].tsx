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
import { DialogoResgate, type CupomResgatado, type OfertaParaResgate } from '@/components/dialogo-resgate';
import { Tela } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { ApiError, get, post } from '@/lib/api';
import { gerarChaveIdempotencia } from '@/lib/idempotencia';
import {
  buscarSaldo,
  ROTULO_CATEGORIA,
  type CupomOferta,
  type ProdutoOfertaDetalhe,
  type PromocaoOferta,
  type TipoOferta,
} from '@/lib/ofertas';

// Inexistente, sem oferta ou id inválido têm a mesma resposta: a gestante não precisa saber qual é
const INDISPONIVEL = 'Este produto não tem mais ofertas disponíveis.';

const ROTA_RESGATE: Record<TipoOferta, string> = { CUPOM: '/cupons', PROMOCAO: '/promocoes' };

export default function ProdutoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // O id vai no caminho da API: só número, para a URL não apontar outro endpoint
  const idValido = /^\d+$/.test(id ?? '');
  const [produto, setProduto] = useState<ProdutoOfertaDetalhe>();
  const [saldo, setSaldo] = useState(0);
  const [erroDaBusca, setErroDaBusca] = useState<string>();
  const erro = idValido ? erroDaBusca : INDISPONIVEL;

  const [selecionado, setSelecionado] = useState<OfertaParaResgate>();
  const [resgatado, setResgatado] = useState<CupomResgatado>();
  const [erroResgate, setErroResgate] = useState<string>();
  // Falha sem resposta conclusiva (rede, 5xx): o resgate pode ter sido feito ou não, então dá para tentar de novo
  const [podeTentarDeNovo, setPodeTentarDeNovo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // O estado só desabilita o botão no próximo render: dois toques rápidos mandariam dois resgates e gastariam
  // os pontos em dobro. A ref barra o segundo toque na hora.
  const emEnvio = useRef(false);
  // Idempotency-Key pendente de cada oferta (id → chave): todas as tentativas de um resgate vão com a mesma, para o
  // servidor não resgatar duas vezes se a primeira chegou e só a resposta se perdeu. Fechar o diálogo depois de uma
  // falha de rede não descarta a chave: reabrir a mesma oferta repete o mesmo resgate. Só a resposta definitiva do
  // servidor (2xx ou 4xx) encerra o resgate; o próximo daquela oferta ganha chave nova. Cupons e promoções têm
  // mapas separados, porque os ids são de tabelas diferentes: o cupom 5 e a promoção 5 não podem dividir a chave.
  const chavesPendentes = useRef<Record<TipoOferta, Map<number, string>>>({ CUPOM: new Map(), PROMOCAO: new Map() });

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

  function escolherCupom(cupom: CupomOferta) {
    if (produto) {
      setSelecionado({ ...cupom, tipo: 'CUPOM', produto: produto.nome, empresa: produto.empresa.nome });
    }
  }

  function escolherPromocao(promocao: PromocaoOferta) {
    if (produto) {
      setSelecionado({ ...promocao, tipo: 'PROMOCAO', produto: produto.nome, empresa: produto.empresa.nome });
    }
  }

  // Marca a promoção como resgatada sem esperar a recarga: o botão do cartão vira "Já resgatada" na hora
  function marcarPromocaoResgatada(promocaoId: number) {
    setProduto((atual) =>
      atual && {
        ...atual,
        promocoes: atual.promocoes.map((p) => (p.id === promocaoId ? { ...p, resgatada: true } : p)),
      },
    );
  }

  async function resgatar() {
    if (!selecionado || emEnvio.current) {
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErroResgate(undefined);
    setPodeTentarDeNovo(false);
    const { tipo, id: ofertaId } = selecionado;
    const promocao = tipo === 'PROMOCAO';
    const chaves = chavesPendentes.current[tipo];
    const chave = chaves.get(ofertaId) ?? gerarChaveIdempotencia();
    chaves.set(ofertaId, chave);
    try {
      // 201 no primeiro resgate e 200 quando o servidor reconhece a chave e devolve o já feito: os dois são sucesso
      const resposta = await post<CupomResgatado>(`${ROTA_RESGATE[tipo]}/${ofertaId}/resgatar`, {}, {
        'Idempotency-Key': chave,
      });
      chaves.delete(ofertaId);
      setResgatado(resposta);
      if (promocao) {
        // A promoção não gasta pontos: o saldo fica como está
        marcarPromocaoResgatada(ofertaId);
      } else {
        setSaldo(resposta.saldo);
      }
    } catch (e) {
      const definitiva = e instanceof ApiError && e.status >= 400 && e.status < 500;
      if (definitiva) {
        chaves.delete(ofertaId);
      }
      if (promocao && e instanceof ApiError && e.codigo === 'PROMOCAO_JA_RESGATADA') {
        // Resgatou antes (em outro aparelho, ou a tela estava desatualizada): o cartão passa a dizer isso. A decisão
        // é pelo código, não pelo texto da API, que pode mudar
        marcarPromocaoResgatada(ofertaId);
        setErroResgate('Você já resgatou esta promoção. Cada promoção só pode ser resgatada uma vez.');
      } else if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
        // 404 "Cupom/Promoção não encontrada" ou 409 com PROMOCAO_INDISPONIVEL, CUPOM_INDISPONIVEL ou
        // PONTOS_INSUFICIENTES, com a mensagem da API: as ofertas ou o saldo na tela estavam desatualizados, então
        // recarrega. Um 409 sem código (backend antigo) segue o mesmo caminho
        const padrao = promocao ? 'Promoção indisponível' : 'Cupom indisponível';
        setErroResgate(`${e.mensagem ?? padrao}. As ofertas deste produto foram atualizadas.`);
        carregar();
      } else {
        // Rede ou 5xx: a chave continua pendente e a nova tentativa, se o primeiro envio chegou, recebe o mesmo resgate
        setErroResgate(
          `Não foi possível resgatar ${promocao ? 'a promoção' : 'o cupom'}. Verifique sua conexão e tente de novo.`,
        );
        setPodeTentarDeNovo(!definitiva);
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  function fechar() {
    setPodeTentarDeNovo(false);
    setSelecionado(undefined);
    setResgatado(undefined);
    setErroResgate(undefined);
  }

  // Fecha o diálogo e abre o detalhe do resgate, com o QR Code; voltar de lá traz para este produto
  function verCodigo(cupom: CupomResgatado) {
    fechar();
    router.push({ pathname: '/cupons/resgatado/[id]', params: { id: String(cupom.id) } });
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
                <CartaoCupom key={cupom.id} cupom={cupom} saldo={saldo} onResgatar={escolherCupom} />
              ))}
            </View>

            <View style={styles.secao}>
              <Text style={styles.secaoTitulo} accessibilityRole="header">
                Promoção
              </Text>
              {produto.promocoes.length === 0 ? <OfertaAusente texto="Sem promoção para este produto" /> : null}
              {produto.promocoes.map((promocao) => (
                <CartaoPromocao key={promocao.id} promocao={promocao} onResgatar={escolherPromocao} />
              ))}
            </View>
          </>
        ) : null}

        <Botao rotulo="Voltar" estilo="secundario" onPress={() => router.back()} />
      </View>

      <DialogoResgate
        oferta={selecionado}
        saldo={saldo}
        resgatado={resgatado}
        erro={erroResgate}
        podeTentarDeNovo={podeTentarDeNovo}
        enviando={enviando}
        onConfirmar={() => void resgatar()}
        onFechar={fechar}
        onVerCodigo={verCodigo}
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
