#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ "$(id -u)" = 0 ]; then
    echo "Uruchom przygotowanie jako zwykły użytkownik, bez sudo." >&2
    exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
    echo "Zainstaluj Docker z wtyczką Compose zgodnie z README.md." >&2
    exit 1
fi
if ! docker info >/dev/null 2>&1; then
    echo "Uruchom Docker i sprawdź, czy masz do niego dostęp bez sudo." >&2
    exit 1
fi

umask 077
mkdir -p database .runtime/tmp .runtime/cache
for directory in database .runtime/tmp .runtime/cache; do
    if [ ! -r "$directory" ] || [ ! -w "$directory" ] || [ ! -x "$directory" ]; then
        echo "Brak dostępu do folderu $directory. Sprawdź jego właściciela i uprawnienia." >&2
        exit 1
    fi
done
if [ ! -f .env ]; then
    cp .env.example .env
fi

temporary=$(mktemp .env.prepare.XXXXXX)
trap 'rm -f "$temporary"' EXIT
awk -v user_id="$(id -u)" -v group_id="$(id -g)" '
    /^[[:space:]]*GLOVEBOX_UID=/ { print "GLOVEBOX_UID=" user_id; user_set = 1; next }
    /^[[:space:]]*GLOVEBOX_GID=/ { print "GLOVEBOX_GID=" group_id; group_set = 1; next }
    { print }
    END {
        if (!user_set) print "GLOVEBOX_UID=" user_id
        if (!group_set) print "GLOVEBOX_GID=" group_id
    }
' .env > "$temporary"
mv "$temporary" .env

docker compose config --quiet
echo "Gotowe. Uruchom: docker compose up -d --build"
