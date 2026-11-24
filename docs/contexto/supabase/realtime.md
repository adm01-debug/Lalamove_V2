# Realtime

## Publications

| publication | all tables | insert | update | delete | truncate |
|---|---|---|---|---|---|
| supabase_realtime | não | sim | sim | sim | sim |
| supabase_realtime_messages_publication | não | sim | sim | sim | sim |

## Tabelas publicadas (Postgres Changes)

| publication | tabela | replica identity |
|---|---|---|
| supabase_realtime | public.auth_logs | full |
| supabase_realtime | public.blocked_ips | full |
| supabase_realtime | public.lalamove_order_replacements | full |
| supabase_realtime | public.lalamove_stop_proofs | full |
| supabase_realtime | public.mfa_sessions | full |
| supabase_realtime | public.new_device_alerts | full |
| supabase_realtime | public.report_presets | full |
| supabase_realtime_messages_publication | realtime.messages_2026_11_21 |  |
| supabase_realtime_messages_publication | realtime.messages_2026_11_22 |  |
| supabase_realtime_messages_publication | realtime.messages_2026_11_23 |  |
| supabase_realtime_messages_publication | realtime.messages_2026_11_24 |  |
| supabase_realtime_messages_publication | realtime.messages_2026_11_25 |  |
| supabase_realtime_messages_publication | realtime.messages_2026_11_26 |  |
| supabase_realtime_messages_publication | realtime.messages_2026_11_27 |  |

## Broadcast / Presence (policies em realtime.messages)

_nenhum_
