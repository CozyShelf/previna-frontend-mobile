import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/components/botao';
import { Cores, Espaco, Fontes, Raio } from '@/constants/theme';
import { imagemDaApi } from '@/lib/api';

// Mesmo formato do CupomDisponivelResponse no backend. imagemProduto e logo são caminhos da API, nulos sem imagem.
export interface CupomDisponivel {
  id: number;
  descricao: string;
  produto: string;
  categoria?: 'FRALDAS' | 'ROUPAS' | 'REMEDIOS';
  imagemProduto?: string;
  desconto: number;
  dataValidade: string;
  pontosNecessarios: number;
  empresa: Empresa;
}

export interface Empresa {
  id: number;
  nome: string;
  segmento?: string;
  logo?: string;
}

export interface Loja {
  empresa: Empresa;
  cupons: CupomDisponivel[];
}

// A API já manda os mais baratos primeiro; as lojas ficam em ordem alfabética e os cupons mantêm essa ordem
export function agruparPorLoja(cupons: CupomDisponivel[]): Loja[] {
  const lojas = new Map<number, Loja>();
  for (const cupom of cupons) {
    const loja = lojas.get(cupom.empresa.id) ?? { empresa: cupom.empresa, cupons: [] };
    loja.cupons.push(cupom);
    lojas.set(cupom.empresa.id, loja);
  }
  return [...lojas.values()].sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome, 'pt-BR'));
}

// aaaa-mm-dd -> dd/mm/aaaa
export const formatarData = (data: string) => data.split('-').reverse().join('/');

// 12.5 -> "12,5%"
export const formatarDesconto = (desconto: number) => `${String(desconto).replace('.', ',')}%`;

export const formatarPontos = (pontos: number) => `${pontos} ${pontos === 1 ? 'ponto' : 'pontos'}`;

const ROTULO_CATEGORIA = { FRALDAS: 'Fraldas', ROUPAS: 'Roupas', REMEDIOS: 'Remédios' } as const;

interface CartaoCupomProps {
  cupom: CupomDisponivel;
  saldo: number;
  onResgatar: (cupom: CupomDisponivel) => void;
}

function CartaoCupom({ cupom, saldo, onResgatar }: CartaoCupomProps) {
  const faltam = cupom.pontosNecessarios - saldo;
  const detalhe = [cupom.categoria && ROTULO_CATEGORIA[cupom.categoria], `Válido até ${formatarData(cupom.dataValidade)}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.cartao}>
      <View
        style={styles.linha}
        accessible
        accessibilityLabel={`${cupom.produto}, ${formatarDesconto(cupom.desconto)} de desconto, ${detalhe}, custa ${formatarPontos(cupom.pontosNecessarios)}`}>
        {cupom.imagemProduto ? (
          <Image source={imagemDaApi(cupom.imagemProduto)} style={styles.imagem} contentFit="cover" />
        ) : (
          <View style={[styles.imagem, styles.semImagem]}>
            <SymbolView
              name={{ ios: 'tag.fill', android: 'sell', web: 'sell' }}
              tintColor={Cores.previna600}
              size={24}
            />
          </View>
        )}
        <View style={styles.textos}>
          <Text style={styles.produto}>{cupom.produto}</Text>
          <View style={styles.selo}>
            <Text style={styles.seloTexto}>{formatarDesconto(cupom.desconto)} de desconto</Text>
          </View>
          <Text style={styles.detalhe}>{detalhe}</Text>
        </View>
      </View>

      <View style={styles.rodape}>
        <View>
          <Text style={styles.pontos}>{cupom.pontosNecessarios}</Text>
          <Text style={styles.pontosRotulo}>{cupom.pontosNecessarios === 1 ? 'ponto' : 'pontos'}</Text>
        </View>
        {faltam > 0 ? (
          <Text style={styles.faltam}>Faltam {formatarPontos(faltam)}</Text>
        ) : (
          <View style={styles.acao}>
            <Botao rotulo="Resgatar" estilo="primario" onPress={() => onResgatar(cupom)} />
          </View>
        )}
      </View>
    </View>
  );
}

interface SecaoLojaProps {
  loja: Loja;
  saldo: number;
  onResgatar: (cupom: CupomDisponivel) => void;
}

export function SecaoLoja({ loja, saldo, onResgatar }: SecaoLojaProps) {
  const { empresa, cupons } = loja;
  const quantidade = `${cupons.length} ${cupons.length === 1 ? 'cupom' : 'cupons'}`;

  return (
    <View style={styles.secao}>
      <View style={styles.loja} accessible accessibilityRole="header" accessibilityLabel={`${empresa.nome}, ${quantidade}`}>
        {empresa.logo ? (
          <Image source={imagemDaApi(empresa.logo)} style={styles.logo} contentFit="contain" />
        ) : (
          <View style={[styles.logo, styles.semLogo]}>
            <Text style={styles.inicial}>{empresa.nome.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.textos}>
          <Text style={styles.lojaNome}>{empresa.nome}</Text>
          <Text style={styles.detalhe}>{[empresa.segmento, quantidade].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      {cupons.map((cupom) => (
        <CartaoCupom key={cupom.id} cupom={cupom} saldo={saldo} onResgatar={onResgatar} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  secao: {
    gap: Espaco.tres,
  },
  loja: {
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
  lojaNome: {
    fontFamily: Fontes.seminegrito,
    fontSize: 17,
    color: Cores.texto,
  },
  cartao: {
    borderWidth: 1,
    borderColor: Cores.borda,
    borderRadius: Raio,
    padding: Espaco.quatro,
    gap: Espaco.tres,
  },
  linha: {
    flexDirection: 'row',
    gap: Espaco.tres,
  },
  imagem: {
    width: 64,
    height: 64,
    borderRadius: Raio,
    backgroundColor: Cores.fundoSutil,
  },
  semImagem: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cores.previna50,
  },
  textos: {
    flex: 1,
    gap: Espaco.um,
  },
  produto: {
    fontFamily: Fontes.seminegrito,
    fontSize: 16,
    color: Cores.texto,
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
    fontSize: 13,
    color: Cores.previna700,
  },
  detalhe: {
    fontFamily: Fontes.regular,
    fontSize: 13,
    color: Cores.textoSecundario,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espaco.tres,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Cores.borda,
    paddingTop: Espaco.tres,
  },
  pontos: {
    fontFamily: Fontes.seminegrito,
    fontSize: 20,
    lineHeight: 24,
    color: Cores.texto,
  },
  pontosRotulo: {
    fontFamily: Fontes.regular,
    fontSize: 12,
    color: Cores.textoSecundario,
  },
  acao: {
    minWidth: 128,
  },
  faltam: {
    fontFamily: Fontes.media,
    fontSize: 14,
    color: Cores.textoSecundario,
  },
});
