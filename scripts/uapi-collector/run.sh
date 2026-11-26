#!/usr/bin/env bash
# Executa o coletor UAPI do Lalamove com as variaveis de ambiente necessarias.
#
# O arquivo de ambiente fica FORA do repositorio (contem a service key do
# Supabase) e nao e versionado:
#   ~/.config/lalamove/uapi-collector.env
#
# Agendamento no Windows (WSL): schtasks chamando
#   wsl -d Ubuntu-24.04 -- bash -lc "bash <este script>"
#
# FONTE UNICA: este diretorio nao guarda uma copia editavel do coletor. A cada
# execucao o `scripts/uapi-collector/collect.mjs` da `main` e materializado em
# `$DIR/collect.mjs` e executado. Antes de 26/11/2026 a copia era mantida a mao
# e ficou para tras: correcoes mergeadas nao chegavam a producao. Se o git
# falhar, a ultima copia boa continua sendo usada (o coletor nunca deixa de
# rodar por causa de rede).
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
REPO_URL="${UAPI_COLLECTOR_REPO_URL:-https://github.com/adm01-debug/Lalamove_V2.git}"
REPO_DIR="${UAPI_COLLECTOR_REPO:-$DIR/repo}"
LOCAL_FILE="$DIR/collect.mjs"
SYNC_FILE="$DIR/collect.mjs.sync.mjs"

# Busca so o topo da main (barato) e grava o arquivo de forma atomica.
# Cada passo checa a falha com `|| return 1`: o `set -e` NAO vale aqui, porque a
# funcao e chamada dentro de um `if` (bash suspende o errexit nesse contexto).
sync_from_main() {
  if [ ! -d "$REPO_DIR/.git" ]; then
    mkdir -p "$REPO_DIR" || return 1
    git -C "$REPO_DIR" init --quiet || return 1
    git -C "$REPO_DIR" remote add origin "$REPO_URL" || return 1
  fi

  git -C "$REPO_DIR" fetch --quiet --depth=1 origin main || return 1
  git -C "$REPO_DIR" show origin/main:scripts/uapi-collector/collect.mjs > "$SYNC_FILE" || return 1
  [ -s "$SYNC_FILE" ] || return 1
  # main quebrada nao pode derrubar a coleta: valida antes de promover.
  # (a extensao .mjs e obrigatoria: o node decide o formato do arquivo por ela)
  node --check "$SYNC_FILE" > /dev/null 2>&1 || return 1
  mv "$SYNC_FILE" "$LOCAL_FILE" || return 1
  echo "collect.mjs sincronizado da main ($(git -C "$REPO_DIR" rev-parse --short origin/main 2>/dev/null))"
}

if ! sync_from_main; then
  rm -f "$SYNC_FILE"
  if [ -f "$LOCAL_FILE" ]; then
    echo "AVISO: falha ao sincronizar collect.mjs da main; usando a ultima copia boa" >&2
  else
    echo "ERRO: sem copia local de collect.mjs e sem acesso a main" >&2
    exit 3
  fi
fi

exec node "$LOCAL_FILE"