# opel-cascada-manual

Prywatna, lokalna aplikacja (Next.js) do czytania instrukcji aut z zakreślaczem, komentarzami
i notatnikiem. Wbudowana jest pełna polska treść dwóch oficjalnych instrukcji
**Opel Cascada MY16 (2016)**, a kolejne auta dodasz sam z plików PDF:

1. **Instrukcja obsługi** — `instrukcja_cascada_0815_my16_pl.pdf`
2. **System multimedialny Navi 950** — `instrukcja_sa_cascada_0815_my16_pl.pdf`

Treść jest dopasowana do wyposażenia konkretnego auta (1.6 Turbo 170 KM, automat, Navi 950
Europe…): sekcje dotyczące wyposażenia, którego auto nie ma, są zwijane i oznaczone
„Brak w Twoim aucie”, a niepewne funkcje — „do weryfikacji” / „prawdopodobnie”.

## Profil i auta

Po wejściu do aplikacji widzisz **swój profil** — bez logowania i bez bazy danych. Z profilu
wybierasz:

- **auto** — listę aut z folderu `database/` (wbudowana Opel Cascada 2016 oraz auta dodane
  przez Ciebie) albo „Dodaj własne auto”,
- **własny notatnik** — puste kartki z podstawowym formatowaniem Markdown.

Wybrane auto, zaznaczenia, komentarze, zakładki i notatki zapisują się w tej przeglądarce
(localStorage). Instrukcje aut są w repozytorium, więc są dostępne na każdym urządzeniu, na
którym uruchomisz projekt.

## Funkcje

- **Czytnik** — spis treści ksiąg wybranego auta, ścieżka nawigacji, poprzednia/następna
  sekcja, odnośniki do stron („str. 45”), indeks ostrzeżeń, linki do sekcji i akapitów.
- **Wyszukiwarka** — pełnotekstowa, w obrębie wybranego auta; ignoruje wielkość liter i polskie
  znaki („swiatla” znajdzie „światła”).
- **Zakreślacz** — zaznacz dowolny fragment tekstu i wybierz kolor (odcienie srebra, grafit,
  czerwień Opla). Kliknij zaznaczenie, aby zmienić kolor, dodać komentarz lub je usunąć.
- **Komentarze** — do każdego zaznaczenia; lista w każdej sekcji oraz zbiorcza strona
  „Moje komentarze” (z podziałem na auta).
- **Notatnik** — osobne kartki (tworzenie, zmiana nazwy, kolejność, usuwanie), zapis
  automatyczny, Markdown z paskiem narzędzi i podglądem: nagłówki, **pogrubienie**,
  _kursywa_, przekreślenie, listy, lista zadań `- [ ]`, cytaty, kod, linki.
- **Zakładki** i **powrót do ostatnio czytanego miejsca**.
- **Dodaj auto** — kreator krok po kroku (opis niżej).
- **Wyposażenie Cascady** — profil wyposażenia (edytowalny w Ustawieniach), funkcje do
  weryfikacji, opis nieaktywnych przycisków OnStar.
- **Offline** — po otwarciu auta wszystkie jego strony i ilustracje zapisują się same w tle;
  potem całe auto działa bez internetu (znaczek „Offline” w nagłówku). Połączenie jest
  potrzebne tylko do dodawania aut i odświeżenia listy aut.
- **Proste w obsłudze** — okna potwierdzeń na środku ekranu, czytelne komunikaty po polsku
  bez technicznego żargonu, wygląd w stylu ekranów radia Opel Navi 950 (jasny motyw).
- **Prywatność** — brak bazy danych, kont, analityki i zewnętrznych zapytań. Pliki PDF są
  przetwarzane tylko na Twoim komputerze.

## Prawa autorskie — tylko do użytku prywatnego

Treść i ilustracje instrukcji © ich producentów (Opel Automobile GmbH / Stellantis i inni).
Repozytorium jest prywatne i przeznaczone wyłącznie do osobistego użytku. Nie publikuj
wygenerowanej treści ani uruchomionej aplikacji. Pliki PDF nie są przechowywane w
repozytorium (są w `.gitignore` i są usuwane po imporcie).

## Wymagania

- **Node.js 20.9+** (zalecany 22 LTS) i **pnpm 10+** (`npm install -g pnpm` albo
  `corepack enable`) — projekt używa wyłącznie pnpm (`pnpm-lock.yaml`)
- Do dodawania aut z PDF i (ponownego) generowania treści: **Python 3.10+** oraz pakiety z
  `scripts/requirements.txt` (PyMuPDF, Pillow) — patrz „Przygotowanie komputera” niżej

## Instalacja i uruchomienie

```bash
git clone <adres-repozytorium> opel-cascada-manual
cd opel-cascada-manual
pnpm install

# tryb deweloperski: http://localhost:3000
pnpm dev

# wersja produkcyjna (szybsza, z obsługą offline)
pnpm build
pnpm start         # http://localhost:3000
```

Aplikacja działa jako lokalny serwer Next.js (potrzebny do czytania folderu `database/` i do
kreatora „Dodaj auto”). Tryb offline (service worker i automatyczne zapisywanie aut) działa
tylko w wersji produkcyjnej otwartej pod `http://localhost` (albo przez HTTPS).

## Dodawanie aut

### Dla użytkownika — kreator „Dodaj auto”

Menu „Dodaj auto” (lub kafelek „Dodaj własne auto” na profilu) otwiera kreator w trzech
krokach, bez żadnych technicznych pytań:

1. **Auto i instrukcje** — u góry obok siebie: marka → model → rocznik (lista podpowiedzi
   albo „Inna marka…/Inny model…”), opcjonalnie wersja silnika. Niżej pole do przeciągania
   plików z siatką instrukcji: podgląd pierwszej strony, liczba stron, nazwa, kolejność.
   Limit: **10 plików PDF** na auto (do 250 MB każdy).
2. **Odczytywanie** — aplikacja odczytuje tekst, rozdziały, ostrzeżenia, tabele i ilustracje.
3. **Gotowe** — auto pojawia się na liście. **Pliki PDF są zawsze usuwane** (także po błędzie).

Jeśli dodawanie nie jest możliwe (brak połączenia, trwa dodawanie innego auta, komputer nie
jest przygotowany), kreator pokazuje jeden prosty komunikat zamiast formularza wymagań.

### Przygotowanie komputera (jednorazowo, dla osoby uruchamiającej aplikację)

Odczyt PDF wymaga Pythona z bibliotekami PyMuPDF i Pillow. Najprościej utworzyć środowisko
`.venv` w katalogu projektu — aplikacja wykryje je sama (bez restartu):

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
# Windows: py -3 -m venv .venv && .venv\Scripts\python -m pip install -r scripts\requirements.txt
```

Inny interpreter wskażesz zmienną `PYTHON`, np. `PYTHON=/usr/bin/python3 pnpm start`.

### Gdzie trafiają auta i jak je udostępnić

Kreator zapisuje auto w folderze `database/<marka-model-rocznik>/` obok kodu aplikacji
(pliki JSON i obrazy WebP). Aby auto było dostępne na innych komputerach, zatwierdź folder w
repozytorium:

```bash
git add database/<marka-model-rocznik>
git commit -m "Add <auto>"
git push
```

Na innym komputerze wystarczy `git pull` i uruchomienie aplikacji — bez ponownego wgrywania
PDF. Dodawanie i usuwanie aut działa tylko pod adresem `http://localhost` na komputerze, na
którym działa aplikacja (czytanie instrukcji jest możliwe także z innych urządzeń w sieci;
`MANUALS_ALLOW_REMOTE_IMPORT=1` zdejmuje to ograniczenie w zaufanej sieci). Auto dodane w
kreatorze można usunąć na jego stronie („Usuń to auto”); wbudowanej Cascady nie można usunąć.

## Generowanie treści wbudowanej Cascady

Wygenerowana treść Cascady (pliki JSON i obrazy WebP w `database/opel-cascada-2016/`) jest
przechowywana w repozytorium. Jeśli w aplikacji widzisz tylko rozdział „Zanim zaczniesz”, treść
nie została jeszcze wygenerowana — wykonaj lokalnie:

```bash
# 1. zależności Pythona (najlepiej w środowisku wirtualnym)
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python3 -m pip install -r scripts/requirements.txt

# 2. pobranie obu plików PDF do katalogu manuals/
pnpm fetch-manuals

# 3. ekstrakcja tekstu, tabel, ostrzeżeń i obrazów
pnpm extract                 # obie księgi
pnpm extract --book manual   # tylko jedna księga (manual | infotainment)

# 4. podgląd
pnpm dev
```

Jeśli pobieranie się nie uda, pobierz pliki ręcznie ze stron:

- https://www.opel.pl/content/dam/opel/poland/owners/manuals/pdf/Cascada/instrukcja_cascada_0815_my16_pl.pdf
- https://www.opel.pl/content/dam/opel/poland/owners/manuals/pdf/Cascada/instrukcja_sa_cascada_0815_my16_pl.pdf

i zapisz je w katalogu `manuals/` pod tymi samymi nazwami.

Po ekstrakcji zatwierdź (commit) zmiany w `database/opel-cascada-2016/`. Ekstrakcja
nadpisuje poprzednio wygenerowaną treść — zaznaczenia przypięte do tekstu, który się zmienił,
zostaną oznaczone jako „nie odnaleziono” (nie znikną).

Oznaczanie sekcji funkcjami auta (np. „Brak w Twoim aucie”) jest w
`src/config/featureRules.ts` — można je poprawiać bez ponownej ekstrakcji.

## Kopia zapasowa notatek

Zaznaczenia, komentarze, notatnik, zakładki i ustawienia są zapisywane tylko w tej
przeglądarce (dla wszystkich aut). Wyczyszczenie danych przeglądarki usunie je bezpowrotnie.
Dane ze starszej wersji aplikacji (tylko Cascada) są automatycznie przenoszone do nowego
formatu.

- **Kopia:** Ustawienia → „Pobierz kopię zapasową” — pobiera plik
  `opel-cascada-notatki-RRRR-MM-DD.json`.
- **Wczytanie:** Ustawienia → wybierz sposób („Scal z obecnymi danymi” lub „Zastąp obecne
  dane”) → „Wczytaj kopię z pliku…”.
- **Przeniesienie na inny komputer / przeglądarkę:** eksport na starym, import na nowym.
- **Usunięcie wszystkiego:** Ustawienia → „Usuń wszystkie dane”.
- **Instrukcje offline:** Ustawienia → „Usuń instrukcje zapisane offline” (zapiszą się
  ponownie przy następnym otwarciu auta).

## Polecenia

| Polecenie            | Opis                                                 |
| -------------------- | ---------------------------------------------------- |
| `pnpm dev`           | serwer deweloperski                                  |
| `pnpm build`         | wersja produkcyjna (`.next/`)                        |
| `pnpm start`         | uruchomienie wersji produkcyjnej na :3000            |
| `pnpm fetch-manuals` | pobranie plików PDF do `manuals/`                    |
| `pnpm extract`       | wygenerowanie treści z plików PDF                    |
| `pnpm icons`         | wygenerowanie `apple-icon.png` i `favicon.ico` z SVG |
| `pnpm test`          | testy jednostkowe (Vitest)                           |
| `pnpm test:extract`  | testy skryptu ekstrakcji (Python)                    |
| `pnpm lint`          | ESLint                                               |
| `pnpm typecheck`     | sprawdzenie typów TypeScript                         |
| `pnpm format`        | formatowanie (Prettier)                              |

Dokumentacja techniczna (po angielsku): [`AGENTS.md`](AGENTS.md) i katalog [`docs/`](docs/).
