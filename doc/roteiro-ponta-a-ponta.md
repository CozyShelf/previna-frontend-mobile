# Roteiro do teste de ponta a ponta — Cupons, Promoções e melhorias de 20/11

Ambiente de dev no Docker:
- portal em `http://localhost:8080`;
- MailHog em `http://localhost:8025`;
- app no Expo Go, no celular ou no emulador do Android Studio (`emulator-5554`).

Usuários do seed: `admin` / `admin123` e `medico` / `medico123`.

**Legenda:**
- ✅ **Maestro (fluxo N):** coberto pelos testes automáticos do app (`.maestro/`, branch `test/e2e-maestro`), que passaram 7/7 no emulador em 20/11.
- ✅ **Playwright (arquivo):** coberto pelos testes automáticos do portal (`e2e/*.spec.ts` no `previna-frontend`, branch `test/e2e-playwright`), que passaram 23/23 em 20/11. Para rodar: `npm run e2e:docker`.
- ✅ **Preparação:** feito pela API no `npm run e2e:preparar`. A regra do backend está coberta, mas a tela do portal não foi usada.
- ✅ **Conferido:** verificado à mão ou por comando, com a data.
- [ ] **Manual:** ainda falta fazer.

Como rodar os testes automáticos: veja a seção "Testes de ponta a ponta (Maestro)" no README do app e "Testes de ponta a ponta (Playwright)" no README do portal.

## 0. Preparação
- ✅ **Conferido (20/11):** os quatro repositórios estão na `development` atualizada.
- ✅ **Conferido (20/11):** o backend foi reiniciado com as rotas novas.
- ✅ **Conferido (20/11):** o Flyway está na **V24** (log de auditoria).
- ✅ **Conferido (20/11):** o emulador do Android Studio, o Expo Go, o `adb` e o Maestro estão funcionando no Windows.

## 1. Empresa, produto, cupom e promoção (portal)
- ✅ **Preparação:** pré-cadastro de empresa pelo admin, com a senha temporária lida no MailHog.
- ✅ **Preparação:** primeiro acesso da empresa.
- ✅ **Preparação:** produto FRALDAS, cupom de poucos pontos e promoção FRALDAS vigente hoje.
- ✅ **Playwright (`empresa.spec.ts`):** o mesmo pelas telas: o admin faz o pré-cadastro com a senha lida no MailHog, a empresa faz o primeiro acesso e cadastra o produto FRALDAS, o produto sem categoria, o cupom e a promoção.
- ✅ **Playwright (`empresa.spec.ts`), regra D12:** a segunda promoção de FRALDAS no mesmo período mostra o aviso de sobreposição.
- ✅ **Playwright (`empresa.spec.ts`), regra D10:** o produto sem categoria aceita cupom, e a promoção exige categoria.

## 2. Gestante com pontos
- ✅ **Preparação:** pré-cadastro da gestante pelo médico, exame agendado para hoje e confirmado (crédito de pontos), primeiro acesso e tutorial.
- [ ] **Manual:** fazer o primeiro acesso e o tutorial pela tela do app, porque a preparação faz pela API.
- ✅ **Maestro (fluxo 01):** login, Início e sessão lembrada ao reabrir o app.
- ✅ **Maestro (fluxo 02):** a aba Pontos mostra o saldo igual ao da API, e puxar para baixo atualiza depois de um débito.
- [ ] **Manual:** o extrato de pontos com o crédito e os filtros.
- ✅ **Playwright (`medico.spec.ts`), agendamento repetido:** o aviso aparece para um item repetido na mesma lista e contra um agendamento já gravado (409 `AGENDAMENTO_PENDENTE_REPETIDO`).

## 3. Resgates (app)
- ✅ **Maestro (fluxo 03):** a busca na Loja acha o produto, e o detalhe mostra os cards do cupom e da promoção.
- [ ] **Manual:** os filtros de categoria, tipo e "cabe no meu saldo" da Loja. O fluxo usa só a busca.
- ✅ **Maestro (fluxo 03):** resgatar o cupom mostra "Cupom resgatado!", o detalhe com o código igual ao da API, o QR Code e o botão Copiar ("Código copiado"), e o saldo cai.
- ✅ **Maestro (fluxos 02 e 03):** o mesmo cupom pode ser resgatado de novo enquanto houver saldo (D13).
- [ ] **Manual:** sem saldo, aparece o aviso de pontos insuficientes.
- ✅ **Maestro (fluxo 04):** a promoção é resgatada sem mudar o saldo, e ao voltar ao produto aparece "Já resgatada".
- [ ] **Manual, toque duplo:** tocar duas vezes rápido em Resgatar deve gerar um só resgate. A garantia existe no backend, com teste próprio, mas não foi testada na tela.

## 4. Cupons resgatados (app)
- ✅ **Maestro (fluxo 05):** a aba "Cupons resgatados" lista o cupom e a promoção, os filtros Cupom e Promoção funcionam, e os detalhes mostram o código igual ao da API.
- [ ] **Manual:** os filtros de busca, categoria e status, e a ordem com os ativos primeiro.

## 5. Validação (portal)
- ✅ **Maestro (fluxo 07):** a empresa valida o código pela API (`POST /empresas/cupons/validar`).
- ✅ **Playwright (`validar-cupom.spec.ts`):** abre **Validar cupom** pelo menu e pelo link do tutorial (etapa 4).
- ✅ **Playwright (`validar-cupom.spec.ts`):** o código em minúsculas mais Enter mostra o cartão verde com "Validado em".
- ✅ **Playwright (`validar-cupom.spec.ts`):** o mesmo código de novo mostra "já foi utilizado em <data e hora>".
- ✅ **Playwright (`validar-cupom.spec.ts`):** o código da promoção mostra "Promoção validada".
- ✅ **Playwright (`validar-cupom.spec.ts`):** um código inventado mostra "Código não encontrado".
- ✅ **Playwright (`validar-cupom.spec.ts`), outra empresa:** um código da primeira empresa, usado ou não, mostra "não encontrado", nunca "já utilizado".
- [ ] **(Opcional) Expirado:** no banco de dev, pôr `data_validade` no passado em um resgate ATIVO e validar. Deve aparecer "expirou", e o status no banco deve virar EXPIRADO.
- [ ] **(Opcional) Leitor de QR:** ler o QR Code do app com um leitor USB e conferir que ele valida sozinho com o Enter.

## 6. Volta ao app
- ✅ **Maestro (fluxo 07):** depois da validação, puxar para baixo em Cupons resgatados mostra "Utilizado", e o detalhe diz que o cupom já foi usado.
- [ ] **Manual:** o filtro de status UTILIZADO mostra só esses.

## 7. Histórico com pendentes (app)
- ✅ **Maestro (fluxo 06):** "Ver histórico" mostra "Concluídos (1)" com o exame realizado.
- [ ] **Manual:** com um exame agendado e ainda não confirmado, a seção "Pendentes" aparece antes de "Concluídos".

## 8. Portal: perfis, linhas clicáveis e painel da tela Início
- ✅ **Playwright (`perfis.spec.ts`), bloqueio por perfil:** o admin em `/produtos` e a empresa em `/medicos` voltam para o início.
- ✅ **Playwright (`medico.spec.ts`), linha clicável:** na lista de gestantes, clicar numa célula que não é o nome abre a gestante.
- [ ] **Manual:** nas listas de produtos e cupons, o botão Ativar/Desativar não abre a linha. Isso tem teste unitário, mas não foi visto na tela.
- ✅ **Playwright (`saudacao.spec.ts`), saudação:** às 9h aparece "Bom dia", às 15h "Boa tarde" e à 1h "Boa noite".
- ✅ **Playwright (`medico.spec.ts`), painel do médico:** gestantes acompanhadas, agenda de hoje, atrasados vazio, próximos 7 dias com o agendamento criado e gestantes sem nada agendado.
- [ ] **Manual:** ver o card "Atrasados" em vermelho, com um exame de data passada.
- ✅ **Playwright (`validar-cupom.spec.ts`), painel da empresa:** os 4 números, "Últimas validações" com os códigos e o botão "Validar cupom" levando à tela.
- ✅ **Playwright (`painel-admin.spec.ts`), painel do admin:** a atividade recente mostra agendado, confirmado, código validado, cupom resgatado e promoção resgatada.

## 9. Log de auditoria
- ✅ **Playwright (`painel-admin.spec.ts`):** nas ações da gestante aparece só "Gestante", e o nome dela não aparece nem na página nem na resposta de `/painel/admin`.
- [ ] **Manual (opcional, banco):** `SELECT acao, count(*) FROM log_auditoria GROUP BY acao;` deve mostrar as 6 ações. Um `UPDATE` ou `DELETE` na tabela deve falhar.

## 10. Rota antiga removida
- ✅ **Conferido (20/11):** `GET http://localhost:8080/backend/cupons/disponiveis` responde 404.

## O que sobra à mão
O app (Maestro) e o portal (Playwright) estão cobertos. O que sobra à mão é pouco, e a maior parte é visual: o card "Atrasados" em vermelho, o toque duplo, os filtros que os fluxos não usam, o leitor de QR e o código expirado.

## Resultado
Anotar aqui o que falhou, com o passo, o print e o horário, para cruzar com os logs do backend.
