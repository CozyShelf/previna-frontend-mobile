import { get } from '@/lib/api';

// Catálogo de ofertas (/ofertas no backend): empresas com produtos que têm cupom válido ou promoção vigente.
// Mesmos formatos das respostas da API, que mandam os campos nulos explícitos no JSON; imagem e logo são
// caminhos da API, nulos sem imagem.

export type Categoria = 'FRALDAS' | 'ROUPAS' | 'REMEDIOS';
export type TipoOferta = 'CUPOM' | 'PROMOCAO';

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  FRALDAS: 'Fraldas',
  ROUPAS: 'Roupas',
  REMEDIOS: 'Remédios',
};

export interface EmpresaOferta {
  id: number;
  nome: string;
  segmento: string | null;
  logo: string | null;
}

// Um produto na lista: os números resumem todas as ofertas dele (mesmo com o filtro de tipo), para os selos
export interface ProdutoOfertaResumo {
  id: number;
  nome: string;
  categoria: Categoria | null;
  imagem: string | null;
  // Menor custo entre os cupons válidos; nulo sem cupom
  menorPontos: number | null;
  maiorDescontoCupom: number | null;
  // Maior desconto entre as promoções vigentes; nulo sem promoção
  descontoPromocao: number | null;
}

// Uma empresa na lista, com até 10 produtos; totalProdutos conta todos os que passam nos filtros
export interface OfertaEmpresa extends EmpresaOferta {
  totalProdutos: number;
  produtos: ProdutoOfertaResumo[];
}

export interface CupomOferta {
  id: number;
  desconto: number;
  pontosNecessarios: number;
  dataValidade: string;
}

export interface PromocaoOferta {
  id: number;
  titulo: string;
  desconto: number;
  dataInicio: string;
  dataFim: string;
}

// Detalhe do produto: cupons do mais barato para o mais caro, promoções do maior desconto para o menor
export interface ProdutoOfertaDetalhe {
  id: number;
  nome: string;
  categoria: Categoria | null;
  imagem: string | null;
  empresa: EmpresaOferta;
  cupons: CupomOferta[];
  promocoes: PromocaoOferta[];
}

// Filtros que o backend aplica (a lista é paginada, então filtrar no app só veria a página carregada)
export interface FiltrosOfertas {
  busca?: string;
  categoria?: Categoria;
  tipo?: TipoOferta;
  ateMeusPontos?: boolean;
}

export const temFiltro = (filtros: FiltrosOfertas) =>
  !!(filtros.busca?.trim() || filtros.categoria || filtros.tipo || filtros.ateMeusPontos);

// Caminho da API com os filtros na query string; a paginação é acrescentada por usePaginacao
export function comFiltros(caminho: string, filtros: FiltrosOfertas) {
  const parametros = new URLSearchParams();
  const busca = filtros.busca?.trim();
  if (busca) {
    parametros.set('busca', busca);
  }
  if (filtros.categoria) {
    parametros.set('categoria', filtros.categoria);
  }
  if (filtros.tipo) {
    parametros.set('tipo', filtros.tipo);
  }
  if (filtros.ateMeusPontos) {
    parametros.set('ateMeusPontos', 'true');
  }
  const consulta = parametros.toString();
  return consulta ? `${caminho}?${consulta}` : caminho;
}

// Os filtros também viajam como parâmetros de rota (do "Ver todos" para a tela da empresa), onde tudo é texto
export type ParametrosFiltros = Partial<Record<keyof FiltrosOfertas, string>>;

const CATEGORIAS = Object.keys(ROTULO_CATEGORIA) as Categoria[];
const TIPOS: TipoOferta[] = ['CUPOM', 'PROMOCAO'];

export function filtrosParaParametros(filtros: FiltrosOfertas): ParametrosFiltros {
  const parametros: ParametrosFiltros = {};
  const busca = filtros.busca?.trim();
  if (busca) {
    parametros.busca = busca;
  }
  if (filtros.categoria) {
    parametros.categoria = filtros.categoria;
  }
  if (filtros.tipo) {
    parametros.tipo = filtros.tipo;
  }
  if (filtros.ateMeusPontos) {
    parametros.ateMeusPontos = 'true';
  }
  return parametros;
}

// Valor fora do esperado (link montado à mão) é ignorado em vez de ir para a API
export function parametrosParaFiltros(parametros: ParametrosFiltros): FiltrosOfertas {
  const { busca, categoria, tipo, ateMeusPontos } = parametros;
  return {
    busca: busca?.trim() || undefined,
    categoria: CATEGORIAS.find((c) => c === categoria),
    tipo: TIPOS.find((t) => t === tipo),
    ateMeusPontos: ateMeusPontos === 'true' || undefined,
  };
}

// "Fraldas · Só cupons · Cabe no meu saldo", para lembrar a gestante do que está filtrado
export function descreverFiltros(filtros: FiltrosOfertas) {
  return [
    filtros.busca && `“${filtros.busca}”`,
    filtros.categoria && ROTULO_CATEGORIA[filtros.categoria],
    filtros.tipo && (filtros.tipo === 'CUPOM' ? 'Cupons' : 'Promoções'),
    filtros.ateMeusPontos && 'Cabe no meu saldo',
  ]
    .filter(Boolean)
    .join(' · ');
}

// Saldo de pontos da gestante (a pontuação traz também as atividades, que aqui não interessam)
export const buscarSaldo = () => get<{ saldo: number }>('/gestantes/pontuacao').then((pontuacao) => pontuacao.saldo);
