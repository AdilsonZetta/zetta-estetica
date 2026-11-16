[modelo: gemini-4-hydrogen / versão: gemini-4-hydrogen]
### 1. [MÉDIA] `src/catalog.tsx` — Vínculo à equipe oculto mantém UUID antigo no estado e bloqueia salvamento
- **Trecho:**
```tsx
<select
  value={resource.membership_id || ''}
  onChange={(e) =>
    setResource({ ...resource, membership_id: e.target.value || null })
  }
>
  <option value="">Sem vínculo de acesso</option>
  {teamOptions.map((m) => (
    <option key={m.id} value={m.id}>{m.name}</option>
  ))}
</select>
```
- **Problema:** Quando um profissional já vinculado tem o `membership_id` revogado, removido da unidade ou fora da lista retornada por `catalog_team_options`, o `<select>` não encontra `<option>` correspondente e exibe visualmente `"Sem vínculo de acesso"`, mas `resource.membership_id` continua com o UUID antigo no estado. Ao tentar salvar (inclusive para inativar o recurso), `save_catalog_resource` rejeita com `22023` (`Equipe sem escopo vigente na unidade`).
- **Correção sugerida:** Quando `resource.membership_id` não existir em `teamOptions`, renderizar uma `<option value={resource.membership_id}>Vínculo indisponível/revogado — remova ou substitua</option>` e/ou permitir que `save_catalog_resource` grave `active = false` mantendo o vínculo histórico sem revalidar escopo ativo se o vínculo não estiver sendo ativado/alterado.

### 2. [MÉDIA] `src/catalog.tsx` — Alterar o recurso durante a edição de janela causa erro `42501`
- **Trecho:**
```tsx
onClick={() => {
  const w = row as Window
  setWindowId(w.id)
  setWindowResource(w.resource_id)
  ...
}}
...
<select
  required
  value={windowResource}
  onChange={(e) => setWindowResource(e.target.value)}
>
  <option value="">Selecione</option>
  {resources.filter((r) => r.active).map(...)}
</select>
```
- **Problema:** Com `windowId` preenchido, o seletor de recurso permanece habilitado. Se o usuário trocar o recurso antes de enviar, `set_catalog_window` executa `delete ... where ... and w.resource_id=resource and w.id=window_id` e falha com `42501` (`Janela indisponível`). Além disso, se o recurso da janela estiver inativo, ele não aparece em `resources.filter((r) => r.active)`.
- **Correção sugerida:** Desabilitar o `<select>` de `Recurso da jornada` quando `windowId !== null`, incluir o recurso da janela em edição caso esteja inativo e limpar `windowId` ao trocar de aba ou remover a janela em edição.

### 3. [MÉDIA] `src/catalog.tsx` — Cálculo de `Fim local` em `Encontrar recursos livres` pode quebrar o componente ou falhar em DST
- **Trecho:**
```tsx
if (v && start)
  setEnd(
    new Date(
      Date.parse(start + 'Z') + v.duration_minutes * 60000,
    )
      .toISOString()
      .slice(0, 16),
  )
```
- **Problema:** (1) Se `start` estiver incompleto/inválido no momento da seleção, `Date.parse(start + 'Z')` retorna `NaN` e `.toISOString()` lança `RangeError`, derrubando a renderização React. (2) Alterar `Início local` posteriormente não recalcula `Fim local` para preservar a duração do serviço selecionado. (3) Em unidades cujo fuso IANA possua horário de verão, somar minutos no relógio local diverge da diferença real `b - a` em `timestamptz`, fazendo `catalog_availability` recusar a consulta com `22023`.
- **Correção sugerida:** Validar `Number.isFinite(...)` antes de formatar, sincronizar `end` também ao alterar `start` quando houver `selectedVersion` e converter usando o fuso IANA da unidade (`Intl.DateTimeFormat`) em vez de sufixo `'Z'`.

### 4. [MÉDIA] `supabase/migrations/202611140013_catalog.sql` — `capability` sem `btrim` em exigências e exclusão de recurso físico nominado sem exigência
- **Trecho:**
```sql
insert into private.catalog_requirements values(tenant,vid,j->>'kind',j->>'capability',(j->>'quantity')::integer);
...
or (r.kind<>'professional' and exists(select 1 from private.catalog_requirements q where q.tenant_id=tenant and q.version_id=catalog_availability.version_id and q.kind=r.kind and q.capability=any(r.capabilities) and ru.capacity>=q.quantity)
```
- **Problema:** `save_catalog_resource` aplica `btrim()` nas capacidades do recurso, enquanto `publish_catalog_service` grava `capability` sem `btrim()`; espaços acidentais na UI impedem o casamento `q.capability = any(r.capabilities)`. Além disso, se um serviço nominar uma sala ou equipamento sem cadastrar uma exigência em `catalog_requirements` para aquele `kind`, `catalog_availability` nunca retorna esse recurso nominado.
- **Correção sugerida:** Normalizar com `btrim(j->>'capability')` em `publish_catalog_service` (e adicionar `check(capability = btrim(capability))`), e ajustar `catalog_availability` (ou a publicação) para que recursos físicos nominados sem exigência genérica continuem elegíveis ou exijam a definição correspondente.

### 5. [MÉDIA] `supabase/migrations/202611140013_catalog.sql` — `catalog_team_options` oculta membros multiunidade mesmo quando elegíveis na unidade ativa
- **Trecho:**
```sql
and exists(select 1 from public.membership_units mu where mu.tenant_id=tenant and mu.membership_id=m.id and mu.unit_id=unit)
and not exists(select 1 from public.membership_units mu where mu.tenant_id=tenant and mu.membership_id=m.id and not private.is_allowed(tenant,mu.unit_id,'catalog.write'))
```
- **Problema:** O segundo filtro esconde qualquer membro da equipe que também esteja atribuído a outra unidade em que o operador atual não tenha `catalog.write`, impedindo vincular esse profissional apenas à unidade ativa — embora `save_catalog_resource` permita o vínculo se o recurso só atuar na unidade em que ambos têm escopo.
- **Correção sugerida:** Remover a exigência de o operador possuir `catalog.write` em todas as unidades do membro em `catalog_team_options`, mantendo a verificação apenas para a `unit` ativa (e deixando `save_catalog_resource` validar todas as unidades configuradas para o recurso).

### 6. [MÉDIA] `src/catalog.tsx` — Edição de serviço multiunidade não permite remover recurso indisponível de outra unidade
- **Trecho:**
```tsx
{resources
  .filter(
    (r) =>
      (r.eligible !== false && r.active) ||
      service.resources.some(
        (x) => x.unit_id === unit && x.resource_id === r.id,
      ),
  )
```
- **Problema:** A UI exibe apenas os recursos nominados da unidade ativa (`x.unit_id === unit`). Se um serviço atua em duas unidades e um recurso nominado na outra unidade for inativado ou perder vínculo, tentar publicar uma nova versão falha com `22023` (`Recurso sem habilitação vigente`) sem mostrar ao usuário qual vínculo precisa ser removido.
- **Correção sugerida:** Exibir os vínculos indisponíveis das demais unidades presentes em `service.resources` (ou oferecer ação para removê-los antes da publicação).

### 7. [BAIXA] `docs/etapas/prompt-06.md` — Placeholders literais deixados no relatório da etapa
- **Trecho:**
```markdown
| `npm run test:e2e -- --retries=1` (execução completa final) | RESULTADO_E2E_FINAL |
| Inspeção de capturas | Layout desktop conferido; testes desktop/mobile verificam ausência de overflow horizontal |
| Inspeção de arquivos alterados/novos e `dist` contra segredos privilegiados locais | RESULTADO_SEGREDOS |
| `git diff --check` | RESULTADO_DIFF |
```
- **Problema:** Os marcadores `RESULTADO_E2E_FINAL`, `RESULTADO_SEGREDOS` e `RESULTADO_DIFF` permaneceram sem preenchimento na documentação versionada.
- **Correção sugerida:** Executar as três verificações finais e registrar os resultados reais antes de finalizar a entrega.

### 8. [BAIXA] `src/catalog.tsx` — Chamada desnecessária de `catalog_team_options` para leitura e falta de cancelamento em `versions()`
- **Trecho:**
```tsx
void Promise.all([
  db.rpc('list_catalog', { tenant, unit, kind: tab, query: search }),
  db.rpc('check_access', { tenant, unit, permission: 'catalog.write' }),
  ...
  db.rpc('catalog_team_options', { tenant, unit }),
...
async function versions(s: Service, more = false) {
```
- **Problema:** Usuários com perfil somente leitura (`reception`, `professional`, `finance`, `auditor`) disparam `catalog_team_options` a cada carregamento/busca, gerando erro `42501` contínuo no console/rede. Além disso, `versions()` não controla concorrência entre cliques rápidos em serviços distintos nem bloqueia cliques repetidos em `"Mais versões"`.
- **Correção sugerida:** Chamar `catalog_team_options` apenas quando `check_access` retornar `true` (ou ao abrir a aba `resources`), e adicionar controle de requisição ativa/`busy` em `versions()`.

### 9. [BAIXA] `src/main.tsx` — Link `"Voltar à clínica"` omitido na rota `/clinicas/:slug/catalogo`
- **Trecho:**
```tsx
<Link to={`/clinicas/${slug}/catalogo`}>Catálogo</Link> · <Link to={`/clinicas/${slug}/clientes`}>Clientes</Link> · {clients && <><Link to={`/clinicas/${slug}`}>Voltar à clínica</Link> · </>}<Link to="/">Trocar clínica</Link>
```
- **Problema:** A rota de catálogo não exibe o link de retorno à página inicial da unidade, presente na rota de clientes.
- **Correção sugerida:** Alterar `{clients && ...}` para `{(clients || catalog) && ...}`.

### 10. [BAIXA] `supabase/migrations/202611140013_catalog.sql` — `reason := null` em `set_catalog_window` e `expected_version` ignorado na criação
- **Trecho:**
```sql
insert into private.catalog_windows(...,reason) values(...,reason)
...
if service is null then insert into private.catalog_services(tenant_id) values(tenant) returning id,current_version into sid,n;
```
- **Problema:** Passar `reason: null` explicitamente para `set_catalog_window` viola `NOT NULL` (`23502`) apesar do default `''`; e passar `expected_version` junto com `service := null` (ou `resource := null`) é ignorado em vez de sinalizar argumento inválido.
- **Correção sugerida:** Usar `coalesce(reason, '')` em `set_catalog_window` e validar `expected_version is null` quando `service is null` / `resource is null`.
