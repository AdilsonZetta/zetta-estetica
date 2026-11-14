> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/documentacao/apps/chatbot/enviar-pergunta/pergunta-dinamica.md).

# Pergunta Dinâmica

Gere opções de menu em tempo real integrando o seu chatbot a sistemas externos através de Webhooks.

O bloco **Enviar Pergunta Dinâmica** é uma funcionalidade avançada do construtor de Chatbots que permite gerar opções de menu em tempo real.

Diferente das perguntas tradicionais onde você precisa digitar cada opção **manualmente**, a **Pergunta Dinâmica extrai** as alternativas diretamente do seu sistema (via Webhook) no exato momento em que o cliente chega àquela etapa do fluxo.

Isso elimina a limitação dos fluxos estáticos e permite criar automações altamente personalizadas e adaptáveis ao contexto instantâneo do usuário.

#### **Como configurar:**

Para utilizar esta função, acesse o editor do seu Chatbot e siga os passos:

1. Clique no botão de **(+)** para adicionar um novo bloco.
2. Na seção de Mensagens, selecione **Enviar pergunta dinâmica.**

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-3fc594bbb4a6e35d97cb04ffec0a3fed519e5843%2Fimage%20(145).png?alt=media" alt=""><figcaption></figcaption></figure>

3. **Preenchendo o bloco principal:**

* **Flag “Definir como mensagem fixa”:** Permite determinar se o texto da pergunta enviada ao contato será uma mensagem estática (configurada manualmente) ou se será retornada dinamicamente pelo webhook.
  * **Se ativada:** O chatbot sempre enviará a mensagem fixa definida no campo "Mensagem" abaixo.
  * **Se desativada:** A mensagem será enviada conforme o texto retornado pelo webhook.
* **Mensagem:** Digite o texto base da sua pergunta (Ex: *"Escolha um dos horários disponíveis abaixo:"*). *Este campo será utilizado caso a flag de mensagem fixa esteja ativada.*
* **Webhook - Opções dinâmicas:** Insira a URL do seu sistema que será consultada (via requisição `POST`) para buscar as opções possíveis.

#### Configurações Avançadas e Tratamento de Erros

Ao expandir as opções do bloco, você encontrará recursos para personalizar o comportamento do bot, tempo de espera e detalhes da integração:

* **Respostas Inválidas:** Defina quantas vezes o bot deve tentar novamente se o cliente digitar uma opção incorreta. Ao atingir o limite de erros, você pode direcionar a conversa para um atendente humano (com opção de aviso de fora de horário), encerrar o atendimento ou apenas ignorar.
* **Salvar resposta no contato:** Grava a opção escolhida pelo cliente diretamente em um campo padrão ou personalizado do seu CRM.
* **Tempo de espera para envio da resposta:** Adiciona um pequeno atraso proposital (até 40s) antes do bot enviar a próxima mensagem, simulando "digitação" para tornar a conversa mais natural.
* **Tempo máximo de inatividade:** Define um prazo (até 72 horas) para o cliente responder. Se o tempo esgotar, o bot pode encerrar a automação ou direcionar o cliente para um fluxo de escape (ex: *"Ainda está aí?"*).
* **Integração (Chave de integração):** Permite criar um identificador único para este nó. Essa chave será enviada no seu webhook, ajudando o seu sistema externo a saber exatamente qual pergunta do fluxo o cliente acabou de responder.
* **Teste de Envio de Webhook:** Permite simular a requisição para a sua URL diretamente no editor, exibindo o status HTTP (ex: 200 OK) e o corpo da resposta para garantir que a integração está correta antes de publicar o fluxo.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-017c664a5e8d73b7235a8038411fa150222b731c%2Fsimulacao%20perguntas%20dinamicas.gif?alt=media" alt=""><figcaption></figcaption></figure>

#### Estrutura Técnica do Webhook (Retorno)

Para que a plataforma consiga renderizar a pergunta corretamente, a URL configurada no nó deve responder com um **JSON estruturado** contendo o texto, o tipo e as opções disponíveis.

**Exemplo de Resposta Esperada (JSON):**

```
{
  "text": "Como podemos ajudar hoje?",
  "type": "BUTTONS",
  "options": [
    {
      "text": "Área de Cliente",
      "url": "https://empresa.com/cliente"
    },
    {
      "text": "Falar com Suporte"
    }
  ]
}
```

**Detalhamento dos Parâmetros**

* **`text`** *(Opcional) -* Texto principal da pergunta. Pode ser omitido se a flag *"Definir como mensagem fixa"* estiver ativada no nó.
* **`type`** *(Obrigatório) -* Define a preferência do formato de exibição. Valores aceites: `"BUTTONS"`, `"LIST"` ou `"NUMBERS"`.
* **`options`** *(Obrigatório)* - Lista (array) contendo os itens que o utilizador poderá selecionar. Suporta no máximo 50 itens. Cada item pode conter:
  * **`text`** *(Obrigatório) -* O texto principal da opção.
  * **`description`** *(Opcional)* - Subtítulo de apoio da opção. **Permitido apenas no tipo `LIST`.**
  * **`url`** *(Opcional) -* Link de redirecionamento externo. **Permitido apenas no tipo `BUTTONS`.**

{% hint style="info" %}

#### Adaptação de Formatos (Regras de Exibição)

Para garantir que a experiência do usuário nunca quebre, o sistema adapta automaticamente o formato visual da pergunta com base na quantidade de opções que a sua integração retornar.\
\
**Observação Importante:** *Em canais não oficiais* (conexões via QR Code), o formato de botões não é suportado pelo WhatsApp. Caso o seu JSON envie o `type` como `"BUTTONS"` nestes canais, o sistema adaptará a exibição automaticamente **para Lista ou Numérico**, de acordo com a quantidade de opções recebidas, garantindo a entrega da mensagem.

As regras de transição são:

* **Botões (De 1 a 3 opções):** Ideal para respostas rápidas e diretas. Se o seu Webhook retornar de 1 a 3 itens, o WhatsApp exibirá botões clicáveis convencionais.
  * *Transição:* Se a integração retornar uma 4ª opção, o formato converte-se automaticamente para Lista.
* **Lista (De 1 a 10 opções):** Menu de seleção expansível. Ideal para escolhas de departamentos ou horários.
  * *Transição:* Se a integração retornar 11 ou mais opções, o sistema ajusta a exibição para o formato Numérico.
* **Numérico (De 1 a 50 opções):** Menu indexado em formato de texto. O cliente verá uma lista numerada (1, 2, 3...) e deverá digitar o número correspondente à opção desejada. Ideal para catálogos extensos ou lista de filiais.
  {% endhint %}


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/documentacao/apps/chatbot/enviar-pergunta/pergunta-dinamica.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
