# AGENTS.md — previna-frontend-mobile

Guia para agentes de IA (Codex, opencode, Cursor, Gemini, Claude Code). Curto de propósito: os detalhes estão no
`README.md` e em `doc/`. A segunda metade deste arquivo é o bloco gerado pelo Expo: mantenha-o intacto.

## O que é

App da gestante no Previna (Expo SDK 58, React Native 0.88, TypeScript, Expo Router): exames e consultas, pontos,
loja de cupons e promoções, cupons resgatados e perfil. A API é o `previna-backend`. Telas: tabela do `README.md`.

## Comandos do projeto

```bash
npm install
EXPO_PUBLIC_API_URL=http://<ip-da-maquina>/backend npx expo start   # ou a pilha completa no previna-development
npm run lint && npx tsc --noEmit
npm test                 # Jest (jest-expo) + Testing Library
npm run test:coverage    # o que a CI roda, com os pisos de cobertura
npm run e2e:preparar     # dados dos E2E do Maestro (exige a pilha de dev no ar)
```

## Regras obrigatórias

- Código, textos e commits em português. Alias `@/` → `src/`.
- Dependência nova só com `npx expo install <pacote>`.
- Rotas só em `src/app/`; abas da gestante logada em `src/app/(abas)/`. Componentes, libs e constantes fora.
- Toda chamada HTTP passa por `src/lib/api.ts`; a sessão (token) só por `src/lib/sessao.ts` (SecureStore).
- Erros da API: decida pelo `codigo`, nunca pelo texto de `message`.
- Resgates mandam `Idempotency-Key` nova a cada confirmação (`src/lib/idempotencia.ts`).
- Testes em `__tests__/` (fora de `src/app`, senão viram telas); cada arquivo começa com
  `/// <reference types="jest" />`. Na Testing Library v14, `render` e `fireEvent` são assíncronos: use `await`.
- E2E do Maestro em `.maestro/`; `subfluxos/` não são testes. Os dados são marcados `E2E <carimbo>` e gravam no
  banco de dev; `.maestro/.env.local` fica fora do git.
- Cobertura subiu: suba os pisos de `jest.coverageThreshold` no `package.json`.
- Branches de trabalho partem da `development` e voltam por PR, no padrão Conventional Commits.

## Definição de pronto

O que `.github/workflows/ci.yml` roda, todos verdes: `npm ci`, `npx expo lint`, `npx tsc --noEmit` e
`npm run test:coverage`. Mudou tela, script ou fluxo: atualize o `README.md` e, se for o caso,
`doc/roteiro-ponta-a-ponta.md`.

## Memória do projeto

- **Decisões** que ainda não viraram código (ou cujo porquê não cabe no código) vão para `doc/decisoes/`, um
  arquivo por decisão, `AAAA-MM-DD-assunto.md`, no modelo de `doc/decisoes/README.md`.
- **Troca de agente:** antes de parar no meio de uma tarefa, escreva `HANDOFF.md` na raiz com estado, decisões
  tomadas, próximos passos e dúvidas abertas. O próximo agente o lê antes de começar e o atualiza ou apaga ao
  terminar. O arquivo está no `.gitignore`: é passagem de bastão, não documentação.
- Conhecimento durável (comandos, armadilhas, regras) vai para este arquivo ou para `doc/`, versionado, e não
  só na memória privada de uma ferramenta.

## Índice

| Caminho | Conteúdo |
| --- | --- |
| `README.md` | Telas, como rodar, scripts, estrutura, testes, E2E com Maestro (pré-requisitos, contornos do emulador) e CI |
| `doc/roteiro-ponta-a-ponta.md` | Roteiro de ponta a ponta: o que o Maestro cobre e o que falta conferir à mão |
| `doc/decisoes/` | Registro de decisões (modelo no README da pasta) |
| `../previna-backend/docs/README.md` | Regras de negócio da API e tabela de códigos de erro |

---

<!-- Bloco abaixo gerado pelo create-expo-app: mantenha intacto. -->

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
