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
- **Offline** — odwiedzone strony są zapamiętywane, a przycisk „Zapisz do użytku offline” na
  stronie auta zapisuje wszystkie jego strony i ilustracje.
- **Prywatność** — brak bazy danych, kont, analityki i zewnętrznych zapytań. Pliki PDF są
  przetwarzane tylko na Twoim komputerze.

## Prawa autorskie — tylko do użytku prywatnego

Treść i ilustracje instrukcji © ich producentów (Opel Automobile GmbH / Stellantis i inni).
Repozytorium jest prywatne i przeznaczone wyłącznie do osobistego użytku. Nie publikuj
wygenerowanej treści ani uruchomionej aplikacji. Pliki PDF nie są przechowywane w
repozytorium (są w `.gitignore` i są usuwane po imporcie).

## Wymagania

- **Node.js 20.9+** (zalecany 22 LTS) i npm
- Do dodawania aut z PDF i (ponownego) generowania treści: **Python 3.10+** oraz pakiety z
  `scripts/requirements.txt` (PyMuPDF, Pillow) — najprościej w środowisku `.venv` w katalogu
  projektu, które aplikacja wykrywa sama

## Instalacja i uruchomienie

```bash
git clone <adres-repozytorium> opel-cascada-manual
cd opel-cascada-manual
npm install

# tryb deweloperski: http://localhost:3000
npm run dev

# wersja produkcyjna (szybsza, z obsługą offline)
npm run build
npm start          # http://localhost:3000
```

Aplikacja działa jako lokalny serwer Next.js (potrzebny do czytania folderu `database/` i do
kreatora „Dodaj auto”). Tryb offline (service worker) działa tylko w wersji produkcyjnej.
Inny interpreter Pythona można wskazać zmienną `PYTHON`, np. `PYTHON=/usr/bin/python3 npm start`.

## Dodawanie własnego auta (kreator)

Menu „Dodaj auto” (lub kafelek „Dodaj własne auto” na profilu) otwiera kreator:

1. **Wymagania** — aplikacja sprawdza Pythona, PyMuPDF, Pillow, skrypt ekstrakcji i prawo
   zapisu do `database/`. Jeśli czegoś brakuje, pokazuje polecenia instalacji:
   ```bash
   python3 -m venv .venv
   .venv/bin/python -m pip install -r scripts/requirements.txt
   # Windows: py -3 -m venv .venv && .venv\Scripts\python -m pip install -r scripts\requirements.txt
   ```
2. **Auto i dokumenty** — u góry obok siebie: marka → model → rocznik (lista podpowiedzi albo
   „Inna marka…/Inny model…”), opcjonalnie wersja silnika. Niżej pole do przeciągania plików
   z siatką dokumentów: podgląd pierwszej strony, liczba stron, edytowalny tytuł, kolejność.
   Limit: **10 plików PDF** na auto (do 250 MB każdy).
3. **Przetwarzanie** — pliki trafiają do lokalnego serwera (do katalogu tymczasowego), a skrypt
   `scripts/extract.py` wyodrębnia tekst, rozdziały, ostrzeżenia, tabele i ilustracje.
4. **Gotowe** — powstaje folder `database/<marka-model-rocznik>/` z plikami JSON i obrazami
   WebP. **Pliki PDF są zawsze usuwane** (także po błędzie).

Aby auto było dostępne na innych urządzeniach, zatwierdź folder w repozytorium:

```bash
git add database/<marka-model-rocznik>
git commit -m "Add <auto>"
git push
```

Na innym komputerze wystarczy `git pull` i uruchomienie aplikacji — bez ponownego wgrywania
PDF. Auto dodane w kreatorze można usunąć na jego stronie („Usuń auto z bazy”); wbudowanej
Cascady nie można usunąć.

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
npm run fetch-manuals

# 3. ekstrakcja tekstu, tabel, ostrzeżeń i obrazów
npm run extract                    # obie księgi
npm run extract -- --book manual   # tylko jedna księga (manual | infotainment)

# 4. podgląd
npm run dev
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

- **Eksport:** Ustawienia → „Eksportuj kopię (JSON)” — pobiera plik
  `opel-cascada-notatki-RRRR-MM-DD.json`.
- **Import:** Ustawienia → wybierz tryb („Scal z obecnymi danymi” lub „Zastąp obecne dane”)
  → „Importuj z pliku…”.
- **Przeniesienie na inny komputer / przeglądarkę:** eksport na starym, import na nowym.
- **Usunięcie wszystkiego:** Ustawienia → „Usuń wszystkie dane”.

## Polecenia

| Polecenie               | Opis                                                 |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | serwer deweloperski                                  |
| `npm run build`         | wersja produkcyjna (`.next/`)                        |
| `npm start`             | uruchomienie wersji produkcyjnej na :3000            |
| `npm run fetch-manuals` | pobranie plików PDF do `manuals/`                    |
| `npm run extract`       | wygenerowanie treści z plików PDF                    |
| `npm run icons`         | wygenerowanie `apple-icon.png` i `favicon.ico` z SVG |
| `npm test`              | testy jednostkowe (Vitest)                           |
| `npm run test:extract`  | testy skryptu ekstrakcji (Python)                    |
| `npm run lint`          | ESLint                                               |
| `npm run typecheck`     | sprawdzenie typów TypeScript                         |
| `npm run format`        | formatowanie (Prettier)                              |

Dokumentacja techniczna (po angielsku): [`AGENTS.md`](AGENTS.md) i katalog [`docs/`](docs/).
