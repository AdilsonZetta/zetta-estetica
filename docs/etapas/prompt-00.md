# Prompt 00 — Discovery FLW e prova de abertura

Etapa local concluída e revisada em 14/11/2026. Homologação externa pendente, sem declarar integração FLW habilitada. Não foi feito commit nem push.

## Entregas

- [Discovery FLW](../flw-discovery.md): inspeção, estrutura mínima da fundação, matriz por operação separando interface/API, fontes oficiais, responsáveis propostos, alternativas manuais, roteiro humano e critérios do Prompt 01.
- Laboratório Vite/TypeScript em `integration-lab/`, raiz reaproveitável e HTML dedicado à rota estática, com duas clínicas em `fixtures/simulacao/`, todas marcadas `simulated: true`.
- Supabase Auth independente com chave pública, checagem inicial de identidade no servidor, refresh, logout local em falha remota e estados de configuração/erro. Slug não concede autorização; vínculos e RLS pertencem à fundação e ao Prompt 03.
- Configuração de retorno aprovada pelo ambiente, sem aceitar tokens/SSO/destinos da query. Capacidade FLW explicitamente simulada com `CAPABILITY_NOT_VERIFIED`.
- `.env.example`, scripts npm, testes unitários/API/E2E, configuração Playwright portátil e workflow manual de Pages. Alterações preexistentes preservadas.

## Validação executada nesta revisão

| Comando/verificação | Resultado |
| --- | --- |
| `npm run build` | Passou: TypeScript e Vite; `dist/index.html`, `dist/integration-lab/index.html`, assets e `dist/404.html` |
| `npm run lint` | Passou, sem warnings do lint |
| `npm test` | 7 testes unitários passaram |
| `npm run test:api` | 7 resultados passaram (1 teste principal + 6 subtestes), GoTrue local real |
| `npm run test:e2e` | 24 testes passaram: 7 desktop + 7 Pixel 7 Chromium emulado em preview estático, 5 desktop + 5 mobile emulado com Auth local |
| `LOCAL_STACK_ENV_FILE=/tmp/zetta-stack-inexistente.env npx playwright test --project=desktop --project=mobile-chromium` | 14 testes passaram, sem ler o cofre nem registrar servidor/projetos Auth |
| Parser de ambiente com arquivo temporário sintético CRLF, espaços e aspas | Passou: URL e demais valores normalizados; arquivo removido |
| Reprodução do preview com apenas index/ e assets, sem HTML dedicado da rota | HTTP 200 pelo fallback SPA; o 404 alegado no preview não se reproduziu |
| `git diff --check` | Passou |

A suíte API cobre duas identidades sintéticas distintas, consulta de usuário no servidor, senha inválida, JWT expirado, refresh e revogação do refresh de A preservando B. A suíte E2E cobre configuração ausente, troca de clínica e reload, destino desconhecido, ausência de requisição FLW, nova aba sem opener, retorno, descarte de parâmetros indevidos, layout/foco/movimento reduzido e ciclo Auth. As regressões novas verificam HTTP 200 na rota e no reload após troca desde a raiz, falha remota de logout sem sessão persistida, rejeição da identidade pelo servidor e submit durante a verificação sem navegação.

Não existem ainda suítes SQL/RLS, Storage ou concorrência nesta etapa: não há migrations/aplicação de fundação para testar. Não são apresentadas como aprovadas. Screenshots herdados ilustram a execução anterior, sem provar homologação FLW ou esta revisão.

## Dependências e pendências

O backend dos testes é a stack local de [ambiente-de-execucao.md](../ambiente-de-execucao.md), sem credenciais versionadas. Testes API e projetos Auth exigem essa stack. Sem o arquivo local, somente os projetos independentes são registrados; solicitar um projeto Auth ausente falha por projeto inexistente.

Não há contas/credenciais FLW autorizadas, Supabase hospedado nem URL externa autorizada disponível. Pages permanece indisponível conforme o registro herdado de HTTP 422 em repositório privado; não houve tentativa de publicar, mudar plano ou tornar o repositório público. Destino pelo ícone, aba/iframe, retorno real, login/logout, expiração e mobile nas duas contas estão explicitamente pendentes. O [roteiro humano do Discovery](../flw-discovery.md#roteiro-humano-de-homologação) define execução e evidência exigidas. Os testes locais de duas identidades não substituem duas contas FLW; Pixel 7 emulado não substitui Android/iOS reais.

## Revisão Gemini

Revisor informado: gemini-4-hydrogen / gemini-4-hydrogen. Cada apontamento foi confrontado com a árvore atual, a especificação e o SDK instalado.

1. **Corrigido — Discovery ausente.** Criado `docs/flw-discovery.md` com todos os entregáveis documentais do Prompt 00. A ausência era real e estava reconhecida no documento do ambiente; a afirmação de que o diff continha apenas esse documento desconsiderava arquivos não rastreados já existentes. Isso não elimina a falta do relatório.
2. **Corrigido — pendência externa sem relatório final.** Registradas indisponibilidade da URL autorizada, ausência das duas contas/credenciais FLW, hipóteses por cenário, responsáveis propostos e roteiro humano. Usada a alternativa expressamente permitida pelo Prompt 00. O acionamento manual do workflow não é um defeito a corrigir enquanto Pages estiver indisponível; habilitar push não resolveria o plano nem provaria a abertura FLW.
3. **Corrigido — entrypoint estático da rota; descartada a alegação de 404 no preview.** Criado `integration-lab/index.html` e configuradas duas entradas Vite. A rota agora tem arquivo físico para hospedagem estática e os E2E verificam HTTP 200 no preview e no reload após troca pela raiz. Reprodução isolada com apenas o index raiz retornou HTTP 200 no preview por fallback SPA, portanto essa parte do diagnóstico era falsa. Pages pode usar índice de diretório/redirecionamento; seu HTTP efetivo e o iframe continuam pendentes de homologação externa.
4. **Corrigido — inicialização assíncrona depois dos listeners e checagem no servidor.** Removido o await de nível superior; handlers ficam registrados antes de `initializeAuth()`. Sessão persistida é conferida com `getUser()` antes de aceitar a restauração inicial. Teste segura a resposta do servidor, dispara submit e rejeita a identidade. **Descartada como garantia geral** a ideia de que `getUser()` prova toda revogação: autenticar a identidade não substitui verificar vínculo ativo no banco, nem invalida imediatamente qualquer JWT ainda válido. O formulário original estava desabilitado durante a espera, reduzindo o risco de submit normal; o registro imediato ainda corrige a ordem e torna o comportamento robusto.
5. **Corrigido — falha remota deve permitir logout local.** Em erro do logout global, executar `signOut({ scope: 'local' })`, limpar o estado e avisar que a revogação remota não foi confirmada. No SDK instalado o escopo local remove a sessão persistida antes da chamada remota; teste com resposta 400 confirma limpeza e reload sem sessão. **Descartada a generalização** de que sessão já revogada sempre bloquearia saída/novo login: o SDK já tolera 401/403/404 e novo login não é intrinsecamente bloqueado pelo armazenamento. A retenção em outros erros remotos era real.
6. **Corrigido — Playwright dependia incondicionalmente do cofre.** Carregar `localConfig()` e registrar servidor/projetos Auth apenas quando o arquivo configurado existir. Os projetos desktop e mobile independentes usam build/preview sem backend. Execução real com caminho inexistente passou nos 14 testes; não apenas listagem de configuração.
7. **Corrigido — CRLF no parser.** Usar `split(/\r?\n/)` e trim antes da remoção de aspas. Verificação com arquivo temporário sintético confirmou URL, espaços e valores entre aspas, sem expor o cofre.
8. **Corrigido — fallback entre chaves públicas.** Aplicar trim individual à publishable e à anon antes do operador `||`, permitindo fallback quando publishable contém somente espaços. A validação de chave pública permanece ativa.
