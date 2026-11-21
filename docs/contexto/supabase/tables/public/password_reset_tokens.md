# public.password_reset_tokens

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 4 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `user_id` | `uuid` | não |  |  |  |
| 3 | `token_hash` | `text` | não |  |  |  |
| 4 | `expires_at` | `timestamp with time zone` | não |  |  |  |
| 5 | `used_at` | `timestamp with time zone` | sim |  |  |  |
| 6 | `ip_address` | `inet` | sim |  |  |  |
| 7 | `created_at` | `timestamp with time zone` | sim | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| password_reset_tokens_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| password_reset_tokens_token_hash_key | UNIQUE | `UNIQUE (token_hash)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_password_reset_tokens_cleanup | btree | expires_at | não | sim | `(used_at IS NULL)` | `CREATE INDEX idx_password_reset_tokens_cleanup ON public.password_reset_tokens USING btree (expires_at) WHERE (used_at IS NULL)` |
| idx_password_reset_tokens_lookup | btree | token_hash, expires_at | não | sim | `(used_at IS NULL)` | `CREATE INDEX idx_password_reset_tokens_lookup ON public.password_reset_tokens USING btree (token_hash, expires_at) WHERE (used_at IS NULL)` |
| password_reset_tokens_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX password_reset_tokens_pkey ON public.password_reset_tokens USING btree (id)` |
| password_reset_tokens_token_hash_key | btree | token_hash | sim | sim |  | `CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON public.password_reset_tokens USING btree (token_hash)` |


## Policies (RLS)

### `Admins can delete reset tokens`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |

### `Authenticated can insert own reset tokens`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(auth.uid() = user_id)` |

### `Users can select own reset tokens`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(auth.uid() = user_id)` |
| WITH CHECK |  |

### `Users can view own reset tokens`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(auth.uid() = user_id)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_invalidate_old_tokens | AFTER | INSERT | ROW | enabled | public.invalidate_old_tokens |
| trg_set_token_expiration | BEFORE | INSERT | ROW | enabled | public.set_token_expiration |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
