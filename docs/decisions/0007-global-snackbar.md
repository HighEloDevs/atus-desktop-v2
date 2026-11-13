# 0007 — Snackbar global com Sonner e fachada `notify`

## Contexto

Erros e avisos transitórios da tela de análise apareciam inline (sob o formulário de dados, sob "Executar ajustes", junto ao gráfico e no topo da página). Isso deslocava o layout, duplicava o mesmo estado em duas telas (`projectError`) e deixava parte do feedback só para leitores de tela (cópia de parâmetros).

## Alternativas

- **Sonner via shadcn.** Cuida de fila, posição, empilhamento e pausa ao passar o mouse; permite renderizar o corpo do toast por conta própria.
- **Toast do Radix (`radix-ui`, já instalado).** Menos recursos de fila e empilhamento; exigiria mais código próprio.
- **Componente próprio.** Controle total, mas reimplementa fila, acessibilidade e animações.

## Decisão

Usar o Sonner, renderizando cada toast com `components/ui/toast-view.tsx` (ícone por severidade, título, descrição, até duas ações, botão de fechar e barra de timer). `lib/notify.tsx` é a única API usada pela interface: `notify.success|error|warning|info|loading|dismiss`. `AppToaster` (`components/ui/sonner.tsx`) é montado uma vez em `main.tsx` e oferece os modos lista (padrão), pilha e faixa, em seis posições (padrão: base direita). Visual sólido por padrão; `variant: "tinted"` por toast.

O timer é uma barra que encolhe por CSS (`.toast-timer`) e congela com o mouse sobre o toast, sem texto de segundos. Toasts persistentes (`duration: 0`) e `loading` não têm barra. Um `id` repetido atualiza o toast em vez de duplicá-lo.

Ficam inline os erros de validação de campo (`FitControls`) e os de diálogos (edição de tabela, separador), porque são contextuais e ligados por `aria-describedby`.

## Consequências

- Uma dependência a mais (`sonner`); `next-themes` não é usado (não há tema escuro).
- Os testes de componentes mockam `@/lib/notify` e verificam as chamadas, sem depender de portal e animação.
- Novos avisos transitórios devem usar `notify`; mensagens de validação ligadas a um campo continuam inline.
