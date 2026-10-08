# opel-cascada-manual

Prywatna, lokalna aplikacja (Next.js) z pełną polską treścią dwóch oficjalnych instrukcji
**Opel Cascada MY16 (2016)**:

1. **Instrukcja obsługi** — `instrukcja_cascada_0815_my16_pl.pdf`
2. **System multimedialny Navi 950** — `instrukcja_sa_cascada_0815_my16_pl.pdf`

Treść jest dopasowana do wyposażenia konkretnego auta (1.6 Turbo 170 KM, automat, Navi 950
Europe…): sekcje dotyczące wyposażenia, którego auto nie ma, są zwijane i oznaczone
„Brak w Twoim aucie”, a niepewne funkcje — „do weryfikacji” / „prawdopodobnie”.

## Funkcje

- **Czytnik** — spis treści obu ksiąg, ścieżka nawigacji, poprzednia/następna sekcja,
  odnośniki do stron („str. 45”), indeks ostrzeżeń, linki bezpośrednie do sekcji i akapitów.
- **Wyszukiwarka** — pełnotekstowa, działa w przeglądarce, ignoruje wielkość liter i polskie
  znaki („swiatla” znajdzie „światła”).
- **Zakreślacz** — zaznacz dowolny fragment tekstu i wybierz kolor (odcienie srebra, grafit,
  czerwień Opla). Kliknij zaznaczenie, aby zmienić kolor, dodać komentarz lub je usunąć.
- **Komentarze** — do każdego zaznaczenia; lista w każdej sekcji oraz zbiorcza strona
  „Moje komentarze”.
- **Notatnik** — osobne, puste kartki na własne notatki (tworzenie, zmiana nazwy, kolejność,
  usuwanie), zapis automatyczny.
- **Zakładki** i **powrót do ostatnio czytanego miejsca**.
- **Twoje auto** — profil wyposażenia (edytowalny w Ustawieniach), lista funkcji do weryfikacji,
  opis nieaktywnych przycisków OnStar.
- **Offline** — po pierwszym wczytaniu (wersja produkcyjna) aplikacja działa bez internetu,
  łącznie z obrazkami.
- **Prywatność** — brak bazy danych, serwera API, analityki i zewnętrznych zapytań. Wszystkie
  Twoje dane są tylko w tej przeglądarce (localStorage).

## Prawa autorskie — tylko do użytku prywatnego

Treść i ilustracje instrukcji © Opel Automobile GmbH / Stellantis. Repozytorium jest prywatne
i przeznaczone wyłącznie do osobistego użytku właściciela pojazdu. Nie publikuj wygenerowanej
treści ani zbudowanej aplikacji. Pliki PDF nie są przechowywane w repozytorium (są w
`.gitignore`).

## Wymagania

- **Node.js 20.9+** (zalecany 22 LTS) i npm
- Do (ponownego) wygenerowania treści: **Python 3.10+** oraz pakiety z
  `scripts/requirements.txt` (PyMuPDF, Pillow)

## Instalacja i uruchomienie

```bash
git clone <adres-repozytorium> opel-cascada-manual
cd opel-cascada-manual
npm install

# tryb deweloperski: http://localhost:3000
npm run dev

# wersja produkcyjna (statyczna, z obsługą offline)
npm run build
npm start          # serwuje katalog out/ pod http://localhost:3000
```

Tryb offline (service worker) działa tylko w wersji produkcyjnej (`npm run build` + `npm start`).

## Generowanie treści instrukcji

Wygenerowana treść (pliki JSON w `src/content/` i obrazy WebP w `public/assets/`) jest
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

Po ekstrakcji zatwierdź (commit) zmiany w `src/content/` i `public/assets/`. Ekstrakcja
nadpisuje poprzednio wygenerowaną treść — zaznaczenia przypięte do tekstu, który się zmienił,
zostaną oznaczone jako „nie odnaleziono” (nie znikną).

Oznaczanie sekcji funkcjami auta (np. „Brak w Twoim aucie”) jest w
`src/config/featureRules.ts` — można je poprawiać bez ponownej ekstrakcji.

## Kopia zapasowa notatek

Zaznaczenia, komentarze, notatnik, zakładki i ustawienia są zapisywane tylko w tej
przeglądarce. Wyczyszczenie danych przeglądarki usunie je bezpowrotnie.

- **Eksport:** Ustawienia → „Eksportuj kopię (JSON)” — pobiera plik
  `opel-cascada-notatki-RRRR-MM-DD.json`.
- **Import:** Ustawienia → wybierz tryb („Scal z obecnymi danymi” lub „Zastąp obecne dane”)
  → „Importuj z pliku…”.
- **Przeniesienie na inny komputer / przeglądarkę:** eksport na starym, import na nowym.
- **Usunięcie wszystkiego:** Ustawienia → „Usuń wszystkie dane”.

## Polecenia

| Polecenie               | Opis                                                    |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | serwer deweloperski                                     |
| `npm run build`         | statyczna wersja produkcyjna w `out/` (+ lista offline) |
| `npm start`             | serwowanie `out/` lokalnie                              |
| `npm run fetch-manuals` | pobranie plików PDF do `manuals/`                       |
| `npm run extract`       | wygenerowanie treści z plików PDF                       |
| `npm run icons`         | wygenerowanie `apple-icon.png` i `favicon.ico` z SVG    |
| `npm test`              | testy jednostkowe (Vitest)                              |
| `npm run test:extract`  | testy skryptu ekstrakcji (Python)                       |
| `npm run lint`          | ESLint                                                  |
| `npm run typecheck`     | sprawdzenie typów TypeScript                            |
| `npm run format`        | formatowanie (Prettier)                                 |

Dokumentacja techniczna (po angielsku): [`AGENTS.md`](AGENTS.md) i katalog [`docs/`](docs/).
