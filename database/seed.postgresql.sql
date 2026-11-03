-- LOCAGEST initial PostgreSQL data: first administrator account.
-- Replace all three placeholder values before running this file in Supabase.
-- The password is plaintext in this SQL statement; do not save or share the
-- edited copy. For a safer alternative, use `npm run db:seed:admin` with .env.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

DO $seed$
DECLARE
  v_name text := 'leonardo';
  v_email text := 'leonardosanchezsilva500@gmail.com';
  v_password text := 'leo12345789';
  v_admin_role text;
  v_user_id integer;
BEGIN
  PERFORM pg_advisory_xact_lock(732918406);

  IF v_name LIKE 'REPLACE_WITH_%'
    OR v_email LIKE 'REPLACE_WITH_%'
    OR v_password LIKE 'REPLACE_WITH_%' THEN
    RAISE EXCEPTION 'Replace the administrator name, email, and password placeholders before running this seed.';
  END IF;

  v_name := btrim(v_name);
  v_email := lower(btrim(v_email));

  IF v_name = '' OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Administrator name must contain 1 to 100 characters.';
  END IF;
  IF length(v_email) > 100 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Administrator email must be valid and contain at most 100 characters.';
  END IF;
  IF length(btrim(v_password)) < 8 OR octet_length(convert_to(v_password, 'UTF8')) > 72 THEN
    RAISE EXCEPTION 'Administrator password must contain at least 8 characters and at most 72 UTF-8 bytes.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.usuario) THEN
    RAISE EXCEPTION 'Initial administrator seed only runs when public.usuario is empty.';
  END IF;

  SELECT cargo
    INTO v_admin_role
    FROM public.funcionario_perfis_permissoes
   WHERE lower(cargo) = lower('Administrador')
   FOR UPDATE;

  IF FOUND THEN
    UPDATE public.funcionario_perfis_permissoes
       SET dashboard = 1,
           clientes = 1,
           produtos = 1,
           pedidos = 1,
           relatorios = 1,
           funcionarios = 1,
           entregas = 1,
           retiradas = 1,
           pagamentos = 1,
           estoque = 1,
           fornecedor = 1,
           cadastro_admin = 1,
           updated_by = NULL,
           updated_at = CURRENT_TIMESTAMP
     WHERE cargo = v_admin_role;
    DELETE FROM public.funcionario_perfil_acoes
     WHERE cargo = v_admin_role;
  ELSE
    v_admin_role := 'Administrador';
    INSERT INTO public.funcionario_perfis_permissoes
      (cargo, dashboard, clientes, produtos, pedidos, relatorios, funcionarios,
       entregas, retiradas, pagamentos, estoque, fornecedor, cadastro_admin, updated_by)
    VALUES
      (v_admin_role, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, NULL);
  END IF;

  INSERT INTO public.funcionario_perfil_acoes (cargo, module_key, action_key)
  SELECT v_admin_role, modules.module_key, actions.action_key
    FROM (VALUES
      ('dashboard'), ('clientes'), ('produtos'), ('pedidos'), ('relatorios'),
      ('funcionarios'), ('entregas'), ('retiradas'), ('pagamentos'), ('estoque'),
      ('fornecedor'), ('cadastro_admin')
    ) AS modules(module_key)
   CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('remove')) AS actions(action_key);

  INSERT INTO public.usuario (nome, email, senha, cargo, ativo, login_habilitado)
  VALUES (
    v_name,
    v_email,
    crypt(v_password, gen_salt('bf', 10)),
    v_admin_role,
    1,
    1
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.user_permissions
    (usuario_id, dashboard, clientes, produtos, pedidos, relatorios, funcionarios,
     entregas, retiradas, pagamentos, estoque, fornecedor, cadastro_admin)
  VALUES
    (v_user_id, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

  INSERT INTO public.user_permission_actions (usuario_id, module_key, action_key)
  SELECT v_user_id, modules.module_key, actions.action_key
    FROM (VALUES
      ('dashboard'), ('clientes'), ('produtos'), ('pedidos'), ('relatorios'),
      ('funcionarios'), ('entregas'), ('retiradas'), ('pagamentos'), ('estoque'),
      ('fornecedor'), ('cadastro_admin')
    ) AS modules(module_key)
   CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('remove')) AS actions(action_key);
END;
$seed$;

COMMIT;
