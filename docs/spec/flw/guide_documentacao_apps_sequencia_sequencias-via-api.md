> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/documentacao/apps/sequencia/sequencias-via-api.md).

# Sequências via API

Entenda como gerenciar sequências e seus contatos via API.

É possível gerenciar sequências diretamente via API, realizando operações de listagem, adição e remoção de contatos de forma programática. O comportamento segue as mesmas regras da plataforma.

{% hint style="info" %}
As mesmas regras da plataforma se aplicam via API. Contatos que já fazem parte da sequência não serão adicionados novamente.
{% endhint %}

## Endpoints disponíveis

### Listar sequências

Retorna todas as sequências cadastradas na conta.

* **Método:** `GET`
* **Endpoint:** Sequências > Listar

### Listar contatos

Retorna todos os contatos atualmente em execução em uma sequência específica.

* **Método:** `GET`
* **Endpoint:** Sequências > Listar contatos
* **Parâmetros necessários:** ID da sequência

### Adicionar contato

Adiciona um único contato a uma sequência.

* **Método:** `POST`
* **Endpoint:** Sequências > Adicionar contato
* **Parâmetros necessários:** ID da sequência + ID do contato ou telefone

### Adicionar contatos

Adiciona múltiplos contatos a uma sequência em uma única requisição.

* **Método:** `POST`
* **Endpoint:** Sequências > Adicionar contatos
* **Parâmetros necessários:** ID da sequência + lista de IDs dos contatos ou telefones

### Remover contato

Remove um único contato de uma sequência.

* **Método:** `DEL`
* **Endpoint:** Sequências > Remover contato
* **Parâmetros necessários:** ID da sequência + ID do contato ou telefone

### Remover contatos

Remove múltiplos contatos de uma sequência em uma única requisição.

* **Método:** `DEL`
* **Endpoint:** Sequências > Remover contatos
* **Parâmetros necessários:** ID da sequência + lista de IDs dos contatos ou telefones

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-d58890437eca1ed8606cfc4146c0c5cd0cd710d6%2FCaptura%20de%20tela%202026-05-28%20170547.png?alt=media" alt=""><figcaption></figcaption></figure>

***

## Artigos relacionados

* [Criar Sequência](/guide/documentacao/apps/sequencia/criar-sequencia.md)
* [Incluir Contatos na Sequência](/guide/documentacao/apps/sequencia/incluir-contato-na-sequencia.md)
* [Contatos na Sequência](/guide/documentacao/apps/sequencia/contatos-na-sequencia.md)
* [Remover Contatos](/guide/documentacao/apps/sequencia/remover-contatos.md)


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/documentacao/apps/sequencia/sequencias-via-api.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
