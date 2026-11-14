> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/novidades-do-sistema/janeiro-de-2026/21-01-2026-api.md).

# 21/01/2026 - API

### 🔌 Integrações e API

#### **Atualização de Campos Personalizados**

**🔧**Ao atualizar campos personalizados do tipo **Data, Horário ou Data e Horário** via API, quando o valor era enviado vazio, o conteúdo anteriormente salvo **não era removido**, permanecendo indevidamente na plataforma.

**✅** Agora, se você enviar um comando para limpar um campo de data ou horário (enviando valor vazio), o sistema removerá a informação corretamente do cadastro, mantendo sua base de dados higienizada.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-02f841c7ffbabdcc455f4a6d80322c4235fa05a1%2Fimage%20(134).png?alt=media" alt=""><figcaption></figcaption></figure>

#### **Disponibilidade de Usuários via API**

**🔧**Com o objetivo de tornar o processo de criação e gerenciamento de usuários via API mais eficiente e flexível, **implementamos a possibilidade de definir a disponibilidade do usuário diretamente pela API.**

**✅Melhoria implementada:** Foi adicionado o novo parâmetro **Availability** nos endpoints de **listar, criar, obter por ID e atualizar usuários**, permitindo verificar, criar ou atualizar usuários como disponíveis ou indisponíveis.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-74582f4e80075e2338a865958825ab6de02a140e%2Fdisponibilidade%20do%20usuario%20via%20API%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

#### **Enviar Mensagem via API**

**🔧**Ao enviar uma mensagem via API **(Mensagem → Enviar ou Mensagem → Enviar Síncrono)** definindo um atendente específico, o sistema distribuía a conversa, mas não mostrava visualmente quem era o dono. O atendimento aparecia na aba "Novos" como se estivesse livre, causando confusão na equipe.

**✅Melhoria implementada:** Agora, os atendimentos direcionados a um usuário específico via API **possuem identificação visual clara** no histórico da conversa.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-b993854a7cc2287c7fba09a332cb46e97f76f82d%2Fatribuido%20para%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

\
**Transferência de Atendimentos via API**

**🔧**A API permitia a transferência de atendimentos (Conversas → Transferir) para **usuários ou equipes excluídas**, gerando inconsistências no fluxo e possíveis falhas operacionais.

**✅**&#x41;gora, o sistema valida o destino antes da operação: se o usuário ou equipe não existirem mais, a transferência é bloqueada e um aviso claro é retornado.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-05be2c2094ad9c42b5ccbd58f5380ec5fad48bd8%2Ftransf%20para%20usuario%20ou%20equipe%20excluida.png?alt=media" alt=""><figcaption></figcaption></figure>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/novidades-do-sistema/janeiro-de-2026/21-01-2026-api.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
