-- Enable and define row-level security policies for tenant isolation

alter table tenants enable row level security;
alter table tenants force row level security;
alter table roles enable row level security;
alter table roles force row level security;
alter table users enable row level security;
alter table users force row level security;
alter table user_roles enable row level security;
alter table user_roles force row level security;
alter table role_permissions enable row level security;
alter table role_permissions force row level security;
alter table feature_flags enable row level security;
alter table feature_flags force row level security;
alter table api_keys enable row level security;
alter table api_keys force row level security;
alter table loans enable row level security;
alter table loans force row level security;
alter table borrowers enable row level security;
alter table borrowers force row level security;
alter table co_borrowers enable row level security;
alter table co_borrowers force row level security;
alter table documents enable row level security;
alter table documents force row level security;
alter table events enable row level security;
alter table events force row level security;
alter table access_audit enable row level security;
alter table access_audit force row level security;
alter table dr_drills enable row level security;
alter table dr_drills force row level security;

create or replace function app.tenant_isolation()
returns boolean
language plpgsql
stable
as $$
begin
  return app.current_tenant() is not null;
end;
$$;

create policy tenants_self on tenants
  using (id = app.current_tenant());

create policy roles_tenant_isolation on roles
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy users_tenant_isolation on users
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy user_roles_tenant_isolation on user_roles
  using (exists (select 1 from users u where u.id = user_roles.user_id and u.tenant_id = app.current_tenant()))
  with check (exists (select 1 from users u where u.id = user_roles.user_id and u.tenant_id = app.current_tenant()));

create policy role_permissions_tenant_isolation on role_permissions
  using (exists (select 1 from roles r where r.id = role_permissions.role_id and r.tenant_id = app.current_tenant()))
  with check (exists (select 1 from roles r where r.id = role_permissions.role_id and r.tenant_id = app.current_tenant()));

create policy feature_flags_tenant_isolation on feature_flags
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy api_keys_tenant_isolation on api_keys
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy loans_tenant_isolation on loans
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy loans_writer on loans for insert
  to role_admin, role_processor, role_underwriter
  with check (tenant_id = app.current_tenant());

create policy loans_updater on loans for update
  to role_admin, role_processor, role_underwriter
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy borrowers_tenant_isolation on borrowers
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy borrowers_writer on borrowers for insert
  to role_admin, role_processor, role_underwriter
  with check (tenant_id = app.current_tenant());

create policy borrowers_updater on borrowers for update
  to role_admin, role_processor, role_underwriter
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy co_borrowers_tenant_isolation on co_borrowers
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy documents_tenant_isolation on documents
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy events_tenant_isolation on events
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy access_audit_tenant_isolation on access_audit
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create policy dr_drills_tenant_isolation on dr_drills
  using (tenant_id = app.current_tenant())
  with check (tenant_id = app.current_tenant());

create or replace function app.updated_at_trigger()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := coalesce(old.version, 0) + 1;
  return new;
end;
$$;

create or replace function app.apply_updated_at_triggers()
returns void
language plpgsql
as $$
declare
  tbl text;
  tables text[] := array[
    'tenants','roles','users','feature_flags','api_keys',
    'loans','borrowers','co_borrowers','documents','events','dr_drills'
  ];
begin
  foreach tbl in array tables loop
    execute format('drop trigger if exists trg_%1$s_updated_at on %1$I', tbl);
    execute format('create trigger trg_%1$s_updated_at before update on %1$I for each row execute function app.updated_at_trigger()', tbl);
  end loop;
end;
$$;

select app.apply_updated_at_triggers();
