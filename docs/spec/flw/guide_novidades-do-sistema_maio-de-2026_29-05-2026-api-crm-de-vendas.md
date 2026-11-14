> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/novidades-do-sistema/maio-de-2026/29-05-2026-api-crm-de-vendas.md).

# 29/05/2026 - API CRM de Vendas

### 🔗 Evolução na API para suportar novos recursos do CRM

A API do CRM foi atualizada para suportar o novo ciclo de vida de Ganho e Perda nos cards. As mudanças incluem novos filtros, campos de resposta e um endpoint dedicado para motivos de perda, tudo de forma retrocompatível, já que todos os novos parâmetros são opcionais.

***

#### ✅ **O que foi adicionado?**

### **1. Novo endpoint GET /v2/panel — Filtro e campo type**

• Foi criada uma **versão V2** do endpoint de listagem de painéis para suportar os novos recursos.\
• Novo parâmetro de query opcional **type** para filtrar painéis pelo tipo. Valores aceitos: SALES e MANAGEMENT.\
• O campo **type** é retornado no objeto de cada painel na resposta, indicando se ele é do tipo Vendas (SALES) ou Gestão (MANAGEMENT).

> ⚠️ O endpoint GET /v1/panel **não foi alterado** e continua funcionando normalmente. Vale lembrar que a V1 retorna apenas painéis do tipo Gestão (MANAGEMENT). Para acessar painéis do tipo Vendas, utilize a V2.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-64917081ddf5f8ab0112f1330ddfeae5469bdeb2%2Fimage%20(358).png?alt=media" alt=""><figcaption></figcaption></figure>

### **2. Novo endpoint GET /v2/cards — Filtro por situação, campo status e motivo de perda**

• Foi criada uma **versão V2** do endpoint de listagem de cards para suportar os novos recursos.\
• Novo parâmetro de query opcional **statuses** para filtrar cards por situação. Valores aceitos: OPEN, WON, LOST e ARCHIVED. É possível informar múltiplos valores simultaneamente.\
• O campo **status** é retornado no objeto de cada card na resposta, refletindo o estado atual da negociação.\
• O parâmetro **includeDetails** passa a aceitar o novo valor LostReason. Quando informado, a resposta de cada card com status LOST incluirá o objeto **lostReason**, contendo o id e o name do motivo registrado. Se LostReason não for enviado, o objeto lostReason ainda aparece na resposta, porém com os campos id e name retornando como null.

> **OPEN** → card em andamento, sem marcação de ganho/perda e sem arquivamento.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-d67e31acab7e6d42bb0a0576c4e64507cdfadab7%2FAPI%20LISTAR%20CARDS2.png?alt=media" alt=""><figcaption></figcaption></figure>

### **3. Novo endpoint GET /v1/panels/{panelId}/lost-reasons**

• Endpoint dedicado para listar os **motivos de perda** cadastrados em um painel específico do tipo Vendas (SALES).\
• Retorna a lista de motivos disponíveis com id e name de cada item.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-66190a93de0095efb5d4779c75b2ce7db51dfaa4%2Fimage%20(360).png?alt=media" alt=""><figcaption></figcaption></figure>

### **4. Endpoint PUT /v3/panel/card/{id} — Atualização de status e remoção do parâmetro archived**

• Foi criada uma **versão V3** do endpoint de atualização de card para consolidar o gerenciamento de estado.\
• O array **fields** passa a aceitar o valor "status", permitindo atualizar a situação do card via requisição PUT.\
• Novo parâmetro opcional **status** no corpo da requisição. Valores aceitos: OPEN, WON, LOST e ARCHIVED. Apenas um valor pode ser enviado por vez.\
• O campo **status** com o valor atualizado passa a ser retornado no objeto de resposta.\
• O parâmetro **archived** foi removido do corpo da requisição, da resposta e dos valores aceitos no array fields, pois foi substituído pelo novo campo status.

> ⚠️ O parâmetro archived foi removido **apenas na V3**. Se você utiliza esse parâmetro e deseja migrar para a V3, atualize para o novo campo status com o valor ARCHIVED. Caso permaneça na V2, nenhuma alteração é necessária.

> ℹ️ A marcação de status WON (Ganho) ou LOST (Perda) é exclusiva para cards de **painéis do tipo Vendas** (SALES). Tentativas de aplicar esses status em cards de painéis do tipo Gestão (MANAGEMENT) não são suportadas.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-4f558909462ca37b13a72f7a665483f9f3482779%2Fimage%20(361).png?alt=media" alt=""><figcaption></figcaption></figure>

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-8bf5c93fe1e4d872412a055b711642ba1cafe215%2Fimage%20(362).png?alt=media" alt=""><figcaption></figcaption></figure>

### **5. Endpoint PUT /v3/panel/card/{id} — Bloqueio de movimentação de etapa para cards finalizados**

• Cards com status WON (Ganho) ou LOST (Perda) não podem ter sua etapa (stepId) alterada enquanto estiverem nesse estado.\
• Tentativas de mover a etapa de um card finalizado resultarão em erro, com mensagem indicando que o card não pode ser movido. Para reabrir o card, atualize o status para OPEN antes de alterar a etapa.

> ℹ️ Esta validação se aplica às versões V2 e V3 do endpoint de atualização de card.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/novidades-do-sistema/maio-de-2026/29-05-2026-api-crm-de-vendas.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
