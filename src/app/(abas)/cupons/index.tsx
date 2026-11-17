import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { Saldo, SecaoEmpresa } from '@/components/cupom';
import { FiltroCabeNoSaldo, PainelFiltros } from '@/components/filtros-ofertas';
import { RodapePaginacao } from '@/components/rodape-paginacao';
import { TelaLista } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import {
  buscarSaldo,
  comFiltros,
  filtrosParaParametros,
  temFiltro,
  type FiltrosOfertas,
  type OfertaEmpresa,
  type ProdutoOfertaResumo,
} from '@/lib/ofertas';
import { usePaginacao } from '@/lib/paginacao';

// Tempo sem digitar antes de buscar: uma requisição por palavra, e não por letra
const ESPERA_BUSCA = 400;

const ERRO_LISTA = 'Não foi possível carregar as ofertas. Verifique sua conexão.';

export default function CuponsScreen() {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtros, setFiltros] = useState<Omit<FiltrosOfertas, 'busca'>>({});
  const [saldo, setSaldo] = useState<number>();

  useEffect(() => {
    const espera = setTimeout(() => setBuscaAplicada(busca.trim()), ESPERA_BUSCA);
    return () => clearTimeout(espera);
  }, [busca]);

  const filtrosAtivos: FiltrosOfertas = { ...filtros, busca: buscaAplicada };
  // Os filtros ficam no backend: a lista é paginada, e filtrar aqui só veria as páginas já carregadas
  const lista = usePaginacao<OfertaEmpresa>(comFiltros('/ofertas', filtrosAtivos), ERRO_LISTA);
  const { atualizar, recarregar } = lista;

  // Sem o saldo a lista continua útil: o quadro do saldo só não aparece (ou fica com o último valor)
  const carregarSaldo = useCallback(() => {
    buscarSaldo()
      .then(setSaldo)
      .catch(() => {});
  }, []);

  // Recarrega ao voltar para a aba ou para esta tela: a empresa pode ter mudado as ofertas e o saldo pode ter
  // mudado com um resgate. Trocar os filtros também passa por aqui (o caminho da lista muda).
  useFocusEffect(
    useCallback(() => {
      carregarSaldo();
      atualizar();
    }, [carregarSaldo, atualizar]),
  );

  function limparFiltros() {
    setBusca('');
    setBuscaAplicada('');
    setFiltros({});
  }

  function abrirProduto(produto: ProdutoOfertaResumo) {
    router.push({ pathname: '/cupons/produto/[id]', params: { id: String(produto.id) } });
  }

  // A tela da empresa recebe os filtros: "Ver todos" mostra o resto do que a gestante estava procurando
  function verTodos(oferta: OfertaEmpresa) {
    router.push({
      pathname: '/cupons/empresa/[id]',
      params: { id: String(oferta.id), nome: oferta.nome, ...filtrosParaParametros(filtrosAtivos) },
    });
  }

  return (
    <TelaLista
      titulo="Cupons"
      descricao="Troque seus pontos por cupons de desconto e resgate grátis as promoções das empresas parceiras."
      cabecalho={
        <View style={styles.cabecalho}>
          {saldo !== undefined ? <Saldo saldo={saldo} /> : null}
          <PainelFiltros busca={busca} onBusca={setBusca} filtros={filtros} onFiltros={setFiltros}>
            <FiltroCabeNoSaldo
              marcado={!!filtros.ateMeusPontos}
              onChange={(marcado) => setFiltros({ ...filtros, ateMeusPontos: marcado || undefined })}
            />
          </PainelFiltros>
          {lista.erro ? <Alerta mensagem={lista.erro} /> : null}
          {lista.erro && !lista.itens ? (
            <Botao rotulo="Tentar de novo" estilo="secundario" onPress={recarregar} />
          ) : null}
          {!lista.erro && !lista.itens ? <Text style={styles.aviso}>Carregando…</Text> : null}
        </View>
      }
      itens={lista.itens}
      chave={(oferta) => String(oferta.id)}
      renderizar={(oferta) => (
        <SecaoEmpresa oferta={oferta} onAbrirProduto={abrirProduto} onVerTodos={verTodos} />
      )}
      vazio={
        temFiltro(filtrosAtivos) ? (
          <View style={styles.vazio}>
            <Text style={styles.aviso}>Nenhuma oferta encontrada com esses filtros.</Text>
            <Botao rotulo="Limpar filtros" estilo="secundario" onPress={limparFiltros} />
          </View>
        ) : (
          <Text style={styles.aviso}>
            Nenhuma oferta disponível no momento. Novos cupons e promoções das empresas parceiras aparecem
            aqui.
          </Text>
        )
      }
      rodape={
        <RodapePaginacao
          carregando={lista.carregandoMais}
          erro={lista.erroMais}
          onTentarDeNovo={lista.tentarMaisDeNovo}
        />
      }
      recarregando={lista.recarregando}
      onRecarregar={() => {
        carregarSaldo();
        recarregar();
      }}
      onFimDaLista={lista.carregarMais}
    />
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    gap: Espaco.seis,
  },
  vazio: {
    gap: Espaco.tres,
  },
  aviso: {
    fontFamily: Fontes.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Cores.textoSecundario,
  },
});
