> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/documentacao/crm/carteiras/funcionamento-da-carteirizacao/carteirizacao-via-api.md).

# Carteirização via API

Entenda como a carteirização se comporta ao criar atendimentos e gerenciar contatos em carteiras via API.

O funcionamento da carteirização via API é similar ao da plataforma, com uma particularidade importante: ao criar um atendimento, o comportamento depende dos campos informados na requisição, e não apenas da carteira atribuída ao contato.

{% hint style="warning" %}
**Carteirização prevalece sobre a distribuição automática:** quando a equipe possui distribuição de atendimentos configurada, ela é ignorada para contatos já carteirizados, desde que apenas a equipe seja informada na requisição. Se um atendente diferente do responsável pela carteira for informado, o sistema ignora a carteirização e direciona o atendimento para o atendente informado.
{% endhint %}

## Como funciona na prática

Ao criar um atendimento via API utilizando os endpoints **Mensagens > Enviar** ou **Mensagens > Enviar Síncrono**, o comportamento da carteirização depende dos campos informados na requisição.

### Contato já carteirizado

Quando o contato possui uma carteira atribuída e o atendimento é criado para a mesma equipe vinculada à carteira, o direcionamento varia conforme os campos informados:

| Campos informados na requisição                  | Comportamento                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Apenas a equipe**                              | O atendimento é direcionado automaticamente para o atendente responsável pela carteira            |
| **Equipe + atendente responsável pela carteira** | O atendimento é direcionado normalmente para o atendente responsável                              |
| **Equipe + outro atendente**                     | A carteirização é ignorada e o atendimento é direcionado para o atendente informado na requisição |

{% hint style="warning" %}
Se a equipe informada na requisição for diferente da vinculada à carteira, a carteirização é ignorada e o atendimento segue o fluxo normal daquela equipe.
{% endhint %}

### Contato sem carteira ou com carteira de outra equipe

Quando o contato ainda não possui carteira ou a carteira está vinculada a uma equipe diferente da informada na requisição, a carteirização não se aplica e o direcionamento segue as configurações da equipe:

* **Com distribuição de atendimentos ativada:** o atendimento é direcionado automaticamente para um dos atendentes disponíveis da equipe. Nesse caso, o status de disponibilidade do usuário é considerado. Caso o transbordo esteja ativado e o atendente não assuma dentro do prazo definido, o atendimento é repassado para o próximo atendente disponível.
* **Sem distribuição de atendimentos:** o atendimento fica disponível na fila de **Novos** para todos os membros da equipe, aguardando que um atendente o assuma.

### Carteirização automática

Quando um atendente assume o atendimento criado via API, a plataforma verifica se a carteirização automática está ativada na carteira:

* **Com carteirização automática ativada:** o contato é adicionado automaticamente à carteira do atendente que assumiu o atendimento. Um contato pode ter várias carteiras, desde que sejam de equipes diferentes.
* **Sem carteirização automática:** o contato não é carteirizado automaticamente, e o usuário deve realizar a atribuição manualmente nos dados do contato.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-d3da2ec966b26aac6631f57d837e69b8a8867e52%2FCaptura%20de%20tela%202026-05-15%20131735.png?alt=media" alt=""><figcaption></figcaption></figure>

## Gerenciamento de contatos em carteiras via API

É possível adicionar e remover contatos de carteiras utilizando o endpoint **Carteiras**. Acesse o endpoint desejado e informe os parâmetros necessários:

**Adicionar contato**

* ID da carteira
* ID do contato ou telefone do contato

**Remover contato**

* ID da carteira
* ID do contato ou telefone do contato

{% hint style="warning" %}
As mesmas regras da plataforma se aplicam via API. Não é possível adicionar um contato a duas carteiras vinculadas à mesma equipe.
{% endhint %}

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-4998bc4c2d5c41b1f6538b0a81f0ef5efc6d2cd8%2FCaptura%20de%20tela%202026-05-15%20131154.png?alt=media" alt=""><figcaption></figcaption></figure>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/documentacao/crm/carteiras/funcionamento-da-carteirizacao/carteirizacao-via-api.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
