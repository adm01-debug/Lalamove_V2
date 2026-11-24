#!/usr/bin/env bash
# Executa o coletor UAPI do Lalamove com as variaveis de ambiente necessarias.
#
# O arquivo de ambiente fica FORA do repositorio (contem a service key do
# Supabase) e nao e versionado:
#   ~/.config/lalamove/uapi-collector.env
#
# Agendamento no Windows (WSL): schtasks chamando
#   wsl -d Ubuntu-24.04 -- bash -lc "bash <este script>"
set -euo pipefail

ENV_FILE="${UAPI_COLLECTOR_ENV:-$HOME/.config/lalamove/uapi-collector.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE nao existe (veja o cabecalho deste script)" >&2
  exit 2
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/collect.mjs"