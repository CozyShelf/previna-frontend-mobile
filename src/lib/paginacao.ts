import { useCallback, useRef, useState } from 'react';

import { ApiError, get, type Pagina } from '@/lib/api';

export const TAMANHO_PAGINA = 10;
// Limite de itens por página no backend: a atualização ao voltar para a tela não passa disso
const TAMANHO_MAXIMO = 100;

export interface Paginacao<T> {
  // Indefinido até a primeira página chegar (ou depois de trocar os filtros)
  itens?: T[];
  // Erro da primeira página: a lista inteira fica no lugar dele
  erro?: string;
  // Erro ao buscar mais itens: a lista continua, com a opção de tentar de novo no rodapé
  erroMais?: string;
  carregandoMais: boolean;
  recarregando: boolean;
  // Ao ganhar foco: busca a primeira página se o caminho mudou; senão atualiza o que já está na tela
  atualizar: () => void;
  // Puxar para recarregar: volta para a primeira página
  recarregar: () => void;
  // Fim da lista: busca a próxima página, se houver e se nada estiver em andamento
  carregarMais: () => void;
  // Depois de um erro ao buscar mais: o carregarMais fica parado (o onEndReached tentaria sem parar)
  tentarMaisDeNovo: () => void;
}

type Modo = 'inicio' | 'atualizacao' | 'recarga' | 'mais';

// Rolagem infinita sobre um endpoint paginado (PaginaResponse). O caminho já leva os filtros na query
// string; a página e o tamanho são acrescentados aqui. Trocar o caminho descarta a lista e as respostas
// que ainda estiverem a caminho. As mensagens precisam ser estáveis (texto), não montadas a cada render.
export function usePaginacao<T>(
  caminho: string,
  mensagemErro: string,
  // Para o 404 (ex.: a empresa saiu do catálogo); sem ela, vale a mensagem genérica
  mensagemNaoEncontrado?: string,
): Paginacao<T> {
  const [itens, setItens] = useState<T[]>();
  const [erro, setErro] = useState<string>();
  const [erroMais, setErroMais] = useState<string>();
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  // O estado só muda no próximo render: o onEndReached dispara várias vezes seguidas e pediria a mesma
  // página de novo. Estas refs barram isso na hora.
  const controle = useRef({
    // Muda a cada busca que recomeça a lista; resposta de uma geração antiga é descartada
    geracao: 0,
    caminho: undefined as string | undefined,
    ocupado: false,
    carregados: 0,
    fim: false,
    falhouMais: false,
  });

  const buscar = useCallback(
    (modo: Modo) => {
      const c = controle.current;
      if (modo === 'mais' && (c.ocupado || c.fim || c.falhouMais || c.carregados === 0)) {
        return;
      }
      // Ao voltar para a tela, busca de uma vez tudo o que já estava carregado (mesmos itens, páginas
      // maiores), para a lista não encolher e a rolagem não pular
      const tamanho =
        modo === 'atualizacao'
          ? Math.min(Math.max(Math.ceil(c.carregados / TAMANHO_PAGINA), 1) * TAMANHO_PAGINA, TAMANHO_MAXIMO)
          : TAMANHO_PAGINA;
      const pagina = modo === 'mais' ? c.carregados / TAMANHO_PAGINA : 0;
      if (modo !== 'mais') {
        c.geracao += 1;
      }
      const geracao = c.geracao;
      c.ocupado = true;
      c.caminho = caminho;
      if (modo === 'inicio') {
        c.carregados = 0;
        setItens(undefined);
        setErro(undefined);
      }
      setErroMais(undefined);
      c.falhouMais = false;
      setCarregandoMais(modo === 'mais');
      setRecarregando(modo === 'recarga');

      const separador = caminho.includes('?') ? '&' : '?';
      get<Pagina<T>>(`${caminho}${separador}pagina=${pagina}&tamanho=${tamanho}`)
        .then((resposta) => {
          if (geracao !== c.geracao) {
            return;
          }
          c.carregados = (modo === 'mais' ? c.carregados : 0) + resposta.itens.length;
          // Página incompleta também encerra: a lista pode ter mudado entre uma página e outra. Fora do fim,
          // carregados é sempre múltiplo de 10 e aponta a próxima página.
          c.fim = c.carregados >= resposta.total || resposta.itens.length < tamanho;
          setItens((anteriores) => (modo === 'mais' ? [...(anteriores ?? []), ...resposta.itens] : resposta.itens));
          setErro(undefined);
        })
        .catch((e) => {
          if (geracao !== c.geracao) {
            return;
          }
          const mensagem =
            mensagemNaoEncontrado && e instanceof ApiError && e.status === 404 ? mensagemNaoEncontrado : mensagemErro;
          if (modo === 'mais') {
            c.falhouMais = true;
            setErroMais(mensagem);
          } else {
            setErro(mensagem);
          }
        })
        .finally(() => {
          if (geracao === c.geracao) {
            c.ocupado = false;
            setCarregandoMais(false);
            setRecarregando(false);
          }
        });
    },
    [caminho, mensagemErro, mensagemNaoEncontrado],
  );

  const atualizar = useCallback(() => {
    buscar(controle.current.caminho === caminho ? 'atualizacao' : 'inicio');
  }, [buscar, caminho]);
  const recarregar = useCallback(() => buscar('recarga'), [buscar]);
  const carregarMais = useCallback(() => buscar('mais'), [buscar]);
  const tentarMaisDeNovo = useCallback(() => {
    controle.current.falhouMais = false;
    buscar('mais');
  }, [buscar]);

  return { itens, erro, erroMais, carregandoMais, recarregando, atualizar, recarregar, carregarMais, tentarMaisDeNovo };
}
