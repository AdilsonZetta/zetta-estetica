> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/documentacao/atendimento/comece-aqui/acessando-pela-web.md).

# Acessando a Plataforma pela Web

Este guia detalha o processo de login e as considerações iniciais para acessar sua conta através do navegador.

A plataforma utiliza um código de validação em cada acesso para garantir a segurança da sua conta.

{% hint style="success" %}
**Pré-requisitos**

Para realizar o login com sucesso, certifique-se de atender aos seguintes requisitos:

* **Cadastro Válido:** Ser um usuário já cadastrado na plataforma.
* **Canal de Comunicação:** Possuir um número de telefone com WhatsApp e/ou um e-mail ativo cadastrado para recebimento do código de validação.
* **Navegador Recomendado:** Recomenda-se utilizar o Google Chrome para garantir a melhor experiência e compatibilidade.
  {% endhint %}

### **Passo 1: Iniciar o Login**

1. Acesse o site oficial da plataforma.
2. Clique no botão "Entrar" para ser direcionado à tela de login.

### **Passo 2: Inserir Credenciais**

1. Preencha o campo de acesso com o telefone (com DDD) ou e-mail utilizado no seu cadastro.
2. Um código de 6 dígitos será enviado para o seu canal de comunicação principal (WhatsApp ou E-mail).

### **Passo 3: Validar o Acesso**

1. Insira o código de 6 dígitos recebido.
2. Clique em "Entrar" para prosseguir.

{% hint style="warning" %}
**️ Atenção à Sessão Ativa**

Sua sessão permanecerá ativa na plataforma após o login bem-sucedido. Para garantir que sua conta seja desconectada por segurança, é fundamental que você utilize o processo de ***logout*** clicando explicitamente na opção "**Sair"** sempre que terminar de usar a plataforma.
{% endhint %}

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-39ad89211f22cce8b8a96dfd243b5b63099e86b2%2F17%20(1)%20(1)%20(1)%20(1).png?alt=media" alt="" width="563"><figcaption></figcaption></figure>

{% hint style="info" %}
**Considerações Adicionais: Primeiro Acesso**

Se este for seu primeiro acesso à plataforma, após a validação do código acima, você será solicitado a aceitar os Termos de Uso e Privacidade:

1. Clique na caixa de seleção para indicar que leu e aceita os termos.
2. Clique no botão "Concordo".
3. Importante: Para finalizar a primeira autenticação, um novo código de 6 dígitos será enviado para o mesmo canal de comunicação utilizado no Passo 2. Insira este novo código e clique em "Continuar".
   {% endhint %}


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/documentacao/atendimento/comece-aqui/acessando-pela-web.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
