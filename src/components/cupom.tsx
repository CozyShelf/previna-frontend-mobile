import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/botao';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { imagemDaApi } from '@/lib/api';
import type { CupomOferta, EmpresaOferta, OfertaEmpresa, ProdutoOfertaResumo, PromocaoOferta } from '@/lib/ofertas';

// aaaa-mm-dd -> dd/mm/aaaa
export const formatarData = (data: string) => data.split('-').reverse().join('/');

// 12.5 -> "12,5%"
export const formatarDesconto = (desconto: number) => `${String(desconto).replace('.', ',')}%`;

export const formatarPontos = (pontos: number) => `${pontos} ${pontos === 1 ? 'ponto' : 'pontos'}`;

// Textos dos selos de um produto, na ordem em que aparecem
export function selosDoProduto(produto: ProdutoOfertaResumo) {
  const selos: string[] = [];
  if (produto.menorPontos !== null) {
    selos.push(`Cupom · a partir de ${produto.menorPontos} pts`);
  }
  if (produto.descontoPromocao !== null) {
    selos.push(`Promoção ${formatarDesconto(produto.descontoPromocao)}`);
  }
  return selos;
}

// Versão por extenso dos selos, para o leitor de tela
function descreverOfertas(produto: ProdutoOfertaResumo) {
  return [
    produto.menorPontos !== null && `cupom a partir de ${formatarPontos(produto.menorPontos)}`,
    produto.descontoPromocao !== null && `promoção de ${formatarDesconto(produto.descontoPromocao)} de desconto`,
  ]
    .filter(Boolean)
    .join(', ');
}

export function Saldo({ saldo }: { saldo: number }) {
  return (
    <View style={styles.saldo} accessible accessibilityLabel={`Seu saldo: ${formatarPontos(saldo)}`}>
      <Text style={styles.saldoRotulo}>Seu saldo</Text>
      <Text style={styles.saldoValor}>{formatarPontos(saldo)}</Text>
    </View>
  );
}

export function LogoEmpresa({ empresa }: { empresa: EmpresaOferta }) {
  return empresa.logo ? (
    <Image source={imagemDaApi(empresa.logo)} style={styles.logo} contentFit="contain" />
  ) : (
    <View style={[styles.logo, styles.semLogo]}>
      <Text style={styles.inicial}>{empresa.nome.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// Foto do produto ou, sem foto, uma etiqueta no lugar
export function FotoProduto({ imagem, tamanho }: { imagem: string | null; tamanho: 'pequena' | 'grande' }) {
  const estilo = tamanho === 'grande' ? styles.fotoGrande : styles.foto;
  return imagem ? (
    <Image source={imagemDaApi(imagem)} style={estilo} contentFit="cover" />
  ) : (
    <View style={[estilo, styles.semFoto]}>
      <SymbolView
        name={{ ios: 'tag.fill', android: 'sell', web: 'sell' }}
        tintColor={Cores.previna600}
        size={tamanho === 'grande' ? 40 : 28}
      />
    </View>
  );
}

function Selo({ texto }: { texto: string }) {
  return (
    <View style={styles.selo}>
      <Text style={styles.seloTexto}>{texto}</Text>
    </View>
  );
}

interface CartaoProdutoProps {
  produto: ProdutoOfertaResumo;
  onAbrir: (produto: ProdutoOfertaResumo) => void;
  // No carrossel o cartão tem largura fixa; na grade da empresa ocupa a coluna
  largura?: 'fixa' | 'coluna';
}

export function CartaoProduto({ produto, onAbrir, largura = 'fixa' }: CartaoProdutoProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${produto.nome}, ${descreverOfertas(produto)}`}
      onPress={() => onAbrir(produto)}
      style={({ pressed }) => [
        styles.produto,
        largura === 'fixa' ? styles.produtoFixo : styles.produtoColuna,
        pressed && styles.pressionado,
      ]}>
      <FotoProduto imagem={produto.imagem} tamanho="pequena" />
      <Text style={styles.produtoNome} numberOfLines={2}>
        {produto.nome}
      </Text>
      <View style={styles.selos}>
        {selosDoProduto(produto).map((texto) => (
          <Selo key={texto} texto={texto} />
        ))}
      </View>
    </Pressable>
  );
}

interface SecaoEmpresaProps {
  oferta: OfertaEmpresa;
  onAbrirProduto: (produto: ProdutoOfertaResumo) => void;
  onVerTodos: (oferta: OfertaEmpresa) => void;
}

// Uma empresa da lista: cabeçalho com logo e nome e um carrossel com até 10 produtos
export function SecaoEmpresa({ oferta, onAbrirProduto, onVerTodos }: SecaoEmpresaProps) {
  const quantidade = `${oferta.totalProdutos} ${oferta.totalProdutos === 1 ? 'produto' : 'produtos'}`;
  const temMais = oferta.totalProdutos > oferta.produtos.length;

  return (
    <View style={styles.secao}>
      <View style={styles.cabecalho}>
        <View
          style={styles.empresa}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${oferta.nome}, ${quantidade}`}>
          <LogoEmpresa empresa={oferta} />
          <View style={styles.textos}>
            <Text style={styles.empresaNome}>{oferta.nome}</Text>
            <Text style={styles.detalhe}>{[oferta.segmento, quantidade].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        {temMais ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver todos os ${quantidade} de ${oferta.nome}`}
            hitSlop={Espaco.dois}
            onPress={() => onVerTodos(oferta)}>
            <Text style={styles.verTodos}>Ver todos</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carrossel}>
        {oferta.produtos.map((produto) => (
          <CartaoProduto key={produto.id} produto={produto} onAbrir={onAbrirProduto} />
        ))}
      </ScrollView>
    </View>
  );
}

interface CartaoCupomProps {
  cupom: CupomOferta;
  saldo: number;
  onResgatar: (cupom: CupomOferta) => void;
}

// Um cupom do produto: sem saldo suficiente o botão fica desabilitado e diz quanto falta
export function CartaoCupom({ cupom, saldo, onResgatar }: CartaoCupomProps) {
  const faltam = cupom.pontosNecessarios - saldo;
  const validade = `Válido até ${formatarData(cupom.dataValidade)}`;

  return (
    <View style={styles.cartao}>
      <View
        style={styles.cartaoTopo}
        accessible
        accessibilityLabel={`Cupom de ${formatarDesconto(cupom.desconto)} de desconto, ${validade}, custa ${formatarPontos(cupom.pontosNecessarios)}`}>
        <View style={styles.textos}>
          <Text style={styles.cartaoTitulo}>{formatarDesconto(cupom.desconto)} de desconto</Text>
          <Text style={styles.detalhe}>{validade}</Text>
        </View>
        <View style={styles.custo}>
          <Text style={styles.pontos}>{cupom.pontosNecessarios}</Text>
          <Text style={styles.detalhe}>{cupom.pontosNecessarios === 1 ? 'ponto' : 'pontos'}</Text>
        </View>
      </View>
      {faltam > 0 ? <Text style={styles.faltam}>Faltam {formatarPontos(faltam)} para resgatar</Text> : null}
      <Botao rotulo="Resgatar" estilo="primario" desabilitado={faltam > 0} onPress={() => onResgatar(cupom)} />
    </View>
  );
}

// Promoção é informativa: desconto direto na loja, sem pontos e sem código
export function CartaoPromocao({ promocao }: { promocao: PromocaoOferta }) {
  const validade = `Válida até ${formatarData(promocao.dataFim)}`;

  return (
    <View
      style={styles.cartao}
      accessible
      accessibilityLabel={`Promoção de ${formatarDesconto(promocao.desconto)} de desconto: ${promocao.titulo}, ${validade}`}>
      <Selo texto={`Promoção ${formatarDesconto(promocao.desconto)}`} />
      <Text style={styles.cartaoTitulo}>{promocao.titulo}</Text>
      <Text style={styles.detalhe}>{validade}</Text>
      <Text style={styles.detalhe}>Desconto direto na loja, sem gastar pontos.</Text>
    </View>
  );
}

// O que o produto não tem aparece apagado, para a gestante saber que não deixou de ver nada
export function OfertaAusente({ texto }: { texto: string }) {
  return (
    <View
      style={[styles.cartao, styles.ausente]}
      accessible
      accessibilityState={{ disabled: true }}
      accessibilityLabel={texto}>
      <Text style={styles.ausenteTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  secao: {
    gap: Espaco.tres,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.tres,
  },
  empresa: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.tres,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Cores.borda,
    backgroundColor: Cores.fundo,
  },
  semLogo: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Cores.previna50,
    backgroundColor: Cores.previna50,
  },
  inicial: {
    fontFamily: Fontes.seminegrito,
    fontSize: 18,
    color: Cores.previna700,
  },
  empresaNome: {
    fontFamily: Fontes.seminegrito,
    fontSize: 17,
    color: Cores.texto,
  },
  verTodos: {
    fontFamily: Fontes.media,
    fontSize: 14,
    color: Cores.previna700,
  },
  carrossel: {
    gap: Espaco.tres,
  },
  produto: {
    gap: Espaco.dois,
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    padding: Espaco.dois,
  },
  produtoFixo: {
    width: 156,
  },
  produtoColuna: {
    flex: 1,
  },
  pressionado: {
    backgroundColor: Cores.fundoSutil,
  },
  foto: {
    width: '100%',
    height: 104,
    borderRadius: Raio,
    backgroundColor: Cores.fundoSutil,
  },
  fotoGrande: {
    width: '100%',
    height: 220,
    borderRadius: Raio,
    backgroundColor: Cores.fundoSutil,
  },
  semFoto: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cores.previna50,
  },
  produtoNome: {
    fontFamily: Fontes.seminegrito,
    fontSize: 15,
    lineHeight: 20,
    color: Cores.texto,
  },
  selos: {
    gap: Espaco.um,
  },
  selo: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: Cores.previna50,
    paddingHorizontal: Espaco.dois,
    paddingVertical: 2,
  },
  seloTexto: {
    fontFamily: Fontes.media,
    fontSize: 12,
    color: Cores.previna700,
  },
  textos: {
    flex: 1,
    gap: Espaco.um,
  },
  detalhe: {
    fontFamily: Fontes.regular,
    fontSize: 13,
    color: Cores.textoSecundario,
  },
  cartao: {
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    padding: Espaco.quatro,
    gap: Espaco.tres,
  },
  cartaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espaco.tres,
  },
  cartaoTitulo: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
  },
  custo: {
    alignItems: 'flex-end',
  },
  pontos: {
    fontFamily: Fontes.seminegrito,
    fontSize: 20,
    lineHeight: 24,
    color: Cores.texto,
  },
  faltam: {
    fontFamily: Fontes.media,
    fontSize: 14,
    color: Cores.textoSecundario,
  },
  ausente: {
    borderStyle: 'dashed',
    backgroundColor: Cores.fundoSutil,
    opacity: 0.7,
  },
  ausenteTexto: {
    fontFamily: Fontes.media,
    fontSize: 15,
    color: Cores.textoSecundario,
  },
});
