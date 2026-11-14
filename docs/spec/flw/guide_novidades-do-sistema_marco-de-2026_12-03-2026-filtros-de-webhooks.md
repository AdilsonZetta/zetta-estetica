> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/novidades-do-sistema/marco-de-2026/12-03-2026-filtros-de-webhooks.md).

# 12/03/2026 - Filtros de Webhooks

#### 🆕 **Webhooks: Novos filtros nas assinaturas**

Agora ficou muito mais fácil **controlar quais eventos sua integração recebe via webhook**.

Antes, ao assinar um evento, o sistema enviava **todas as ocorrências daquele tipo** para a URL configurada. Isso fazia com que muitas integrações precisassem processar **grandes volumes de chamadas desnecessárias**, mesmo quando apenas uma parte dos eventos era relevante.

🚀 **O que chegou de novo?**

Agora é possível configurar **filtros nos eventos de webhook**, permitindo que você receba **apenas os eventos que realmente importam para sua integração**.

Os seguintes eventos agora suportam filtros:

**Atendimentos e mensagens**

* Atendimento criado
* Atendimento alterado
* Atendimento concluído
* Mensagem atualizada
* Mensagem recebida
* Mensagem enviada

**Contato**

* Contato etiqueta alterada

**CRM (Painéis)**

* Painel — Card criado
* Painel — Card alterado
* Painel — Card movido
* Painel — Anotação criada
* Painel — Anotação alterada

**Modelos de mensagem**

* Modelo de mensagem criado
* Modelo de mensagem alterado

⚙️ **Filtros disponíveis**

Dependendo do evento selecionado, é possível filtrar por:

* Canal
* Equipe
* Usuário
* Situação da conversa
* Etiquetas do contato
* Painéis
* Tipos de modelo de mensagem

Cada filtro permite **seleção múltipla** e também possui a opção **“Todos”**, mantendo o comportamento padrão quando necessário.

⚙️ **Como funciona na prática?**

* Os filtros são **opcionais**.
* Quando configurados, o webhook recebe **apenas eventos que atendem a todos os critérios definidos**.
* Quando nenhum filtro é aplicado, o webhook **continua funcionando como antes**, recebendo todos os eventos do tipo assinado.

💡 Com isso, as integrações ficam **mais eficientes, organizadas e escaláveis**, reduzindo chamadas desnecessárias e facilitando o processamento apenas do que realmente importa. 🚀

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-92391c299e609193ed5933a906b1324ea79ac449%2Fimage%20(152).png?alt=media" alt=""><figcaption></figcaption></figure>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/novidades-do-sistema/marco-de-2026/12-03-2026-filtros-de-webhooks.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
