# ADR 001: Arquitetura de Segurança RLS-First

## Status
Proposto

## Contexto
O sistema lida com dados sensíveis de logística, incluindo PII (Personally Identifiable Information) de motoristas e clientes. A segurança deve ser garantida no nível do banco de dados para evitar vazamentos caso o cliente front-end seja comprometido.

## Decisão
Adotamos uma abordagem **RLS-First** (Row Level Security) no Supabase.
1. Todas as tabelas DEVEM ter RLS habilitado.
2. O acesso deve ser bloqueado por padrão (`FOR ALL USING (false)`).
3. As políticas devem ser granulares por Role (`admin`, `manager`, `operator`, `viewer`).
4. Funções sensíveis devem usar `SECURITY DEFINER` com cautela, garantindo validações internas de autorização.

## Consequências
- Maior complexidade na escrita de migrations.
- Garantia de que bugs no front-end não permitem acesso não autorizado a dados de outros usuários ou roles.
- Facilidade de auditoria de segurança via `pg_policies`.
