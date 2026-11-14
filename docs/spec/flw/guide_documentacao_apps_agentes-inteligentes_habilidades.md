> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/documentacao/apps/agentes-inteligentes/habilidades.md).

# Habilidades

Guia de Habilidades: Ensinando seu Agente a Agir

As Habilidades são as ações práticas que seu Agente de IA pode executar. É aqui que você transforma a capacidade de conversação do agente em resultados tangíveis, como transferir um atendimento, criar um card no CRM ou atualizar dados de um contato.

Para começar, na seção  “Habilidades”, clique em **+**. Uma janela se abrirá com todas as ações disponíveis.

**Campos Comuns a Todas as Habilidades**

Antes de detalhar cada habilidade, entenda os campos que aparecem em quase todas elas:

* **Nome da habilidade:** Um nome interno para você identificar a ação (ex: "Transferir para Suporte").
* **Definição de uso:** Este é o campo mais importante. Aqui você descreve em linguagem natural *quando* a IA deve usar esta habilidade. Quanto mais claro e detalhado, mais assertivo será o agente. (ex: "Use quando o cliente disser que quer falar com um especialista ou atendente humano.").
* **Executar sem responder ao cliente:**
  * Regra de Negócio: Se marcado, a habilidade é executada de forma silenciosa, sem enviar uma mensagem ao cliente. Ideal para ações de bastidores, como aplicar uma etiqueta. Por padrão, esta opção vem desmarcada.

#### Habilidades Disponíveis

**1. Sequência**

* **Objetivo:** Adicionar ou remover o contato de uma sequência durante a conversa.
* **Campos Específicos:**
  * **Escolha a ação:** Escolha entre Adicionar à sequência ou Remover da sequência.
  * **Selecione a sequência:** Escolha a sequência que será usada. Sequências desabilitadas ou sem etapas aparecem bloqueadas na lista.

**2. Follow-up**

* **Objetivo:** Enviar mensagens automáticas para retomar a conversa quando o cliente para de responder.
* **Campos Específicos:**
  * **Tempo para aguardar resposta antes do follow-up:** Quanto tempo o agente espera sem resposta do cliente antes de enviar a mensagem.
  * **Máximo de follow-ups:** Quantas mensagens de follow-up podem ser enviadas, no máximo.
  * **Prompt de follow-up (instrução para o agente):** Campo obrigatório. Descreva como o agente deve escrever a mensagem: o tom, o objetivo (como retomar a conversa ou oferecer ajuda) e o que evitar (ex.: "Não repita saudações como 'Olá' ou 'Como posso ajudar'. Continue a partir do contexto da conversa.").
  * **Usar mensagem de break-up:** Se marcada, a última mensagem de follow-up, enviada antes de encerrar o contato, segue uma instrução própria. Ao marcar, aparece o campo obrigatório **Prompt de break-up (última mensagem)**, onde você descreve como o agente deve escrever essa mensagem (ex.: "Reforce brevemente o valor da oferta ou do próximo passo, crie urgência e convide para uma ação clara: responder agora, agendar ou fechar. Seja breve e respeitoso.").
  * **Configuração do chatbot:** Para o follow-up funcionar, o campo **Tempo máximo de inatividade**, no nó de Agente de IA do chatbot, precisa ter um valor mínimo. Esse valor muda conforme o tempo de espera e o número de follow-ups configurados, e aparece no aviso da própria tela de configuração.

**3. Informações do Contato**

* **Objetivo:** Consultar dados cadastrais (Nome, CPF, E-mail, etc.) para usar na conversa ou validar identidade.
* **Campos Específicos:**
  * **Nome da habilidade:** Identificador interno (ex: "Ler Cadastro").
  * **Definição de uso:** Instrução para a IA saber quando usar (ex: *"Use esta habilidade no início da conversa para saber o nome do cliente"*).
  * **Campos do Contato:** Selecione quais dados ficarão visíveis para a IA. Você pode marcar "Selecionar todos" ou escolher campos específicos como Telefone, E-mail, Empresa, etc.

**4. Etiquetas do Contato**

* **Objetivo:** Adicionar ou remover etiquetas de um contato para segmentação e organização.
* **Campos Específicos:**
  * Ação: Escolha entre Adicionar etiqueta ou Remover etiqueta.
  * Etiquetas: Selecione as etiquetas que serão aplicadas ou removidas.

**5. Transferir Atendimento**

* **Objetivo:** Encaminhar a conversa para uma equipe de atendimento humano.
* **Campos Específicos:**
  * Quando transferir: Campo para detalhar a condição da transferência.
  * Equipe: Selecione a equipe que receberá o atendimento.
  * **Finalizar atuação da IA após a transferência:**
    * Regra de Negócio: Se marcado (padrão), a IA encerra sua participação. Se desmarcado, a IA transfere mas continua ativa na conversa.

**6. Concluir Atendimento**

* **Objetivo:** Finalizar a conversa com o cliente de forma automática.
* **Campos Específicos:**
  * Mensagem de encerramento do atendimento: O texto que o cliente receberá ao final da conversa.
  * Informações sobre o encerramento: Um campo para um resumo ou nota interna sobre o motivo do encerramento.

**7. Criar Card no CRM**

* **Objetivo:** Criar um novo card (tarefa, oportunidade, etc.) no seu CRM integrado.
* **Campos Específicos:**
  * Painel e Etapa: Selecione o quadro e a coluna onde o card será criado.
  * Título e Descrição: Defina o título e o conteúdo do card.
  * Vencimento e Etiquetas: Adicione prazo e tags ao card.

**8. Acionar API**

* **Objetivo:** Conectar-se e enviar dados para sistemas externos através de uma chamada de API.
* **Campos Específicos:**
  * URL da API: O endereço do endpoint que será chamado.
  * Método: O método HTTP da requisição (POST, GET, etc.).
  * Headers: Cabeçalhos da requisição (ex: autenticação).
  * Body: O corpo dos dados a serem enviados (ex: JSON).

**9. Acionar Fluxo do Chatbot**

* **Objetivo:** Direcionar o cliente para um fluxo específico do seu chatbot construtor (Builder).
* **Campos Específicos:**
  * Informações do direcionamento no chatbot: Campo para selecionar ou identificar o fluxo de destino.

**10. Alterar Campo do Contato**

* **Objetivo:** Atualizar uma informação no perfil do contato (ex: email, telefone, campo customizado).
* **Campos Específicos:**
  * Campo do contato: Selecione qual atributo do contato será modificado.
  * Ação: Defina a operação (ex: "Alterar por").
  * Valor: Insira o novo valor para o campo.

**11. Consultor Servidor MCP**

* **Objetivo:** Realizar consultas a um servidor específico (MCP) para buscar informações.
* **Campos Específicos:**
  * URL da API: O endereço do endpoint de consulta no servidor MCP.
  * Header de autenticação: Dados de autenticação, se necessários.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2FOTx1whNRjtJg0iHmS62h%2FAnima%C3%A7%C3%A3o.gif?alt=media&amp;token=2c85a5a9-0510-4fd7-ab50-d1b9442419e9" alt=""><figcaption></figcaption></figure>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/documentacao/apps/agentes-inteligentes/habilidades.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
