# <img src="src/app/icon.svg" width="40" height="40" alt="" /> Glovebox 1.0

Twój cyfrowy schowek na instrukcje samochodowe. Dodajesz własne pliki PDF,
a Glovebox zamienia je w wygodny przewodnik po Twoim aucie — z wyszukiwaniem,
notatkami i przypomnieniami.

- 📖 **Instrukcje wszystkich marek** — import PDF, czytelny spis treści i ilustracje.
- 🔎 **Wyszukiwarka i Niezbędnik** — szybki dostęp do ważnych fragmentów instrukcji.
- 🖍️ **Zaznaczenia i komentarze** — wyróżnij fragment i dopisz własne uwagi.
- 📝 **Notatnik i zakładki** — zapisz informacje i wróć do miejsca czytania.
- 🚗 **Wyposażenie auta** — dopasuj widoczne opisy do swojej wersji i silnika.
- ⏰ **Przypomnienia** — terminy badania technicznego, ubezpieczenia i własnych zdarzeń.
- 📴 **Czytanie offline** — otwarte instrukcje są dostępne także bez połączenia.

Bez kont i analityki. Instrukcje zapisują się na komputerze, a notatki
i ustawienia — w przeglądarce.

## Instalacja od zera

Potrzebujesz **Git oraz działającego Dockera z Compose**:

- Linux: [instalacja Docker Engine](https://docs.docker.com/engine/install/)
  z wtyczkami Buildx i Compose; zapewnij swojemu użytkownikowi
  [dostęp do Dockera](https://docs.docker.com/engine/install/linux-postinstall/).
- macOS: [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/).

W terminalu, jako zwykły użytkownik (bez `sudo`):

```bash
git clone https://github.com/Quanosek/glovebox.git
cd glovebox
sh scripts/prepare-docker.sh
docker compose up -d --build
```

Przygotowanie tworzy potrzebne foldery oraz `.env` i automatycznie ustawia
uprawnienia użytkownika kontenera. Docker instaluje Node.js 24, pnpm 11, Python i wszystkie
zależności wewnątrz obrazu — nie musisz instalować ich na komputerze.
Pierwszy build wymaga internetu i może potrwać kilka minut.

Otwórz **http://localhost:3000**. Jeśli aplikacja jeszcze się uruchamia,
odczekaj chwilę i odśwież stronę.
Domyślnie port jest dostępny tylko na komputerze, na którym działa aplikacja.

### Zmiana portu

W `.env` zmień tylko:

```dotenv
GLOVEBOX_PORT=8080
```

Uruchom ponownie `docker compose up -d` i otwórz **http://localhost:8080**.
To zmienia wyłącznie port udostępniany przez Dockera. Wewnątrz kontenera
oraz przy lokalnym `pnpm dev` aplikacja nadal używa portu 3000.
Zmiana adresu lub portu oznacza dla przeglądarki osobny profil — wcześniej
pobierz kopię notatek w Ustawieniach, a potem wczytaj ją pod nowym adresem.

## Pierwsze auto

1. Otwórz **„Dodaj auto”**.
2. Wybierz markę, model i rok albo wpisz je ręcznie.
3. Dodaj instrukcje PDF i poczekaj na ich odczytanie.
4. Zaznacz wyposażenie swojego auta lub pomiń ten krok.

Katalog marek i modeli przygotowuje się przy pierwszym użyciu. Pliki PDF
są usuwane po imporcie, także po błędzie. Na słabszym komputerze dodawaj
mniejsze instrukcje pojedynczo.

Po otwarciu auta aplikacja zapisuje jego instrukcje do czytania bez połączenia.
Zaznaczenia, komentarze, zakładki, notatnik i ustawienia zapisują się
w przeglądarce. Ich kopię pobierzesz w **Ustawieniach**.

## Aktualizacja i zatrzymanie

W folderze projektu, gdy nie trwa dodawanie auta:

```bash
# Aktualizacja
git pull
docker compose up -d --build

# Zatrzymanie
docker compose down

# Ponowne uruchomienie
docker compose up -d
```

Instrukcje i notatki nie znikają przy aktualizacji ani zatrzymaniu.
Jeśli aplikacja nie startuje, sprawdź `docker compose logs --tail=50`.

## Gdzie są dane i jak przenieść aplikację

```text
glovebox/
├── compose.yaml   konfiguracja uruchomienia
├── Dockerfile     sposób budowania obrazu
├── .env           port i automatycznie ustawiony użytkownik
├── database/      instrukcje, katalog aut i logotypy
└── .runtime/      pliki tymczasowe i pamięć podręczna
```

Zatrzymaj aplikację, skopiuj cały folder na nowy komputer, uruchom tam
`sh scripts/prepare-docker.sh`, a następnie `docker compose up -d --build`.
Przygotowanie zachowa wybrany port i dostosuje użytkownika kontenera.
Kopiuj folder razem z plikami ukrytymi; nowy użytkownik musi mieć do niego
dostęp. Notatki przenoś osobno przez kopię z Ustawień.

**Folder zawiera wszystkie trwałe dane aplikacji, ale nie magazyn Dockera.**
Obrazy, warstwy i cache builda Docker przechowuje systemowo; Compose nie może
zamknąć ich w folderze projektu.

Przed całkowitym usunięciem, w folderze projektu wykonaj:

```bash
docker compose down --rmi local
```

To usuwa kontener, jego logi, sieć i obraz aplikacji. Potem możesz usunąć folder
`glovebox/` — razem z instrukcjami. Dane przeglądarki usuń osobno w Ustawieniach.
Docker może zachować współdzielone obrazy bazowe i cache builda; nie czyścimy
ich automatycznie, aby nie ingerować w inne aplikacje.

## Uruchomienie bez Dockera

Dla osób rozwijających projekt rekomendujemy **Node.js 24** i **pnpm 11** —
tych wersji używają również Docker i automatyczna walidacja.
Minimum to **Node.js 22.22.2**, **pnpm 10.26** i Python 3.10+.
Repozytorium nie blokuje nowszych wersji. W gałęzi Node.js 24 pełna walidacja
wymaga co najmniej 24.15 ze względu na biblioteki testowe.
Jeśli używasz nvm, uruchom `nvm install` i `nvm use` w folderze projektu.
Rekomendowaną wersję pnpm wskazuje `package.json`; możesz ją aktywować przez
`corepack enable` i `corepack install`. Jeśli masz już odpowiedni pnpm,
nie musisz go zmieniać.

```bash
pnpm install
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
pnpm initial
pnpm dev
```

Otwórz **http://localhost:3000**. Wersję produkcyjną uruchomisz przez
`pnpm build`, a potem `pnpm start`.
Szczegóły techniczne: [wdrożenie](docs/deployment.md), [import](docs/import.md),
[funkcje i wygląd](docs/ui.md), [dane użytkownika](docs/storage.md).
