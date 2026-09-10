-- SOMENTE PostgreSQL descartável de testes; nunca executar no Supabase real.
-- Simula claims, não o serviço de autenticação HTTP.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as
  $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select (auth.jwt()->>'sub')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
