> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/novidades-do-sistema/outubro-de-2026/09-10-2026-novo-padrao-de-datas-em-webhooks-e-api.md).

# 09/10/2026 - Novo padrão de datas em Webhooks e API

### 🔗 **Webhooks e API: Padronização do formato de datas**

Os campos personalizados de data e horário eram retornados em formatos diferentes nos webhooks e na API.

Nos webhooks, as datas eram enviadas no formato americano (mês/dia/ano), o que fazia o dia e o mês parecerem invertidos. Na API, as datas vinham com barras, os campos de horário podiam vir com as horas e os minutos invertidos, e os campos de data e hora não indicavam o fuso horário. Com isso, os sistemas integrados podiam interpretar as datas de forma incorreta.

***

### ✅ **O que foi corrigido?**

Webhooks e API passam a seguir o mesmo padrão para os campos personalizados, no formato ISO 8601:

* **Data:** retornada no formato YYYY-MM-DD (ex: 2025-12-31).
* **Data e Hora:** retornada no formato YYYY-MM-DDThh:mm:ss.fffffff±hh:mm (ex: 2025-12-31T23:45:00.0000000-03:00).
* **Data e Hora:** o valor mantém exatamente o horário preenchido pelo usuário e indica o fuso horário configurado na conta, sem conversão de fuso.
* **Horário:** retornado corretamente na API no formato hh:mm (ex: 08:52), sem inversão entre horas e minutos.
* **Campos em intervalo:** cada valor do intervalo segue o formato do seu tipo, mantendo a estrutura atual (lista na API e texto separado por vírgula nos webhooks).

*Campos personalizados preenchidos no contato.*

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2FviIq7cLravXy2WNP97uR%2Fcampos%20personalizados%20de%20data%20e%20data%20e%20hora.png?alt=media&amp;token=5aeb30bc-e17c-4dc1-a10c-a77b74633e6c" alt=""><figcaption></figcaption></figure>

*Os mesmos campos retornados pela API, com o horário preenchido e o fuso da conta.*

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2FRcv0QfJ6PQOPuJ3WifOY%2Fconsulta%20de%20contato%20API.png?alt=media&amp;token=e0253eaa-044a-419a-8bf3-b3837946dd44" alt=""><figcaption></figcaption></figure>

### A mudança vale para:

* **Webhooks:** Contato alterado; Painel: Card criado, Card alterado e Card movido.
* **API de Contatos:** Listar, Filtrar, Obter por ID e Obter por número de telefone.
* **API de Cards:** Listar e Obter por ID.

> ⚠️ **O que não muda:** os campos padrão da plataforma, como data de criação e data de vencimento, continuam sendo convertidos e retornados em UTC (ex: um vencimento em 15/10/2026 às 23:59, no horário de Brasília, é retornado como 2026-10-16T02:59:41Z). A exibição de datas nas mensagens enviadas ao cliente final também não é afetada.

*Card com a data de vencimento (campo padrão) e campos personalizados de data, data e hora e horário.*

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fm4pzSFzUKBJmvG9ixuUo%2Fimage.png?alt=media&amp;token=1ecbeb0c-da58-438e-bf26-c02c9e53627f" alt=""><figcaption></figcaption></figure>

*Na API, o vencimento é convertido para UTC, enquanto os campos personalizados mantêm o valor preenchido.*

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2FSpLZxbhJPwj3niFOrAEK%2Flistar%20card.png?alt=media&amp;token=dd24f8d5-1fba-4454-b3de-449c6dced198" alt=""><figcaption></figcaption></figure>

*Como esses campos passam a ser enviados nos webhooks.*

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2FVAiLLFvDo6bTCg9IpczH%2Fwebhook%20ajustado%20com%20implementacao.png?alt=media&amp;token=65a2b621-478f-4b9d-8a2b-0d0df1dc08bd" alt=""><figcaption></figcaption></figure>

Se a sua integração lê ou interpreta campos personalizados de data ou horário, confirme que ela está preparada para o novo formato e para o fuso horário informado nos campos de data e hora.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/novidades-do-sistema/outubro-de-2026/09-10-2026-novo-padrao-de-datas-em-webhooks-e-api.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
