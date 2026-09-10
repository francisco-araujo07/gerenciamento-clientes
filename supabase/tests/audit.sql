-- Somente banco de teste descartável com todas as migrações aplicadas.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/audit.sql (administrador).
-- Simula claims no PostgreSQL; não testa login HTTP. Tudo termina em rollback.
begin;
insert into public.leads(company_name) values ('Fixture auditoria') returning set_config('test.lead_id', id::text, true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
do $$
declare first_id uuid; second_id uuid;
begin
  if not exists (select 1 from public.leads where id = current_setting('test.lead_id')::uuid) then raise exception 'Equipe sem acesso'; end if;
  select id into first_id from public.convert_lead_to_client(current_setting('test.lead_id')::uuid);
  select id into second_id from public.convert_lead_to_client(current_setting('test.lead_id')::uuid);
  if first_id is distinct from second_id then raise exception 'Conversão não idempotente'; end if;
  if not exists (
    select 1
    from public.audit_log
    where table_name = 'clients'
      and row_id = first_id
      and operation = 'INSERT'
      and changed_by = '11111111-1111-4111-8111-111111111111'::uuid
  ) then raise exception 'Auditoria de criação do cliente ausente'; end if;
  if not exists (
    select 1
    from public.audit_log
    where table_name = 'leads'
      and row_id = current_setting('test.lead_id')::uuid
      and operation = 'UPDATE'
      and changed_by = '11111111-1111-4111-8111-111111111111'::uuid
      and old_data->>'status' = 'novo'
      and new_data->>'status' = 'convertido'
  ) then raise exception 'Auditoria de conversão do lead ausente'; end if;
  begin
    insert into public.leads(company_name) values (repeat('x', 201));
    raise exception 'Limite não aplicado';
  exception when check_violation then null;
  end;
end;
$$;
reset role;
-- Outro membro deve ter acesso: CRM compartilhado, não multiempresa.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.leads where id = current_setting('test.lead_id')::uuid) then raise exception 'Compartilhamento quebrado'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.leads where id = current_setting('test.lead_id')::uuid) then raise exception 'Sessão anônima consegue ler'; end if;
  begin
    insert into public.leads(company_name) values ('Não deve entrar');
    raise exception 'Sessão anônima consegue inserir';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin
    if exists (select 1 from public.leads where id = current_setting('test.lead_id')::uuid) then raise exception 'Visitante consegue ler'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;

-- Matriz de segurança: todas as tabelas, CRUD e permissões fora da RLS.
begin;
insert into public.leads(company_name) values ('Fixture matriz')
returning set_config('test.matrix_lead_id', id::text, true);
insert into public.clients(company_name) values ('Fixture matriz') returning set_config('test.client_id', id::text, true);
insert into public.projects(client_id, name, price)
values (current_setting('test.client_id')::uuid, 'Fixture matriz', 1)
returning set_config('test.project_id', id::text, true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
do $$
declare t text;
begin
  foreach t in array array['leads', 'clients', 'projects'] loop
    if has_table_privilege(current_user, 'public.' || t, 'TRUNCATE')
       or has_table_privilege(current_user, 'public.' || t, 'TRIGGER')
       or has_table_privilege(current_user, 'public.' || t, 'REFERENCES') then
      raise exception 'Privilégio excessivo em %', t;
    end if;
  end loop;
  if not has_table_privilege(current_user, 'public.audit_log', 'SELECT')
     or has_table_privilege(current_user, 'public.audit_log', 'INSERT')
     or has_table_privilege(current_user, 'public.audit_log', 'UPDATE')
     or has_table_privilege(current_user, 'public.audit_log', 'DELETE') then
    raise exception 'Privilégios inválidos na auditoria';
  end if;
  begin
    insert into public.leads(company_name, status) values ('Conversão indevida', 'convertido');
    raise exception using errcode = 'XX000', message = 'Conversão direta aceita';
  exception when raise_exception then null;
  end;
  begin
    insert into public.clients(company_name, google_maps_url) values ('URL indevida', 'javascript:alert(1)');
    raise exception 'URL insegura aceita';
  exception when check_violation then null;
  end;
  begin
    insert into public.projects(client_id, name, price) values (current_setting('test.client_id')::uuid, 'NaN', 'NaN');
    raise exception 'NaN aceito';
  exception when check_violation then null;
  end;
  begin
    insert into public.leads(company_name, email) values ('E-mail inválido', 'invalido');
    raise exception 'E-mail inválido aceito em leads';
  exception when check_violation then null;
  end;
  begin
    insert into public.clients(company_name, email) values ('E-mail inválido', 'invalido');
    raise exception 'E-mail inválido aceito em clients';
  exception when check_violation then null;
  end;
  update public.leads
    set notes = 'Alteração auditada'
    where id = current_setting('test.matrix_lead_id')::uuid;
  delete from public.projects
    where id = current_setting('test.project_id')::uuid;
  if not exists (
    select 1
    from public.audit_log
    where table_name = 'leads'
      and row_id = current_setting('test.matrix_lead_id')::uuid
      and operation = 'UPDATE'
      and changed_by = '11111111-1111-4111-8111-111111111111'::uuid
  ) then raise exception 'Auditoria de atualização ausente'; end if;
  if not exists (
    select 1
    from public.audit_log
    where table_name = 'projects'
      and row_id = current_setting('test.project_id')::uuid
      and operation = 'DELETE'
      and changed_by = '11111111-1111-4111-8111-111111111111'::uuid
  ) then raise exception 'Auditoria de exclusão ausente'; end if;
end $$;
do $$
declare v_id uuid;
begin
  insert into public.leads(company_name, status)
  values ('Trigger update', 'negociacao')
  returning id into v_id;
  begin
    update public.leads set status = 'convertido' where id = v_id;
    raise exception 'UPDATE para convertido sem cliente deveria falhar';
  exception when raise_exception then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
do $$
declare t text; n bigint;
begin
  foreach t in array array['leads', 'clients', 'projects'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then raise exception 'Leitura anônima em %', t; end if;
    execute format('update public.%I set updated_at = now()', t);
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'Edição anônima em %', t; end if;
    execute format('delete from public.%I', t);
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'Exclusão anônima em %', t; end if;
    begin
      if t = 'projects' then
        insert into public.projects(client_id, name, price) values (current_setting('test.client_id')::uuid, 'Invasão', 1);
      else
        execute format('insert into public.%I(company_name) values (%L)', t, 'Invasão');
      end if;
      raise exception 'Inserção anônima em %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
  if exists(select 1 from public.audit_log) then
    raise exception 'Visitante consegue ler auditoria';
  end if;
end $$;
reset role;
-- Role authenticated sem identidade também não pode ler dados.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.leads) or exists(select 1 from public.clients) or exists(select 1 from public.projects) then
    raise exception 'Sessão sem identidade acessa dados';
  end if;
end $$;
reset role;
do $$
declare t text; p text;
begin
  foreach t in array array['leads', 'clients', 'projects', 'audit_log'] loop
    foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if has_table_privilege('anon', 'public.' || t, p) then raise exception 'Visitante tem % em %', p, t; end if;
    end loop;
  end loop;
  if has_function_privilege('anon', 'public.convert_lead_to_client(uuid)', 'EXECUTE') then raise exception 'RPC exposto a visitante'; end if;
end $$;
rollback;
