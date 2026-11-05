# previna-frontend-mobile

App da gestante no **Previna**, sistema que incentiva gestantes de primeira viagem a irem às consultas e aos exames
do pré-natal. A gestante acompanha os exames e consultas marcados pelo médico, ganha pontos a cada um realizado e troca
os pontos por cupons de desconto das empresas parceiras.

## Stack

- [Expo SDK 58](https://docs.expo.dev) + React Native 0.88 + TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction) (rotas por arquivo em `src/app/`)
- `expo-secure-store` para guardar a sessão; `expo-image-picker` para a foto do perfil
- Jest ([`jest-expo`](https://docs.expo.dev/develop/unit-testing/)) + Testing Library para testes
- ESLint (`eslint-config-expo`)

## Telas

| Rota                   | Tela                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `/`                    | Login (só contas de gestante)                                          |
| `/primeiro-acesso`     | Troca da senha temporária, consentimento LGPD e dados socioeconômicos  |
| `/tutorial`            | Apresentação do app no primeiro uso                                    |
| `/inicio`              | Próximos exames e consultas e os já realizados                         |
| `/pontos`              | Saldo e atividades que geraram pontos; `/pontos/extrato` com filtros   |
| `/cupons`              | Cupons ativos das empresas parceiras, agrupados por loja, e o resgate  |
| `/perfil`              | Contato, foto e saída da conta                                         |

As quatro últimas são as abas (`src/app/(abas)/`) e exigem sessão; sem token, o app volta para o login.

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

Instale dependências com `npx expo install <pacote>`, que escolhe a versão compatível com o SDK.

## Estrutura

```
src/
  app/          telas (Expo Router); (abas)/ são as abas da gestante logada
  components/   componentes de tela (cartões, formulários, diálogo de resgate)
  lib/          cliente da API, sessão e máscaras
  constants/    tema (cores, fontes, espaços) e URL da API
__tests__/      testes (fora de src/app, senão o Expo Router os trataria como telas)
```

O alias `@/` aponta para `src/`.

## Testes

```bash
npm test
```

Jest com o preset `jest-expo` e a Testing Library. Os testes ficam em `__tests__/`, e cada arquivo começa com
`/// <reference types="jest" />` (o TypeScript 6 não inclui os tipos globais sozinho). Na Testing Library v14,
`render` e `fireEvent` são assíncronos: use sempre `await`.

## CI

`.github/workflows/ci.yml` roda em todo PR e em todo push na `master`: `npm ci`, `expo lint`, `tsc --noEmit` e
`npm run test:coverage`. A cobertura abaixo dos pisos de `jest.coverageThreshold` (`package.json`) reprova o PR;
suba os pisos quando a cobertura subir.
