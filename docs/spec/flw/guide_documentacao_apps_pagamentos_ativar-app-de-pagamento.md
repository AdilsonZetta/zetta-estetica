> For the complete documentation index, see [llms.txt](https://docs.flw.chat/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.flw.chat/guide/documentacao/apps/pagamentos/ativar-app-de-pagamento.md).

# Habilitar o App

Guia detalhado sobre como ativar e configurar o aplicativo de pagamento na plataforma, para começar a gerenciar cobranças diretamente por ela.

{% embed url="<https://drive.google.com/file/d/1QV8VQGzwY71kV1AwfbKPXh-GzjSo3xIo/view?usp=sharing>" %}

O aplicativo de pagamento conecta sua conta ao Banco Asaas, permitindo gerar cobranças e receber pagamentos sem sair da plataforma. Antes de usar as demais funcionalidades do módulo de Pagamentos, é necessário concluir essa ativação, veja como fazer isso a seguir.

{% hint style="success" %}
**Pré-requisitos**:

* Acessar a conta na plataforma com perfil de **Administrador**.
* Possuir uma conta ativa no **Banco Asaas**.
* Ter em mãos o **Token de Integração** fornecido pelo Banco Asaas.
  {% endhint %}

### **Passo 1: Acessar o menu de aplicativos**

1. Na tela inicial, acesse o menu **"Apps"**.
2. No menu de opções exibido, clique em **"Mais Apps"**.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-d4645777dd330312cc5ffc698ee499195ea7dcc1%2Fimage.png?alt=media" alt=""><figcaption></figcaption></figure>

### **Passo 2: Habilitar a integração com o Asaas**

Na tela de aplicativos integrados, localize o aplicativo **Asaas**.

1. Clique no botão **"Habilitar Asaas"**.

Em seguida, será exibida a janela de configuração do aplicativo.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-b53fe06609a6848268efdfdfab280f267d228385%2FCaptura%20de%20tela%202026-07-17%20104520.png?alt=media" alt=""><figcaption></figcaption></figure>

### **Passo 3: Configurar o token de integração**

1. Na janela de configuração aberta, clique em **"Aplicativo Habilitado"**.
2. Insira o **Token de Integração** fornecido pelo Banco Asaas.
3. Clique em **"Continuar"** para concluir a configuração.

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-7811970551547e2665da4c04fb385df432dfc3fa%2FCaptura%20de%20tela%202026-07-17%20104708.png?alt=media" alt=""><figcaption></figcaption></figure>

### **Passo 4: Confirmar a ativação e configurar**

1. Após concluir a integração, a tela de aplicativos indicará que a funcionalidade Asaas está **ativa**.
2. Para configurar a conta ou personalizar a imagem exibida, clique em **"Configurar"**.
3. Na aba **"Dados"**, qualquer alteração de conta ou encerramento deve ser feito diretamente com o **Banco Asaas**.
4. Na aba **"Personalização"**, selecione a imagem desejada e clique em **"Salvar"** para aplicá-la.

{% hint style="warning" %}
Toda negociação de taxas e valores relacionados às cobranças da conta deve ser feita diretamente com o Banco Asaas, a plataforma não intermedia esse processo.
{% endhint %}

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-9ca624f1a33d546dc83669d50bf1bf1eafcb8bb1%2FCaptura%20de%20tela%202026-07-17%20104835.png?alt=media" alt=""><figcaption></figcaption></figure>

<figure><img src="https://1363129347-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FpZmCVMQSKLCGEaknWHwh%2Fuploads%2Fgit-blob-8f9e6808c18a1f1ca6e6574d22e87f9efc671c42%2FCaptura%20de%20tela%202026-07-17%20105116.png?alt=media" alt=""><figcaption></figcaption></figure>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://docs.flw.chat/guide/documentacao/apps/pagamentos/ativar-app-de-pagamento.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
