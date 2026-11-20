# Roteiro do teste de ponta a ponta — Cupons, Promoções e melhorias de 20/11

Ambiente de dev no Docker:
- portal em `http://localhost:8080`;
- MailHog em `http://localhost:8025`;
- app no Expo Go, no celular ou no emulador do Android Studio (`emulator-5554`).

Usuários do seed: `admin` / `admin123` e `medico` / `medico123`.

**Legenda:**
- ✅ **Maestro (fluxo N):** coberto pelos testes automáticos do app (`.maestro/`, branch `test/e2e-maestro`), que passaram 7/7 no emulador em 20/11.
- ✅ **Preparação:** feito pela API no `npm run e2e:preparar`. A regra do backend está coberta, mas a tela do portal não foi usada.
- ✅ **Conferido:** verificado à mão ou por comando, com a data.
- [ ] **Manual:** ainda falta fazer.

Como rodar os testes automáticos: veja a seção "Testes de ponta a ponta (Maestro)" no README do app.

## 0. Preparação
- ✅ **Conferido (20/11):** os quatro repositórios estão na `development` atualizada.
- ✅ **Conferido (20/11):** o backend foi reiniciado com as rotas novas.
- ✅ **Conferido (20/11):** o Flyway está na **V24** (log de auditoria).
- ✅ **Conferido (20/11):** o emulador do Android Studio, o Expo Go, o `adb` e o Maestro estão funcionando no Windows.

## 1. Empresa, produto, cupom e promoção (portal)
- ✅ **Preparação:** pré-cadastro de empresa pelo admin, com a senha temporária lida no MailHog.
- ✅ **Preparação:** primeiro acesso da empresa.
- ✅ **Preparação:** produto FRALDAS, cupom de poucos pontos e promoção FRALDAS vigente hoje.
- [ ] **Manual (tela do portal):** fazer o mesmo pelas telas: pré-cadastro, primeiro acesso pelo e-mail, cadastro de produto, cupom e promoção.
- [ ] **Manual, regra D12:** criar uma segunda promoção de FRALDAS no mesmo período. O portal deve avisar da sobreposição (409 `PROMOCAO_SOBREPOSTA`).
- [ ] **Manual, regra D10:** num produto sem categoria, deve dar para criar cupom e não deve haver promoção.

## 2. Gestante com pontos
- ✅ **Preparação:** pré-cadastro da gestante pelo médico, exame agendado para hoje e confirmado (crédito de pontos), primeiro acesso e tutorial.
- [ ] **Manual:** fazer o primeiro acesso e o tutorial pela tela do app, porque a preparação faz pela API.
- ✅ **Maestro (fluxo 01):** login, Início e sessão lembrada ao reabrir o app.
- ✅ **Maestro (fluxo 02):** a aba Pontos mostra o saldo igual ao da API, e puxar para baixo atualiza depois de um débito.
- [ ] **Manual:** o extrato de pontos com o crédito e os filtros.
- [ ] **Manual, agendamento repetido:** agendar duas vezes o mesmo tipo na mesma data para a mesma gestante. O portal deve avisar (409 `AGENDAMENTO_PENDENTE_REPETIDO`).

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
- [ ] **Manual (tela do portal):** abrir **Validar cupom** pelo menu e pelo link do tutorial (etapa 4).
- [ ] **Manual:** digitar o código em minúsculas e apertar Enter. Deve aparecer o cartão verde com os dados e "Validado em".
- [ ] **Manual:** validar o mesmo código de novo. Deve aparecer o cartão vermelho "já foi utilizado em <data e hora>".
- [ ] **Manual:** validar o código da promoção. Deve aparecer o cartão verde "Promoção validada".
- [ ] **Manual:** validar um código inventado. Deve aparecer "Código não encontrado".
- [ ] **Manual, outra empresa:** validar com outra empresa um código da primeira. Deve aparecer "não encontrado", nunca "já utilizado".
- [ ] **(Opcional) Expirado:** no banco de dev, pôr `data_validade` no passado em um resgate ATIVO e validar. Deve aparecer "expirou", e o status no banco deve virar EXPIRADO.
- [ ] **(Opcional) Leitor de QR:** ler o QR Code do app com um leitor USB e conferir que ele valida sozinho com o Enter.

## 6. Volta ao app
- ✅ **Maestro (fluxo 07):** depois da validação, puxar para baixo em Cupons resgatados mostra "Utilizado", e o detalhe diz que o cupom já foi usado.
- [ ] **Manual:** o filtro de status UTILIZADO mostra só esses.

## 7. Histórico com pendentes (app)
- ✅ **Maestro (fluxo 06):** "Ver histórico" mostra "Concluídos (1)" com o exame realizado.
- [ ] **Manual:** com um exame agendado e ainda não confirmado, a seção "Pendentes" aparece antes de "Concluídos".

## 8. Portal: perfis, linhas clicáveis e painel da tela Início
- [ ] **Manual, bloqueio por perfil:** como admin, digitar `/produtos` na barra de endereço volta para o início. Como empresa, `/medicos` também volta.
- [ ] **Manual, linha clicável:** na lista de gestantes do médico, clicar em qualquer ponto da linha abre a gestante. Nas listas de produtos e cupons, o botão Ativar/Desativar não abre a linha.
- [ ] **Manual, saudação:** Bom dia, Boa tarde ou Boa noite conforme a hora do computador.
- [ ] **Manual, painel do médico:** agenda do dia, atrasados (em vermelho), próximos 7 dias e gestantes sem nada agendado.
- [ ] **Manual, painel da empresa:** botão "Validar cupom", os 4 números, cupons que vencem em 7 dias, produtos sem oferta e últimas validações. Depois do fluxo 07, a validação feita deve aparecer em "Últimas validações".
- [ ] **Manual, painel do admin:** os números, as empresas aguardando o primeiro acesso (as empresas "E2E" da preparação aparecem ali se não fizeram o primeiro acesso) e a atividade recente.

## 9. Log de auditoria
- [ ] **Manual:** depois dos testes, a atividade recente do admin mostra as ações (agendado, confirmado, cupom resgatado, promoção resgatada, código validado). Nas ações da gestante, aparece só "Gestante", sem o nome.
- [ ] **Manual (opcional, banco):** `SELECT acao, count(*) FROM log_auditoria GROUP BY acao;` deve mostrar as 6 ações. Um `UPDATE` ou `DELETE` na tabela deve falhar.

## 10. Rota antiga removida
- ✅ **Conferido (20/11):** `GET http://localhost:8080/backend/cupons/disponiveis` responde 404.

## Próximo passo para reduzir o manual
As seções 1, 5 e 8 são telas do portal. Elas podem virar testes automáticos com o **Playwright**, do mesmo jeito que o Maestro cobriu o app.

## Resultado
Anotar aqui o que falhou, com o passo, o print e o horário, para cruzar com os logs do backend.
