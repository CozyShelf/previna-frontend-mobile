import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { CartaoProduto } from '@/components/cupom';
import { RodapePaginacao } from '@/components/rodape-paginacao';
import { TelaLista } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import {
  comFiltros,
  descreverFiltros,
  parametrosParaFiltros,
  temFiltro,
  type FiltrosOfertas,
  type ParametrosFiltros,
  type ProdutoOfertaResumo,
} from '@/lib/ofertas';
import { usePaginacao } from '@/lib/paginacao';

const ERRO_LISTA = 'Não foi possível carregar os produtos. Verifique sua conexão.';
// Empresa inexistente (404) ou id inválido; empresa sem oferta devolve página vazia
const INDISPONIVEL = 'Esta empresa não está mais disponível.';

// Dois produtos por linha. A grade é montada aqui (e não com numColumns) para cada linha ocupar a mesma
// coluna centralizada das outras telas.
function emLinhas(produtos: ProdutoOfertaResumo[]) {
  const linhas: ProdutoOfertaResumo[][] = [];
  for (let i = 0; i < produtos.length; i += 2) {
    linhas.push(produtos.slice(i, i + 2));
  }
  return linhas;
}

// "Ver todos" de uma empresa: os produtos dela com oferta, com os mesmos filtros da lista de onde veio
export default function EmpresaScreen() {
  const { id, nome, ...parametros } = useLocalSearchParams<ParametrosFiltros & { id: string; nome?: string }>();
  // O id vai no caminho da API: só número, para a URL não apontar outro endpoint
  const idValido = /^\d+$/.test(id ?? '');
  const [filtros, setFiltros] = useState<FiltrosOfertas>(() => parametrosParaFiltros(parametros));

  const lista = usePaginacao<ProdutoOfertaResumo>(
    // Com id inválido nada é buscado (ver o efeito abaixo)
    comFiltros(`/ofertas/empresas/${id}/produtos`, filtros),
    ERRO_LISTA,
    INDISPONIVEL,
  );
  const { atualizar, recarregar } = lista;
  const erro = idValido ? lista.erro : INDISPONIVEL;

  // Ao voltar do detalhe de um produto a lista é atualizada: um resgate muda o "cabe no meu saldo"
  useFocusEffect(
    useCallback(() => {
      if (idValido) {
        atualizar();
      }
    }, [idValido, atualizar]),
  );

  const linhas = lista.itens && emLinhas(lista.itens);

  function abrirProduto(produto: ProdutoOfertaResumo) {
    router.push({ pathname: '/cupons/produto/[id]', params: { id: String(produto.id) } });
  }

  return (
    <TelaLista
      titulo={nome || 'Produtos da empresa'}
      descricao="Todos os produtos desta empresa com cupom ou promoção."
      cabecalho={
        <View style={styles.cabecalho}>
          {temFiltro(filtros) ? (
            <View style={styles.filtros}>
              <Text style={styles.aviso}>Filtros: {descreverFiltros(filtros)}</Text>
              <Botao rotulo="Ver sem filtros" estilo="secundario" onPress={() => setFiltros({})} />
            </View>
          ) : null}
          {erro ? <Alerta mensagem={erro} /> : null}
          {!erro && !lista.itens ? <Text style={styles.aviso}>Carregando…</Text> : null}
        </View>
      }
      itens={idValido ? linhas : undefined}
      chave={(linha) => linha.map((produto) => produto.id).join('-')}
      renderizar={(linha) => (
        <View style={styles.linha}>
          {linha.map((produto) => (
            <CartaoProduto key={produto.id} produto={produto} onAbrir={abrirProduto} largura="coluna" />
          ))}
          {/* Linha com um produto só: o espaço vazio mantém o cartão do tamanho dos outros */}
          {linha.length === 1 ? <View style={styles.vaga} /> : null}
        </View>
      )}
      vazio={
        <Text style={styles.aviso}>
          {temFiltro(filtros)
            ? 'Nenhum produto desta empresa com esses filtros.'
            : 'Esta empresa não tem ofertas no momento.'}
        </Text>
      }
      rodape={
        <View style={styles.rodape}>
          <RodapePaginacao
            carregando={lista.carregandoMais}
            erro={lista.erroMais}
            onTentarDeNovo={lista.tentarMaisDeNovo}
          />
          <Botao rotulo="Voltar" estilo="secundario" onPress={() => router.back()} />
        </View>
      }
      espacoEntreItens={Espaco.tres}
      recarregando={lista.recarregando}
      onRecarregar={recarregar}
      onFimDaLista={lista.carregarMais}
    />
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    gap: Espaco.cinco,
  },
  filtros: {
    gap: Espaco.tres,
  },
  linha: {
    flexDirection: 'row',
    gap: Espaco.tres,
  },
  vaga: {
    flex: 1,
  },
  rodape: {
    gap: Espaco.cinco,
  },
  aviso: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
