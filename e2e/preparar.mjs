#!/usr/bin/env node
// Prepara, pela API, os dados dos testes de ponta a ponta (Maestro, pasta .maestro/). Cria tudo novo, com o sufixo
// E2E e um carimbo de tempo, para os fluxos não dependerem do que já existe no banco de dev:
//   1. empresa parceira (pré-cadastro pelo admin, senha temporária lida no MailHog, primeiro acesso);
//   2. produto FRALDAS, cupom de poucos pontos e promoção de FRALDAS vigente hoje, criados pela empresa;
//   3. gestante (pré-cadastro pelo médico), exame agendado para hoje e confirmado, para ela ter pontos;
//   4. primeiro acesso e tutorial da gestante, para o app entrar direto na Início.
// No fim imprime as variáveis (CHAVE=valor, uma por linha, para o "Env" do Maestro Studio), o comando do CLI e
// grava .maestro/.env.local (ignorado pelo git).
//
// Node 22 puro, sem dependências. Configuração por variáveis de ambiente (todas opcionais):
//   E2E_API_URL      API vista daqui (padrão http://localhost:<NGINX_PORT>/backend)
//   E2E_MAILHOG_URL  MailHog (padrão http://localhost:8025)
//   E2E_HOST         IP do computador na rede, visto pelo emulador (padrão MOBILE_HOST do .env do previna-development)
//   E2E_APP_URL      endereço do app no Expo Go (padrão exp://<E2E_HOST>:8081)
//   E2E_APP_API_URL  API vista pelo Maestro/emulador (padrão MOBILE_API_URL do .env ou http://<E2E_HOST>:<porta>/backend)
//   E2E_DEV_ENV      .env do ambiente de dev (padrão ../previna-development/.env, ao lado deste repositório)
//   E2E_ADMIN / E2E_MEDICO  login:senha dos usuários do seed (padrão admin:admin123 e medico:medico123)

import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Variáveis do ambiente de desenvolvimento (repositório irmão), se existir: MOBILE_HOST, MOBILE_API_URL, NGINX_PORT
function lerEnvDesenvolvimento() {
  const arquivo = process.env.E2E_DEV_ENV ?? join(RAIZ, '..', 'previna-development', '.env');
  if (!existsSync(arquivo)) {
    return {};
  }
  return Object.fromEntries(
    readFileSync(arquivo, 'utf8')
      .split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha && !linha.startsWith('#') && linha.includes('='))
      .map((linha) => {
        const i = linha.indexOf('=');
        return [linha.slice(0, i).trim(), linha.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

const dev = lerEnvDesenvolvimento();
const porta = dev.NGINX_PORT ?? '80';
const sufixoPorta = porta === '80' ? '' : `:${porta}`;
const API = (process.env.E2E_API_URL ?? `http://localhost${sufixoPorta}/backend`).replace(/\/$/, '');
const MAILHOG = (process.env.E2E_MAILHOG_URL ?? 'http://localhost:8025').replace(/\/$/, '');
const HOST = process.env.E2E_HOST ?? dev.MOBILE_HOST;
if (!HOST && !(process.env.E2E_APP_URL && process.env.E2E_APP_API_URL)) {
  falhar(
    'Não sei o IP do computador na rede. Defina E2E_HOST (ou MOBILE_HOST no previna-development/.env), ' +
      'ou então E2E_APP_URL e E2E_APP_API_URL.',
  );
}
const APP_URL = process.env.E2E_APP_URL ?? `exp://${HOST}:8081`;
const APP_API_URL = (
  process.env.E2E_APP_API_URL ??
  (process.env.E2E_HOST ? undefined : dev.MOBILE_API_URL) ??
  `http://${HOST}${sufixoPorta}/backend`
).replace(/\/$/, '');

const [ADMIN_LOGIN, ADMIN_SENHA] = (process.env.E2E_ADMIN ?? 'admin:admin123').split(':');
const [MEDICO_LOGIN, MEDICO_SENHA] = (process.env.E2E_MEDICO ?? 'medico:medico123').split(':');

// Senha definitiva da gestante e da empresa: atende à regra (8+ caracteres, letra e número)
const SENHA = 'E2eSenha123';
// Cupom de poucos pontos: o saldo do exame dá para alguns resgates, e o fluxo 3 pode ser repetido
const DIVISOR_CUSTO = 5;

function falhar(mensagem) {
  console.error(`\n[e2e:preparar] ${mensagem}`);
  process.exit(1);
}

// Data de hoje no fuso do backend (a JVM roda em America/Sao_Paulo): agendamento e promoção usam LocalDate.now()
function hoje(diasDepois = 0) {
  const data = new Date(Date.now() + diasDepois * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data);
}

async function api(metodo, caminho, { token, json, form } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = new FormData();
    for (const [chave, valor] of Object.entries(form)) {
      body.append(chave, String(valor));
    }
  }
  let resposta;
  try {
    resposta = await fetch(`${API}${caminho}`, { method: metodo, headers, body });
  } catch (e) {
    falhar(`Sem resposta de ${API}${caminho} (${e.cause?.code ?? e.message}). O ambiente de dev está no ar?`);
  }
  const texto = await resposta.text();
  if (!resposta.ok) {
    const erro = new Error(`${metodo} ${caminho} → ${resposta.status}: ${texto}`);
    erro.status = resposta.status;
    throw erro;
  }
  return texto ? JSON.parse(texto) : undefined;
}

async function login(usuario, senha) {
  return api('POST', '/auth/login', { json: { login: usuario, senha } });
}

// Dígitos verificadores pelo módulo 11, com os pesos de cada documento
function digito(numeros, pesos) {
  const soma = numeros.reduce((total, n, i) => total + n * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function aleatorios(quantidade) {
  // Primeiro dígito diferente dos outros: nunca sai "todos iguais", que os validadores recusam
  const numeros = Array.from({ length: quantidade }, () => Math.floor(Math.random() * 10));
  numeros[0] = (numeros[1] + 1) % 10;
  return numeros;
}

function gerarCpf() {
  const base = aleatorios(9);
  const d1 = digito(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito([...base, d1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join('');
}

function gerarCnpj() {
  const base = [...aleatorios(8), 0, 0, 0, 1];
  const d1 = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join('');
}

// Tenta de novo com outro documento se o sorteado já existir (409)
async function comDocumentoUnico(tentar) {
  for (let i = 0; i < 5; i++) {
    try {
      return await tentar();
    } catch (e) {
      if (e.status !== 409) {
        throw e;
      }
    }
  }
  falhar('Não consegui um CPF/CNPJ livre em 5 tentativas.');
}

// O MailHog guarda o corpo como chegou: texto puro, normalmente em quoted-printable por causa dos acentos
function decodificarCorpo(mensagem) {
  const corpo = mensagem.Content?.Body ?? '';
  const codificacao = mensagem.Content?.Headers?.['Content-Transfer-Encoding']?.[0]?.toLowerCase();
  if (codificacao === 'base64') {
    return Buffer.from(corpo, 'base64').toString('utf8');
  }
  if (codificacao === 'quoted-printable') {
    const bytes = corpo
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return Buffer.from(bytes, 'latin1').toString('utf8');
  }
  return corpo;
}

async function senhaTemporariaPorEmail(email) {
  const url = `${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`;
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    let dados;
    try {
      dados = await (await fetch(url)).json();
    } catch (e) {
      falhar(`Sem resposta do MailHog em ${MAILHOG} (${e.cause?.code ?? e.message}).`);
    }
    for (const mensagem of dados.items ?? []) {
      const senha = decodificarCorpo(mensagem).match(/Senha tempor[aá]ria:\s*(\S+)/)?.[1];
      if (senha) {
        return senha;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  falhar(`O e-mail com a senha temporária de ${email} não chegou ao MailHog.`);
}

async function main() {
  const carimbo = Date.now().toString(36).toUpperCase();
  const marca = `E2E ${carimbo}`;
  console.log(`[e2e:preparar] API ${API}, dados com a marca "${marca}"`);

  // --- Gestante, exame e pontos (médico) ---------------------------------------------------------------------
  const medico = await login(MEDICO_LOGIN, MEDICO_SENHA);
  const gestanteNome = `Gestante ${marca}`;
  const temporariasGestante = await comDocumentoUnico(() =>
    api('POST', '/gestantes/pre-cadastro', {
      token: medico.token,
      json: {
        nome: gestanteNome,
        cpf: gerarCpf(),
        dataNascimento: '1995-03-10',
        telefone: '11987654321',
        dum: hoje(-84),
      },
    }),
  );

  // O id da gestante não volta no pré-cadastro: procura pelo nome, que é único por causa do carimbo
  const busca = await api('GET', `/gestantes?busca=${encodeURIComponent(gestanteNome)}&somenteMinhas=true`, {
    token: medico.token,
  });
  const gestante = busca.itens.find((g) => g.nome === gestanteNome);
  if (!gestante) {
    falhar(`A gestante "${gestanteNome}" não apareceu na lista do médico.`);
  }

  const tipos = await api('GET', '/tipos-atendimento?categoria=EXAME', { token: medico.token });
  const exame = tipos.find((t) => t.padrao && t.nome === 'Hemograma completo') ?? tipos.find((t) => t.padrao) ?? tipos[0];
  if (!exame) {
    falhar('Nenhum tipo de exame cadastrado para o médico.');
  }
  // Para hoje: o agendamento recusa data passada e a confirmação recusa data futura
  const [agendamento] = await api('POST', '/agendamentos', {
    token: medico.token,
    json: { gestante: gestante.id, itens: [{ tipoAtendimento: exame.id, dataPrevista: hoje(), observacao: marca }] },
  });
  const confirmacao = await api('PUT', `/agendamentos/${agendamento.id}/confirmar`, { token: medico.token });
  const saldo = confirmacao.saldoPontos;

  // --- Primeiro acesso e tutorial da gestante -----------------------------------------------------------------
  const gestanteLogin = `e2e.g.${carimbo.toLowerCase()}`;
  const temporario = await login(temporariasGestante.login, temporariasGestante.senha);
  await api('PUT', '/gestantes/primeiro-acesso', {
    token: temporario.token,
    form: { novoLogin: gestanteLogin, novaSenha: SENHA, consentimentoLgpd: true },
  });
  const sessaoGestante = await login(gestanteLogin, SENHA);
  if (sessaoGestante.tutorialPendente) {
    await api('PUT', '/gestantes/tutorial-concluido', { token: sessaoGestante.token });
  }

  // --- Empresa, produto, cupom e promoção ---------------------------------------------------------------------
  const admin = await login(ADMIN_LOGIN, ADMIN_SENHA);
  const empresaNome = `Empresa ${marca}`;
  const emailEmpresa = `e2e.${carimbo.toLowerCase()}@previna.test`;
  const preCadastro = await comDocumentoUnico(() =>
    api('POST', '/empresas/pre-cadastro', {
      token: admin.token,
      json: {
        razaoSocial: empresaNome,
        cnpj: gerarCnpj(),
        email: emailEmpresa,
        telefone: '1133334444',
        responsavel: `Responsável ${marca}`,
      },
    }),
  );
  // O login temporário da empresa é o CNPJ; a senha só vai por e-mail
  const senhaTemporaria = await senhaTemporariaPorEmail(emailEmpresa);
  const empresaTemporaria = await login(preCadastro.cnpj, senhaTemporaria);
  const empresaLogin = `e2e.e.${carimbo.toLowerCase()}`;
  await api('PUT', '/empresas/primeiro-acesso', {
    token: empresaTemporaria.token,
    form: { novoLogin: empresaLogin, novaSenha: SENHA, endereco: 'Rua dos Testes, 100', segmento: 'Farmácia' },
  });
  const empresa = await login(empresaLogin, SENHA);

  const produtoNome = `Fralda ${marca}`;
  const produto = await api('POST', '/empresas/produtos', {
    token: empresa.token,
    form: { nome: produtoNome, categoria: 'FRALDAS', preco: '59.90', descricao: `Produto de teste ${marca}` },
  });
  const custo = Math.max(1, Math.floor(saldo / DIVISOR_CUSTO));
  await api('POST', '/empresas/cupons', {
    token: empresa.token,
    json: { produto: produto.id, desconto: 10, dataValidade: hoje(30), pontosNecessarios: custo },
  });
  // Empresa nova: não há outra promoção de FRALDAS dela no período
  // Só ASCII nos valores das variáveis: o -e do CLI no Windows pode estragar acentos
  const promocaoTitulo = `Promo ${marca}`;
  await api('POST', '/empresas/promocoes', {
    token: empresa.token,
    json: {
      titulo: promocaoTitulo,
      descricao: `Promoção de teste ${marca}`,
      desconto: 15,
      dataInicio: hoje(),
      dataFim: hoje(30),
      categoria: 'FRALDAS',
    },
  });

  const variaveis = {
    APP_URL,
    API_URL: APP_API_URL,
    GESTANTE_LOGIN: gestanteLogin,
    GESTANTE_SENHA: SENHA,
    GESTANTE_NOME: gestanteNome,
    EMPRESA_NOME: empresaNome,
    EMPRESA_LOGIN: empresaLogin,
    EMPRESA_SENHA: SENHA,
    PRODUTO_NOME: produtoNome,
    PROMOCAO_TITULO: promocaoTitulo,
    EXAME_NOME: exame.nome,
    CUPOM_PONTOS: String(custo),
    SALDO_INICIAL: String(saldo),
  };

  const linhas = Object.entries(variaveis).map(([chave, valor]) => `${chave}=${valor}`);
  const arquivo = join(RAIZ, '.maestro', '.env.local');
  writeFileSync(
    arquivo,
    `# Gerado por npm run e2e:preparar em ${new Date().toISOString()}. Não versionar.\n${linhas.join('\n')}\n`,
  );

  const argumentos = Object.entries(variaveis)
    .map(([chave, valor]) => `-e "${chave}=${valor}"`)
    .join(' ');
  console.log('\n[e2e:preparar] Pronto. Variáveis (cole no "Env" do Maestro Studio):\n');
  console.log(linhas.join('\n'));
  console.log(`\n[e2e:preparar] Gravadas também em ${arquivo}`);
  console.log('\n[e2e:preparar] Comando do CLI (PowerShell, na pasta do projeto):\n');
  console.log(`maestro --device emulator-5554 test ${argumentos} .maestro/`);
}

main().catch((e) => falhar(e.message));
