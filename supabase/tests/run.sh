#!/usr/bin/env bash
# Harness de validacao SQL para o trigger geo_evaluate_tracking.
#
# Nao existe job de CI que suba Postgres (ci.yml so roda Deno/Vitest/node --test),
# entao este script e a unica forma de exercitar o trigger sem tocar producao.
# Sobe um postgres:16-alpine descartavel, carrega stubs + funcoes REAIS extraidas
# das migrations + a fixture de trajeto, e roda supabase/tests/02_scenarios.sql.
#
# Uso:  bash supabase/tests/run.sh
# Requer: docker
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MIG="$REPO/supabase/migrations"
CONT="pg_lalamove_validate_$$"
PORT="${PG_TEST_PORT:-55433}"

cleanup() { docker rm -f "$CONT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# --- 1. regenera 01_functions.sql a partir das migrations ------------------
# Copia os blocos literais para garantir que o teste exercita o codigo real, e
# nao uma parafrase que pode divergir.
python3 - "$MIG" "$HERE" <<'PY'
import sys, pathlib
mig, here = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])

def block(path, name):
    """Do 'CREATE OR REPLACE FUNCTION public.<name>' ate o terminador '$$;'."""
    lines = (mig / path).read_text(encoding='utf-8').split('\n')
    marker = 'CREATE OR REPLACE FUNCTION public.' + name + '('
    start = next(i for i, l in enumerate(lines) if l.startswith(marker))
    out = []
    for l in lines[start:]:
        out.append(l)
        if l.rstrip().endswith('$$;'):
            break
    return '\n'.join(out)

FOUNDATION = '20261122130100_geo_foundation.sql'
JOBQUEUE = '20261122120200_job_queue_system.sql'
ETA = '20261122131000_geo_eta_delay.sql'

parts = ['-- GERADO por supabase/tests/run.sh — nao editar a mao.',
         '-- Funcoes reais copiadas das migrations, sem alteracao de logica.', '']
for fn, src in [('geo_haversine_m', FOUNDATION),
                ('geo_point_to_segment_m', FOUNDATION),
                ('geo_point_to_polyline_m', FOUNDATION),
                ('geo_emit_event', FOUNDATION),
                ('add_job', JOBQUEUE),
                ('geo_evaluate_tracking', ETA)]:
    parts += [f'-- {fn} <- {src}', block(src, fn), '']
(here / '01_functions.sql').write_text('\n'.join(parts) + '\n', encoding='utf-8')
print('01_functions.sql regenerado a partir das migrations')
PY

# --- 2. carrega a fixture num formato consultavel ---------------------------
python3 - "$HERE" <<'PY'
import sys, json, pathlib
here = pathlib.Path(sys.argv[1])
f = json.loads((here / 'fixtures' / 'route_curitiba.json').read_text(encoding='utf-8'))
# O fixture e compartilhado com o replay do job-worker
# (supabase/functions/job-worker/route-fixture-replay.test.ts), que le `points`.
# Aceita os dois formatos para nao quebrar quando um lado evolui.
pts = f.get('route') or f.get('points')
assert pts and len(pts) == 40, f"fixture deve ter 40 pontos, tem {len(pts or [])}"
rota = json.dumps([{'lat': p['lat'], 'lng': p['lng']} for p in pts], ensure_ascii=False)
sql = (
    'CREATE TABLE IF NOT EXISTS public.fixture_route_curitiba (rota jsonb NOT NULL);\n'
    f"INSERT INTO public.fixture_route_curitiba (rota) VALUES ('{rota}'::jsonb);\n"
)
(here / '03_fixture.sql').write_text(sql, encoding='utf-8')
print(f"03_fixture.sql gerado a partir de fixtures/route_curitiba.json ({len(pts)} pontos)")
PY

# --- 3. sobe o Postgres descartavel ---------------------------------------
echo "subindo $CONT (postgres:16-alpine na porta $PORT)..."
docker run -d --rm --name "$CONT" -e POSTGRES_PASSWORD=x -p "$PORT:5432" postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  if docker exec "$CONT" pg_isready -U postgres -q 2>/dev/null; then break; fi
  sleep 1
done
docker exec "$CONT" pg_isready -U postgres -q || { echo "Postgres nao subiu"; exit 1; }

# --- 4. roda stubs -> funcoes -> fixture -> cenarios ----------------------
for f in 00_stubs.sql 01_functions.sql 03_fixture.sql 02_scenarios.sql; do
  echo "--- $f"
  docker exec -i "$CONT" psql -U postgres -q -v ON_ERROR_STOP=1 -f - < "$HERE/$f"
done

echo "OK — harness completo"