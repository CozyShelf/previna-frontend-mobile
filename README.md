# previna-frontend-mobile

App da gestante no **Previna**, sistema que incentiva gestantes de primeira viagem a irem às consultas e aos exames
do pré-natal. A gestante acompanha os exames e consultas marcados pelo médico, ganha pontos a cada um realizado e troca
os pontos por cupons de desconto das empresas parceiras.

## Stack

- [Expo SDK 58](https://docs.expo.dev) + React Native 0.88 + TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction) (rotas por arquivo em `src/app/`)
- `expo-secure-store` para guardar a sessão; `expo-image-picker` para a foto do perfil
- `expo-clipboard` para copiar o código do cupom; `react-native-qrcode-svg` (com `react-native-svg`) para o QR Code
- Jest ([`jest-expo`](https://docs.expo.dev/develop/unit-testing/)) + Testing Library para testes
- ESLint (`eslint-config-expo`)

## Telas

| Rota                   | Tela                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `/`                    | Login (só contas de gestante)                                          |
| `/primeiro-acesso`     | Troca da senha temporária, consentimento LGPD e dados socioeconômicos  |
| `/tutorial`            | Apresentação do app no primeiro uso                                    |
| `/inicio`              | Próximos exames e consultas e os já realizados; puxar para recarregar  |
| `/pontos`              | Saldo e atividades que geraram pontos, com puxar para recarregar; `/pontos/extrato` com filtros |
| `/cupons`              | Aba "Loja Cupons": ofertas das empresas parceiras, com filtros; abre `empresa/[id]` ("Ver todos") e `produto/[id]` (resgate de cupom com pontos e de promoção grátis, uma vez só; o diálogo de sucesso tem "Ver código") |
| `/cupons/resgatados`   | Aba "Cupons resgatados": cupons e promoções resgatados, com filtros de busca, categoria, tipo e status (ativo, utilizado, expirado); "Ver código" abre `resgatado/[id]` |
| `/cupons/resgatado/[id]` | Código do resgate com Copiar e QR Code (só enquanto ativo), status, empresa, desconto, datas e pontos gastos |
| `/perfil`              | Contato, foto e saída da conta                                         |

`/inicio`, `/pontos`, `/cupons` e `/perfil` são as abas (`src/app/(abas)/`) e exigem sessão; sem token, o app volta para o login.

## Como rodar

O jeito recomendado é pelo repositório [`previna-development`](../previna-development), que sobe o Metro junto com a
API e mostra o QR Code para abrir no Expo Go:

```bash
cd ../previna-development
docker compose up
```

Para rodar só o app (Node ≥ 22.13), apontando para uma API já no ar:

```bash
npm install
EXPO_PUBLIC_API_URL=http://<ip-da-maquina>/backend npx expo start
```

`EXPO_PUBLIC_API_URL` é a URL base da API; sem ela, o app usa `http://localhost/backend`. No celular, use o IP da
máquina na rede, e não `localhost`.

## Scripts

| Script                  | Descrição                               |
| ----------------------- | --------------------------------------- |
| `npm start`             | Servidor do Metro (`npx expo start`)    |
| `npm run lint`          | ESLint                                  |
| `npx tsc --noEmit`      | Checagem de tipos                       |
| `npm test`              | Testes                                  |
| `npm run test:coverage` | Testes com relatório de cobertura       |
| `npm run e2e:preparar`  | Dados dos testes de ponta a ponta (Maestro) |

Instale dependências com `npx expo install <pacote>`, que escolhe a versão compatível com o SDK.

## Estrutura

```
src/
  app/          telas (Expo Router); (abas)/ são as abas da gestante logada
  components/   componentes de tela (cartões, formulários, diálogo de resgate)
  lib/          cliente da API, sessão, máscaras, catálogo de ofertas e paginação
  constants/    tema (cores, fontes, espaços) e URL da API
__tests__/      testes (fora de src/app, senão o Expo Router os trataria como telas)
.maestro/       testes de ponta a ponta (fluxos do Maestro, subfluxos e scripts)
e2e/            preparação dos dados dos testes de ponta a ponta (npm run e2e:preparar)
```

O alias `@/` aponta para `src/`.

## Testes

```bash
npm test
```

Jest com o preset `jest-expo` e a Testing Library. Os testes ficam em `__tests__/`, e cada arquivo começa com
`/// <reference types="jest" />` (o TypeScript 6 não inclui os tipos globais sozinho). Na Testing Library v14,
`render` e `fireEvent` são assíncronos: use sempre `await`.

## Testes de ponta a ponta (Maestro)

Os fluxos ficam em `.maestro/` (YAML do [Maestro](https://maestro.dev)) e rodam o app de verdade no Expo Go de um
emulador Android, contra o backend do ambiente de dev:

| Fluxo                       | O que confere                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `01-login`                  | Login da gestante, Início, e a sessão lembrada ao reabrir o app                                 |
| `02-pontos`                 | Saldo na aba Pontos; o saldo muda pela API e puxar para baixo mostra o novo                     |
| `03-resgate-cupom`          | Loja → busca → produto → resgate do cupom → código (conferido com a API) e Copiar → saldo caiu   |
| `04-promocao`               | Resgate da promoção do mesmo produto, grátis, e "Já resgatada" ao voltar                        |
| `05-cupons-resgatados`      | A aba "Cupons resgatados" lista os dois, o filtro por tipo funciona e o detalhe mostra o código  |
| `06-historico`              | Início → Ver histórico → o exame confirmado em "Concluídos"                                     |
| `07-validacao`              | A empresa valida o código pela API e puxar para baixo nos resgatados mostra "Utilizado"         |

`subfluxos/` tem as peças comuns (abrir o app, login, logout, abrir o produto, resgatar) e `scripts/api.js` as chamadas
à API feitas pelos fluxos (`runScript`, que roda no computador). Os caminhos são relativos ao arquivo, então a pasta
funciona igual pelo CLI e pelo Maestro Studio. Cada fluxo começa abrindo o app e fazendo login (saindo antes, se o
aparelho lembrava outra sessão) e pode rodar sozinho depois da preparação; o 5 e o 7 resgatam antes o que faltar. O 3
pode ser repetido enquanto o saldo pagar o cupom; o 4 não, porque cada promoção vale uma vez por gestante: para
repeti-lo, prepare os dados de novo.

### Pré-requisitos (Windows)

- Android Studio com um emulador (testado com Pixel 7, API 35) e o `adb` no `PATH` (`platform-tools`);
- Java 21 e o [Maestro CLI](https://docs.maestro.dev/getting-started/installing-maestro/windows) e/ou o Maestro
  Studio;
- o Expo Go instalado no emulador;
- o ambiente de dev no ar (`previna-development`, `docker compose up`), com `MOBILE_HOST` apontando para o IP do
  computador na rede: o emulador abre `exp://<MOBILE_HOST>:8081` e fala com a API em `MOBILE_API_URL`.

Só um dos dois usa o emulador por vez: com o Maestro Studio aberto, o `maestro test` do CLI falha com
`DeviceServerDiedException`. Feche o Studio antes de rodar pelo CLI, e vice-versa.

### 1. Preparar os dados

No WSL/Linux, na pasta deste repositório (Node 22, sem dependências):

```bash
npm run e2e:preparar
```

O script cria pela API, com a marca `E2E <carimbo>` nos nomes, uma empresa parceira (pré-cadastro como `admin`, senha
temporária lida no MailHog, primeiro acesso), um produto de Fraldas com um cupom barato e uma promoção de Fraldas
vigente hoje, e uma gestante (pré-cadastro como `medico`, exame agendado para hoje e confirmado, primeiro acesso e
tutorial concluídos). No fim imprime as variáveis, uma por linha (`CHAVE=valor`), grava as mesmas em
`.maestro/.env.local` (ignorado pelo git) e imprime o comando do CLI já com os `-e`. Rode de novo para ter dados novos.

Por padrão ele usa `../previna-development/.env` (`MOBILE_HOST`, `MOBILE_API_URL`, `NGINX_PORT`); as variáveis
`E2E_API_URL`, `E2E_MAILHOG_URL`, `E2E_HOST`, `E2E_APP_URL`, `E2E_APP_API_URL`, `E2E_DEV_ENV`, `E2E_ADMIN` e
`E2E_MEDICO` mudam isso (ver o começo de `e2e/preparar.mjs`).

### 2a. Rodar pelo Maestro Studio

1. Abra a pasta `.maestro` do repositório, por exemplo
   `\\wsl.localhost\Ubuntu\home\<usuario>\Previna\previna-frontend-mobile\.maestro`.
2. Em **Env**, cole as linhas `CHAVE=valor` que o `e2e:preparar` imprimiu (ou o conteúdo de `.maestro/.env.local`).
3. Use **Run Test** num fluxo ou **Run All Tests**. Os arquivos de `subfluxos/` não são testes: não os rode sozinhos.

### 2b. Rodar pelo CLI

No PowerShell, na pasta do repositório (ou numa cópia da pasta `.maestro`, se o Maestro não aceitar o caminho
`\\wsl.localhost\...`), cole o comando que o `e2e:preparar` imprimiu. Ele tem esta forma:

```powershell
maestro --device emulator-5554 test -e "APP_URL=exp://192.168.0.10:8081" -e "API_URL=http://192.168.0.10/backend" -e "GESTANTE_LOGIN=..." ... .maestro/
```

O `.maestro/config.yaml` faz o CLI rodar só os fluxos da raiz, em ordem, sem parar no primeiro que falhar.

### O que os fluxos já contornam no emulador

- **Tutorial de caneta do Gboard** ("Try out your stylus"): o toque do Maestro às vezes o abre por cima do app ao
  focar um campo. `subfluxos/digitar.yaml` fecha e toca de novo.
- **Oferta de salvar a senha** do Google Password Manager depois do login ("Not now" ou "Never"): é de outro app, não
  fecha com o Expo Go e cobre o Previna. `subfluxos/recusar-salvar-senha.yaml` a recusa no login e ao abrir o app.
- **Link aberto cedo demais:** um `openLink` logo depois de fechar o Expo Go caía na tela inicial do Android.
  `subfluxos/abrir-app.yaml` abre o Expo Go, espera a tela dele e só então abre o projeto.

## CI

`.github/workflows/ci.yml` roda em todo PR e em todo push na `master`: `npm ci`, `expo lint`, `tsc --noEmit` e
`npm run test:coverage`. A cobertura abaixo dos pisos de `jest.coverageThreshold` (`package.json`) reprova o PR;
suba os pisos quando a cobertura subir.
