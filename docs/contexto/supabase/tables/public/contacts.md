# public.contacts

> Contatos cadastrados (empresas/parceiros) para integracao externa.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 1 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `owner_id` | `uuid` | não |  |  |  |
| 3 | `name` | `text` | não |  |  |  |
| 4 | `phone_e164` | `text` | não |  |  |  |
| 5 | `address` | `text` | sim |  |  |  |
| 6 | `kind` | `text` | não | `'both'::text` |  |  |
| 7 | `usage_count` | `integer` | não | `1` |  |  |
| 8 | `last_used_at` | `timestamp with time zone` | não | `now()` |  |  |
| 9 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 10 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| contacts_kind_check | CHECK | `CHECK (kind = ANY (ARRAY['sender'::text, 'recipient'::text, 'both'::text]))` |  |  | sim |
| contacts_owner_id_fkey | FOREIGN KEY | `FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| contacts_owner_phone_unique | UNIQUE | `UNIQUE (owner_id, phone_e164)` |  |  | sim |
| contacts_phone_e164_format | CHECK | `CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'::text)` |  |  | sim |
| contacts_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| contacts_owner_phone_unique | btree | owner_id, phone_e164 | sim | sim |  | `CREATE UNIQUE INDEX contacts_owner_phone_unique ON public.contacts USING btree (owner_id, phone_e164)` |
| contacts_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id)` |
| idx_contacts_name_trgm | gin | name | não | sim |  | `CREATE INDEX idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops)` |
| idx_contacts_owner_last_used | btree | owner_id, last_used_at | não | sim |  | `CREATE INDEX idx_contacts_owner_last_used ON public.contacts USING btree (owner_id, last_used_at DESC)` |
| idx_contacts_owner_name | btree | owner_id | não | sim |  | `CREATE INDEX idx_contacts_owner_name ON public.contacts USING btree (owner_id, lower(name))` |
| idx_contacts_phone_trgm | gin | phone_e164 | não | sim |  | `CREATE INDEX idx_contacts_phone_trgm ON public.contacts USING gin (phone_e164 gin_trgm_ops)` |


## Policies (RLS)

### `Users manage their own contacts`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(( SELECT auth.uid() AS uid) = owner_id)` |
| WITH CHECK | `(( SELECT auth.uid() AS uid) = owner_id)` |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_contacts_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
