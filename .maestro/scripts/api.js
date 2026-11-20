// Chamadas à API feitas pelos fluxos (runScript do Maestro, que roda no computador, não no celular). Um arquivo só,
// com a ação escolhida pela variável ACAO, para o login e o tratamento de erro ficarem num lugar.
//
// Variáveis (as do e2e:preparar, no Env do Studio ou com -e no CLI): API_URL, GESTANTE_LOGIN, GESTANTE_SENHA,
// EMPRESA_LOGIN, EMPRESA_SENHA, EMPRESA_NOME, PRODUTO_NOME, CUPOM_PONTOS. Resultado em output.*:
//   saldo                 output.saldo, output.saldoTexto ("25 pontos") e output.saldoDepoisTexto (depois de um cupom)
//   resgates              output.temCupom, output.temPromocao, output.temCupomAtivo, output.codigoCupom e
//                         output.codigoPromocao (os mais recentes), e os mesmos códigos soletrados
//                         (output.codigoCupomSoletrado, output.codigoPromocaoSoletrado), como no rótulo acessível
//   exigirPromocaoLivre   falha se a promoção já foi resgatada (ela só pode ser resgatada uma vez)
//   resgatarCupom         resgata o cupom do produto pela API, como a gestante; output.saldo* com o novo saldo
//   validarCupons         valida, como a empresa, todos os cupons ATIVOS da gestante; output.validados

/* global http, output, ACAO, API_URL, GESTANTE_LOGIN, GESTANTE_SENHA, EMPRESA_LOGIN, EMPRESA_SENHA, EMPRESA_NOME,
   PRODUTO_NOME, CUPOM_PONTOS */

function chamar(metodo, caminho, token, corpo) {
  const opcoes = { headers: { 'Content-Type': 'application/json' } };
  if (token) {
    opcoes.headers.Authorization = 'Bearer ' + token;
  }
  if (corpo !== undefined) {
    opcoes.body = JSON.stringify(corpo);
  }
  const url = API_URL + caminho;
  const resposta = metodo === 'GET' ? http.get(url, opcoes) : http.post(url, opcoes);
  if (resposta.status < 200 || resposta.status >= 300) {
    throw new Error(metodo + ' ' + caminho + ' respondeu ' + resposta.status + ': ' + resposta.body);
  }
  return resposta.body ? JSON.parse(resposta.body) : undefined;
}

function entrar(login, senha) {
  return chamar('POST', '/auth/login', undefined, { login: login, senha: senha }).token;
}

const formatarPontos = (pontos) => pontos + (pontos === 1 ? ' ponto' : ' pontos');

function guardarSaldo(saldo) {
  output.saldo = saldo;
  output.saldoTexto = formatarPontos(saldo);
  output.saldoDepoisTexto = formatarPontos(saldo - Number(CUPOM_PONTOS));
}

// Todos os resgates da gestante nesta empresa (a gestante é nova, então são só os dos fluxos)
function resgates(token) {
  const busca = encodeURIComponent(EMPRESA_NOME);
  return chamar('GET', '/gestantes/cupons?tamanho=100&busca=' + busca, token).itens;
}

const soletrar = (codigo) => codigo.split('').join(' ');

const gestante = () => entrar(GESTANTE_LOGIN, GESTANTE_SENHA);

const acoes = {
  saldo() {
    guardarSaldo(chamar('GET', '/gestantes/pontuacao', gestante()).saldo);
  },

  resgates() {
    // A lista vem com os ativos primeiro e, dentro de cada status, do resgate mais recente para o mais antigo
    const lista = resgates(gestante());
    const cupom = lista.find((r) => r.tipo === 'CUPOM');
    const promocao = lista.find((r) => r.tipo === 'PROMOCAO');
    output.temCupom = !!cupom;
    output.temPromocao = !!promocao;
    output.temCupomAtivo = lista.some((r) => r.tipo === 'CUPOM' && r.status === 'ATIVO');
    output.codigoCupom = cupom ? cupom.codigo : '';
    output.codigoPromocao = promocao ? promocao.codigo : '';
    // Como o leitor de tela lê o código no detalhe (o rótulo acessível que o Maestro enxerga): letra por letra
    output.codigoCupomSoletrado = soletrar(output.codigoCupom);
    output.codigoPromocaoSoletrado = soletrar(output.codigoPromocao);
  },

  exigirPromocaoLivre() {
    if (resgates(gestante()).some((r) => r.tipo === 'PROMOCAO')) {
      throw new Error(
        'A promoção desta preparação já foi resgatada (cada promoção vale uma vez por gestante). ' +
          'Rode npm run e2e:preparar de novo e atualize as variáveis.',
      );
    }
  },

  resgatarCupom() {
    const token = gestante();
    const busca = encodeURIComponent(PRODUTO_NOME);
    const empresa = chamar('GET', '/ofertas?busca=' + busca, token).itens.find((e) => e.nome === EMPRESA_NOME);
    const produto = empresa && empresa.produtos.find((p) => p.nome === PRODUTO_NOME);
    if (!produto) {
      throw new Error('O produto ' + PRODUTO_NOME + ' não está na Loja. Rode npm run e2e:preparar.');
    }
    const cupom = chamar('GET', '/ofertas/produtos/' + produto.id, token).cupons[0];
    if (!cupom) {
      throw new Error('O produto ' + PRODUTO_NOME + ' está sem cupom.');
    }
    guardarSaldo(chamar('POST', '/cupons/' + cupom.id + '/resgatar', token, {}).saldo);
  },

  validarCupons() {
    // O código vem da API, não da tela
    const ativos = resgates(gestante()).filter((r) => r.tipo === 'CUPOM' && r.status === 'ATIVO');
    if (ativos.length === 0) {
      throw new Error('A gestante não tem cupom ativo para validar.');
    }
    const empresa = entrar(EMPRESA_LOGIN, EMPRESA_SENHA);
    ativos.forEach((r) => {
      const validado = chamar('POST', '/empresas/cupons/validar', empresa, { codigo: r.codigo });
      if (validado.codigo !== r.codigo) {
        throw new Error('A validação devolveu o código ' + validado.codigo + ' em vez de ' + r.codigo);
      }
    });
    output.validados = ativos.length;
    output.codigoCupom = ativos[0].codigo;
  },
};

if (!acoes[ACAO]) {
  throw new Error('Ação desconhecida: ' + ACAO);
}
acoes[ACAO]();
