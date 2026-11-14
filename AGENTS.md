# Convenções persistentes

- Leia `docs/ambiente-de-execucao.md`, README e o relatório da etapa anterior. Não faça commit/push. Preserve alterações existentes.
- React 19, TypeScript, Vite, Tailwind 4 e Supabase. UI/documentação em pt-BR; seguir design monocromático com lima e vidro do ambiente.
- Autoridade no PostgreSQL: tenant obrigatório, referências compostas, vínculo vigente, unidade, permissão e módulo. Slug e metadados Auth não autorizam. Papéis globais privados não concedem acesso operacional.
- Migrations aditivas em `supabase/migrations`; funções Edge versionadas em `supabase/functions`. SECURITY DEFINER com `search_path=''`, nomes qualificados, autorização no corpo e EXECUTE mínimo. Não publicar schema privado. Grants por coluna ou RPC para autoridade.
- Navegador somente chave pública e sessão. Nunca versionar segredos. Operações remotas exigem confirmar projeto. FLW não comprovada permanece simulada/manual.
- Stack local existente sem Docker; não duplicar servidores. `npm run db:reset` destrói exclusivamente o banco local de desenvolvimento. Testes API usam sessões de usuário; service role apenas prepara fixtures.
- Execute build, lint e testes anteriores; pgTAP/API/Storage e concorrência conforme etapa. E2E completo somente ao final. Documente resultados reais e bloqueios em `docs/etapas/prompt-NN.md`.
