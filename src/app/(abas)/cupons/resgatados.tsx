import { router, useFocusEffect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AbasCupons } from '@/components/abas-cupons';
import { Alerta } from '@/components/alerta';
import { Botao } from '@/components/botao';
import { PainelFiltros } from '@/components/filtros-ofertas';
import { Opcoes, type Opcao } from '@/components/opcoes';
import { CartaoResgate } from '@/components/resgate';
import { RodapePaginacao } from '@/components/rodape-paginacao';
import { TelaLista } from '@/components/tela';
import { Cores, Espaco, Fontes } from '@/constants/theme';
import { usePaginacao } from '@/lib/paginacao';
import {
  caminhoResgates,
  temFiltroResgates,
  type FiltrosResgates,
  type Resgate,
  type StatusResgate,
} from '@/lib/resgates';

// Mesma espera da Loja: uma requisição por palavra, e não por letra
const ESPERA_BUSCA = 400;

const ERRO_LISTA = 'Não foi possível carregar seus cupons resgatados. Verifique sua conexão.';

const STATUS: Opcao<StatusResgate>[] = [
  { valor: 'ATIVO', rotulo: 'Ativos' },
  { valor: 'UTILIZADO', rotulo: 'Utilizados' },
  { valor: 'EXPIRADO', rotulo: 'Expirados' },
];

export default function ResgatadosScreen() {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtros, setFiltros] = useState<Omit<FiltrosResgates, 'busca'>>({});

  useEffect(() => {
    const espera = setTimeout(() => setBuscaAplicada(busca.trim()), ESPERA_BUSCA);
    return () => clearTimeout(espera);
  }, [busca]);

  const filtrosAtivos: FiltrosResgates = { ...filtros, busca: buscaAplicada };
  const lista = usePaginacao<Resgate>(caminhoResgates(filtrosAtivos), ERRO_LISTA);
  const { atualizar, recarregar } = lista;

  // Recarrega ao voltar para esta tela: um cupom pode ter sido usado na loja ou vencido nesse meio-tempo
  useFocusEffect(atualizar);

  function limparFiltros() {
    setBusca('');
    setBuscaAplicada('');
    setFiltros({});
  }

  function verCodigo(resgate: Resgate) {
    router.push({ pathname: '/cupons/resgatado/[id]', params: { id: String(resgate.id) } });
  }

  return (
    <TelaLista
      titulo="Cupons"
      descricao="Os cupons e promoções que você resgatou. Toque em “Ver código” para mostrar no caixa da loja."
      cabecalho={
        <View style={styles.cabecalho}>
          <AbasCupons ativa="resgatados" />
          <PainelFiltros
            busca={busca}
            onBusca={setBusca}
            filtros={filtros}
            onFiltros={setFiltros}
            placeholder="Cupom, produto ou empresa">
            <Opcoes
              rotulo="Status"
              opcoes={STATUS}
              selecionada={filtros.status}
              onChange={(status) => setFiltros({ ...filtros, status })}
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
      chave={(resgate) => String(resgate.id)}
      renderizar={(resgate) => <CartaoResgate resgate={resgate} onVerCodigo={verCodigo} />}
      espacoEntreItens={Espaco.tres}
      vazio={
        temFiltroResgates(filtrosAtivos) ? (
          <View style={styles.vazio}>
            <Text style={styles.aviso}>Nenhum cupom resgatado com esses filtros.</Text>
            <Botao rotulo="Limpar filtros" estilo="secundario" onPress={limparFiltros} />
          </View>
        ) : (
          <View style={styles.vazio}>
            <Text style={styles.aviso}>
              Você ainda não resgatou cupons nem promoções. Na Loja Cupons, troque seus pontos por cupons ou resgate
              promoções grátis.
            </Text>
            <Botao rotulo="Ir para a Loja Cupons" estilo="secundario" onPress={() => router.replace('/cupons')} />
          </View>
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
      onRecarregar={recarregar}
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
