# Glovebox

**Glovebox** (czyt. „glawboks”, ang. schowek w desce rozdzielczej) to Twój cyfrowy schowek na
dokumenty auta: prywatna, lokalna aplikacja (Next.js) do czytania instrukcji samochodowych
wszystkich marek z zakreślaczem, komentarzami i notatnikiem, a przy okazji menedżer Twoich aut
(wyposażenie, przypomnienia o badaniu i OC) — wszystkie Twoje dane zostają lokalnie. Każda osoba dodaje **własne auta i instrukcje PDF** —
markę, model i rocznik można wybrać z oficjalnych katalogów, a dane spoza katalogu
wprowadzić ręcznie. Silnik wybierasz później w wyposażeniu konkretnego auta. Aplikacja nie
zawiera domyślnego auta ani przykładowej instrukcji.

Po dodaniu auta do profilu zaznaczasz jego **wyposażenie** (np. tempomat, kamera cofania, hak):
aplikacja sama wyszukuje w jego instrukcjach opisy wyposażenia opcjonalnego. Sekcje o wyposażeniu,
którego auto nie ma, są zwijane i oznaczone „Brak w Twoim aucie”, a podpowiedzi wynikające z
wybranego silnika — „prawdopodobnie”.

## Profil i auta

Po wejściu do aplikacji widzisz **swój profil** — bez logowania i bez bazy danych. Z profilu
wybierasz:

- **Twoje auta** — listę aut dodanych do profilu. Z folderu `database/` możesz wybrać dostępne
  instrukcje albo dodać własne auto z plików PDF; usunięcie auta z listy nie kasuje instrukcji,
- **własny notatnik** — puste kartki z podstawowym formatowaniem Markdown.

Wybrane auto, zaznaczenia, komentarze, zakładki i notatki zapisują się w tej przeglądarce
(localStorage), a wyposażenie — osobno dla każdego auta. Instrukcje aut są tylko na Twoim
komputerze: folder `database/` jest w `.gitignore` i nie trafia do repozytorium.
Silnik również jest częścią Twojego wyposażenia, a nie wspólnych instrukcji. Wybierzesz
go lub zmienisz na stronie „Wyposażenie”. Dopasowane dane silnika w tabelach są pokazywane
przed pozostałymi wersjami; przyciskiem „Pokaż wszystkie silniki” odsłonisz pełną tabelę.
Gdy dopasowanie nie jest pewne, aplikacja niczego nie ukrywa.
Po tej aktualizacji otwórz potrzebne auta przy działającej aplikacji, aby odnowić ich
kopie do czytania bez połączenia. Zaznaczenia i notatki zostają zachowane.

## Funkcje

- **Czytnik** — spis treści ksiąg wybranego auta, poprzedni/następny rozdział z miniaturą
  ilustracji, odnośniki do stron („str. 45”), ostrzeżenia dla wybranego auta, linki do sekcji
  i akapitów. Na szerokim ekranie z prawej: „Na tej stronie”, ostrzeżenia rozdziału i Twoje
  zaznaczenia.
- **Widok auta** — duża karta auta (logo, model, rocznik, silnik), liczby z instrukcji, kafle
  „Najczęściej potrzebne” (np. ciśnienie w oponach, bezpieczniki, żarówki – tylko te, które
  są w instrukcji), pasek „Ulubione” z sześcioma najnowszymi zakładkami tego auta, podgląd danych
  technicznych (wybrany silnik, paliwo i np. zbiornik paliwa — tylko dane dostępne w
  instrukcji), najbliższe przypomnienia oraz wyszukiwanie, ostrzeżenia i wyposażenie.
- **Przypomnienia** — dla każdego Twojego auta termin badania technicznego, ubezpieczenia OC
  i własne przypomnienia (data, przebieg). Na 30 dni przed terminem liczba przy
  „Przypomnienia” w menu podpowiada, że coś się zbliża. Terminy zostają tylko w tej
  przeglądarce.
- **Lampki kontrolne** — symbole z instrukcji razem z opisem; kliknięcie prowadzi do
  fragmentu instrukcji.
- **Dane techniczne** — pojemności, ciśnienia i wymiary z instrukcji jako czytelne karty.
- **Wyszukiwarka** — pełnotekstowa, w obrębie wybranego auta; ignoruje wielkość liter i polskie
  znaki („swiatla” znajdzie „światła”).
- **Zakreślacz** — zaznacz dowolny fragment tekstu i wybierz kolor (odcienie srebra, grafit,
  czerwień). Kliknij zaznaczenie, aby zmienić kolor, dodać komentarz lub je usunąć.
- **Komentarze** — do każdego zaznaczenia; lista w każdej sekcji oraz zbiorcza strona
  „Moje komentarze” (z podziałem na auta).
- **Notatnik** — osobne kartki (tworzenie, zmiana nazwy, kolejność, usuwanie), zapis
  automatyczny, Markdown z paskiem narzędzi i podglądem: nagłówki, **pogrubienie**,
  _kursywa_, przekreślenie, listy, lista zadań `- [ ]`, cytaty, kod, linki.
- **Zakładki**, **powrót do ostatnio czytanego miejsca** i historia ostatnio czytanych
  rozdziałów na profilu, a także ostatnie zaznaczenia i wskazówka „Czy wiesz, że…”.
- **Dodaj auto** — kreator krok po kroku (opis niżej).
- **Logo marki** — po wybraniu auta w nagłówku widać oficjalne logo jego marki z roku
  produkcji, a gdy nie da się go ustalić — najnowsze logo albo ikonę aplikacji. Logo pochodzi
  z Wikidanych i zapisuje się
  na komputerze (`database/.logos/`), więc działa też offline.
- **Wyposażenie auta** — dla każdego auta osobno („Mam” / „Nie mam” / „Nie wiem”), tylko
  funkcje opisane w jego instrukcjach, z linkami do odpowiednich sekcji; podpowiedzi na
  podstawie silnika. Edytor otworzysz osobnym przyciskiem na stronie wybranego auta.
- **Offline** — po otwarciu auta wszystkie jego strony i ilustracje zapisują się same w tle;
  potem całe auto działa bez internetu (znaczek „Offline” w nagłówku). Połączenie jest
  potrzebne tylko do dodawania aut i odświeżenia listy aut.
- **Ikona aplikacji** — schowek z instrukcją w kolorach aplikacji. W karcie przeglądarki ikona
  dopasowuje się do jasnego lub ciemnego motywu systemu; sama aplikacja zawsze ma jasny wygląd.
  Aplikację można też zainstalować na pulpicie (Chrome, Edge, Safari na macOS) lub na ekranie
  głównym telefonu i tabletu (Android, iPhone, iPad – w Safari: Udostępnij → Do ekranu
  początkowego). Zainstalowana aplikacja otwiera się we własnym oknie, ma skróty do listy aut,
  wyszukiwania, przypomnień i notatnika, a wybrane auta działają bez internetu.
- **Proste w obsłudze** — okna potwierdzeń na środku ekranu, czytelne komunikaty po polsku
  bez technicznego żargonu, jasny wygląd inspirowany podziałem i stylistyką ekranów Opel Navi 950.
- **Prywatność** — brak bazy danych, kont i analityki. Pliki PDF są przetwarzane tylko na
  Twoim komputerze. Jedyne zapytania na zewnątrz wysyła lokalny serwer — do publicznych
  katalogów aut (kreator „Dodaj auto”) i po logo marki (Wikidane) — bez żadnych Twoich
  danych.

## Prawa autorskie — tylko do użytku prywatnego

Treść i ilustracje instrukcji © ich producentów.
Repozytorium jest prywatne i przeznaczone wyłącznie do osobistego użytku. Nie publikuj
wygenerowanej treści ani uruchomionej aplikacji. Pliki PDF nie są przechowywane w
repozytorium (są w `.gitignore` i są usuwane po imporcie).

## Wymagania

- **Node.js 20.9+** (zalecany 22 LTS) i **pnpm 10+** (`npm install -g pnpm` albo
  `corepack enable`) — projekt używa wyłącznie pnpm (`pnpm-lock.yaml`)
- Do importowania instrukcji PDF: **Python 3.10+**, PyMuPDF 1.26+ i Pillow 12.3+ — patrz
  „Przygotowanie komputera” niżej

## Instalacja i uruchomienie

```bash
git clone <adres-repozytorium> glovebox
cd glovebox
pnpm install

# tryb deweloperski: http://localhost:3000
pnpm dev

# wersja produkcyjna (szybsza, z obsługą offline)
pnpm build
pnpm start         # http://localhost:3000
```

Aplikacja działa jako lokalny serwer Next.js (potrzebny do czytania folderu `database/` i do
kreatora „Dodaj auto”). Tryb offline (service worker i automatyczne zapisywanie instrukcji) działa
tylko w wersji produkcyjnej otwartej pod `http://localhost` (albo przez HTTPS).

## Dodawanie aut

Nowa kopia aplikacji nie ma żadnego domyślnego auta ani instrukcji. Kreator sprawdza, czy
środowisko spełnia wymagania opisane niżej (Node.js, Python, biblioteki, skrypt odczytu i zapis
do bazy). Jeśli `database/` nie zawiera jeszcze czytelnej instrukcji, nie ma aut do wybrania, ale można
dodać pierwsze auto z plików PDF. Pusta baza nie blokuje dodawania pierwszego auta.

### Dla użytkownika — kreator „Dodaj auto”

Przycisk „Dodaj auto” na profilu pozwala wybrać istniejące instrukcje z lokalnej biblioteki albo
otworzyć kreator i dodać własne auto. Kreator przeprowadza przez cztery kroki, bez technicznych pytań:

1. **Auto i instrukcje** — marka → model → rocznik, wybierane z list. Listy pochodzą
   z oficjalnych danych rejestracyjnych (Europejska Agencja Środowiska — wszystkie nowe auta
   osobowe rejestrowane w UE od 2010 r.; NHTSA — modele sprzedawane w USA od 2000 r.), więc
   nie da się wybrać modelu ani rocznika, który nie istniał. Dla modeli sprzedawanych w
   ostatnim roku katalog obejmuje też bieżący i przyszły rocznik, zanim pojawią się dane o
   rejestracjach. Dla aut spoza katalogu (np. starszych) wybierz markę **„Inna (wpiszę
   ręcznie)”** — wtedy wpisujesz markę i model, wybierasz rocznik (obowiązkowe) i opcjonalnie
   wersję. Niżej pole do przeciągania plików z siatką instrukcji: podgląd pierwszej strony,
   liczba stron, nazwa, kolejność. Limit: **10 plików PDF** na auto (do 250 MB każdy).
2. **Odczytywanie** — aplikacja odczytuje tekst, rozdziały, ostrzeżenia, tabele i ilustracje.
3. **Wyposażenie** — silniki i lista wyposażenia opcjonalnego znalezione w instrukcjach; zaznacz, co
   ma Twoje auto (można pominąć i uzupełnić później na stronie „Wyposażenie” auta).
4. **Gotowe** — auto zostaje dodane do profilu. **Pliki PDF są zawsze usuwane** (także po błędzie).

Katalog aut jest pobierany przy pierwszym otwarciu kreatora (wymaga internetu) i
zapamiętywany w `database/.catalog/` na kilka dni. Gdy katalog jest niedostępny, kreator
pozwala dodać auto tylko przez „Inna”.

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

### Gdzie trafiają auta i jak je przenieść

Kreator zapisuje auto w folderze `database/<marka-model-rocznik>/` obok kodu aplikacji
(pliki JSON i obrazy WebP). Cały folder `database/` jest w `.gitignore` — baza aut zostaje
lokalnie, a każdy, kto uruchamia kod, wgrywa własne instrukcje. Aby przenieść auto na inny
komputer, skopiuj jego folder do `database/` w drugiej kopii projektu (bez ponownego wgrywania
PDF).

Dodawanie i usuwanie aut działa tylko pod adresem `http://localhost` na komputerze, na
którym działa aplikacja (czytanie instrukcji jest możliwe także z innych urządzeń w sieci;
`MANUALS_ALLOW_REMOTE_IMPORT=1` zdejmuje to ograniczenie w zaufanej sieci). Każde auto można
usunąć na jego stronie („Usuń to auto”).

## Generowanie treści

Nie ma wbudowanej instrukcji ani gotowego zestawu plików dla żadnego auta. Instrukcje każdej
marki dodaje się w kreatorze „Dodaj auto”; podane pliki PDF są przetwarzane na tym komputerze,
a następnie usuwane. Wygenerowane pliki trafiają do ignorowanego przez Git folderu
`database/<marka-model-rocznik>/`. Nie edytuj ich ręcznie — ponowne dodanie instrukcji
tworzy osobny wpis auta i jego ksiąg.

Rozpoznawanie wyposażenia w treści (tytuły sekcji i nagłówki, np. „Tempomat”) jest w
`src/config/featureRules.ts` i działa dla wszystkich aut — można je poprawiać bez ponownej
ekstrakcji. Szczegóły: `docs/vehicle-profile.md` i `docs/catalog.md`.

## Kopia zapasowa notatek

Zaznaczenia, komentarze, notatnik, zakładki, wyposażenie aut i ustawienia są zapisywane tylko w tej
przeglądarce (dla wszystkich aut). Wyczyszczenie danych przeglądarki usunie je bezpowrotnie.
Dane ze starszej wersji aplikacji są automatycznie przenoszone do aktualnego formatu.

- **Kopia:** Ustawienia → „Pobierz kopię zapasową” — pobiera plik z datą w nazwie.
- **Wczytanie:** Ustawienia → wybierz sposób („Scal z obecnymi danymi” lub „Zastąp obecne
  dane”) → „Wczytaj kopię z pliku…”.
- **Przeniesienie na inny komputer / przeglądarkę:** eksport na starym, import na nowym.
- **Usunięcie wszystkiego:** Ustawienia → „Usuń wszystkie dane”.
- **Instrukcje offline:** Ustawienia → „Usuń instrukcje zapisane offline” (zapiszą się
  ponownie przy następnym otwarciu auta).

## Polecenia

| Polecenie           | Opis                                                             |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | serwer deweloperski                                              |
| `pnpm build`        | wersja produkcyjna (`.next/`)                                    |
| `pnpm start`        | uruchomienie wersji produkcyjnej na :3000                        |
| `pnpm icons`        | wygenerowanie ikon PNG/ICO (karta, iOS, instalacja) z `icon.svg` |
| `pnpm test`         | testy jednostkowe (Vitest)                                       |
| `pnpm test:extract` | testy skryptu ekstrakcji (Python)                                |
| `pnpm lint`         | ESLint (bez ostrzeżeń)                                           |
| `pnpm lint:py`      | ruff dla kodu Pythona                                            |
| `pnpm typecheck`    | sprawdzenie typów TypeScript                                     |
| `pnpm unused`       | wyszukanie nieużywanego kodu (knip)                              |
| `pnpm format`       | formatowanie (Prettier); `pnpm format:check` tylko sprawdza      |
| `pnpm check`        | pełna kontrola projektu (wszystko powyżej i build)               |

`pnpm lint:py` wymaga narzędzi deweloperskich Pythona:
`.venv/bin/python -m pip install -r scripts/requirements-dev.txt`. Ta sama kontrola
(`pnpm check`) uruchamia się automatycznie w GitHub Actions dla każdej zmiany w `master`.
