# Registro de decisões

Uma decisão por arquivo, com nome `AAAA-MM-DD-assunto.md` (data da decisão, assunto em minúsculas e com hífens),
por exemplo `2026-11-21-expiracao-dos-cupons.md`.

Registre aqui o que foi decidido e ainda não está no código, ou cujo porquê o código não mostra: uma regra
combinada, uma alternativa recusada, um limite aceito. Não reescreva uma decisão antiga: se ela mudar, crie um
arquivo novo e diga no antigo qual o substitui.

## Modelo

```markdown
# <Assunto>

- **Data:** AAAA-MM-DD
- **Situação:** proposta | aceita | substituída por `AAAA-MM-DD-outro-assunto.md`

## Contexto

O problema e o que obrigou a decidir (regra, bug, limite, pedido).

## Decisão

O que foi decidido, em poucas frases e no imperativo.

## Alternativas descartadas

- Alternativa: por que não.

## Consequências

O que muda, o que fica mais difícil e o que precisa ser feito depois.
```
