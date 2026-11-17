import { comFiltros, temFiltro, type Categoria, type TipoOferta } from '@/lib/ofertas';

// Cupons e promoções que a gestante resgatou (/gestantes/cupons no backend). O backend marca como EXPIRADO o que
// venceu antes de responder e devolve os ativos primeiro, depois do resgate mais recente para o mais antigo.

export type StatusResgate = 'ATIVO' | 'UTILIZADO' | 'EXPIRADO';

export const ROTULO_STATUS_RESGATE: Record<StatusResgate, string> = {
  ATIVO: 'Ativo',
  UTILIZADO: 'Utilizado',
  EXPIRADO: 'Expirado',
};

export const ROTULO_TIPO: Record<TipoOferta, string> = {
  CUPOM: 'Cupom',
  PROMOCAO: 'Promoção',
};

// Mesmo formato do ResgateResponse: um item da lista e o detalhe (/gestantes/cupons/{id}). O id é o mesmo que o
// resgate devolve, então o diálogo de sucesso leva direto ao detalhe.
export interface Resgate {
  id: number;
  tipo: TipoOferta;
  codigo: string;
  titulo: string;
  empresa: { id: number; nome: string };
  // Nulo na promoção, que vale para o produto mas é identificada pelo título
  produto: string | null;
  categoria: Categoria | null;
  desconto: number;
  // aaaa-mm-dd
  dataValidade: string;
  status: StatusResgate;
  // Instantes (ISO com Z), mostrados no fuso do celular
  dataResgate: string;
  dataUso: string | null;
  // Zero na promoção, que não gasta pontos
  pontosGastos: number;
}

// Mesmos filtros da Loja, menos o "cabe no meu saldo" (já foi resgatado), mais o status
export interface FiltrosResgates {
  busca?: string;
  categoria?: Categoria;
  tipo?: TipoOferta;
  status?: StatusResgate;
}

export const temFiltroResgates = (filtros: FiltrosResgates) => temFiltro(filtros) || !!filtros.status;

// Caminho da lista com os filtros na query string; a paginação é acrescentada por usePaginacao
export function caminhoResgates({ status, ...comuns }: FiltrosResgates) {
  const caminho = comFiltros('/gestantes/cupons', comuns);
  if (!status) {
    return caminho;
  }
  return `${caminho}${caminho.includes('?') ? '&' : '?'}status=${status}`;
}

// Instante da API -> dd/mm/aaaa no fuso do celular
export const formatarDia = (instante: string) => new Date(instante).toLocaleDateString('pt-BR');
