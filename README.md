# Portal quizów — klasa 5

Strona: https://sochagrzegorz.github.io/quiz/

Wygląd, CSS, adresy podstron, banki pytań i istniejące notatniki pozostają zachowane. `index.html` nie został zmieniony. Zmiany dotyczą API, oceny, wznowienia i ćwiczenia błędnych odpowiedzi.

## Punktacja i źródło prawdy

- **Biologia:** 7 pytań jednokrotnego wyboru po 1 pkt i 3 pytania otwarte po 0–2 pkt, razem **13 pkt**.
- **Lektura:** po 2 pytania z każdej sekcji. I–III: 6 × 1 pkt; IV: 2 × 0–2 pkt; V: 2 × 0–5 pkt, razem **20 pkt**.
- Worker losuje identyfikatory i sprawdza odpowiedzi względem `question-bank.js`. Treści pytań, wzorce i punkty przesłane przez przeglądarkę nie są źródłem oceny.
- `npm run bank:generate` odtwarza serwerowy bank z istniejących danych HTML. Test wymaga ich zgodności. Przykładowe odpowiedzi/wskazówki do wypowiedzi z lektury znajdują się w `literature-guidance.js`; nie stanowią jedynego dopuszczalnego klucza.
- AI akceptuje parafrazy, synonimy i literówki, ocenia tylko wymagane elementy i podaje krótkie uzasadnienie. Wynik musi być całkowity, w zakresie pytania, z niepustą informacją zwrotną. Sumy liczy kod serwera. Brak odpowiedzi daje 0 bez wywoływania AI. Niedostępność modelu nie daje punktów zastępczych.

## Sesje, ranking i współbieżność

`QuizCoordinator` to SQLite-backed Durable Object wskazany bindingiem `QUIZ`. Wszystkie operacje przechodzą przez jednego koordynatora, co zapobiega wyścigom podczas oceniania i zapisu.

1. `/session` tworzy kryptograficznie losowy identyfikator sesji ważny **2 godziny**, przypisuje pseudonim, quiz i pytania.
2. Odpowiedź można zatwierdzić raz. Identyczne ponowienie zwraca zapisaną ocenę. Próba zmiany zatwierdzonej odpowiedzi daje 409. Każda ocena w paczce jest zapisywana od razu — awaria drugiej odpowiedzi nie powoduje ponownej oceny pierwszej.
3. `/finish` wymaga wszystkich odpowiedzi i liczy wynik na serwerze. Wystawia losowy bilet związany z jednym wynikiem i terminem sesji.
4. `/leaderboard` POST przyjmuje wyłącznie quiz i bilet. Wynik i zużycie biletu są zapisywane w jednej transakcji. Ponowienie zwraca ten sam rezultat bez drugiego wpisu. Przesyłanie `points`, `maxPoints` lub `nickname` jest odrzucane.
5. Nowe wyniki są przechowywane osobno dla każdego quizu i pseudonimu w Durable Object. Dotychczasowy klucz `leaderboard` w KV `LEADERBOARD` jest **wyłącznie odczytywany**. Listy są łączone, deduplikowane i sortowane przed wyborem TOP 10 osobno dla każdego quizu. Historyczne wpisy bez oznaczenia quizu są traktowane jako lektura, jak wcześniej. Nie usuwa się żadnych starych danych.

Origin służy tylko do CORS. Nie jest dowodem rozwiązania quizu. Limity są trwałe w Durable Object: 120 żądań/min/IP, 60 zapisów/min/IP, 12 nowych sesji/godz./IP; oczekująca kolejka ma maksymalnie 32 żądania. Rozmiar JSON jest ograniczony do 24 KB również przy transmisji strumieniowej. IP jest haszowany przed zapisem klucza licznika. Alarm usuwa wygasłe sesje, bilety i liczniki, nigdy ranking.

**Granice ochrony:** publiczny bank pytań nie zapewnia tajności klucza ani dowodu samodzielnej pracy ucznia. Nie da się dowolnie wpisać punktów, ale nadal można korzystać ze źródeł lub automatyzować poprawne odpowiedzi. Model językowy nie gwarantuje odporności na każdą manipulację odpowiedzią. Historycznych wyników nie da się zweryfikować wstecz i pozostają w rankingu. Pseudonim nie jest uwierzytelnionym kontem.

## API

| Endpoint | Dane |
| --- | --- |
| POST `/session` | `{quiz, nickname}`; domyślny quiz `lektura` dla istniejącego klienta |
| POST `/closed` | `{token, answers:[{id,value}]}` — komplet 6 pytań I–III |
| POST `/grade` | `{token, section:'IV'|'V', answers:[{id,answer}]}` |
| POST `/answer` | `{token,id,answer}` — biologia |
| POST `/biology-grade` | `{token,id,answer}` — otwarte pytanie biologii |
| POST `/explain` | `{token,id}` — wyjaśnienie dopiero po zatwierdzeniu odpowiedzi |
| POST `/finish` | `{token}` |
| POST `/leaderboard` | `{quiz,ticket}` |
| GET `/leaderboard?quiz=…` | osobne TOP 10 |
| GET `/resume?quiz=…` | stan serwera na podstawie ciasteczka HttpOnly |

Nie ma zgodności z dawnym, niezabezpieczonym zapisem punktów biologii. Otwarte stare karty wymagają odświeżenia po zmianie wersji. Nie należy utrzymywać starego endpointu jako obejścia.

## Powtórka, notatniki i odzyskiwanie postępu

- Przycisk „Przećwicz błędne odpowiedzi” pojawia się **wewnątrz istniejącej rozwijanej listy błędów**. Używa dotychczasowych klas. To jedyny nowy element układu wyników, poza przyciskiem ponowienia zapisu widocznym wyłącznie po błędzie.
- Powtórka obejmuje błędne pytania zamknięte i odpowiedzi opisowe poniżej maksimum. Po próbie pokazuje odpowiedź/przykładowe rozwinięcie oraz wyjaśnienie. Opisowe powtórki służą porównaniu z przykładem, nie otrzymują nowej oceny AI. Powtórka nie wywołuje API i nie zmienia rankingu.
- Notatki lektury dobierane są do treści bieżącego pytania po zatwierdzeniu, bez ponowienia przed wykorzystaniem talii. Biologia zachowuje materiały do nauki dostępne podczas pytania; filtr tematyczny i następna notatka nie zmieniają pytania. Nie usunięto żadnej notatki.
- `sessionStorage` przechowuje szkice odpowiedzi i identyfikatory pytań, **bez tokenów, biletów i ocen**. Błędy dostępu do Web Storage nie przerywają quizu. Pseudonim i lokalne statystyki biologii pozostają w zabezpieczonym obsługą wyjątków `localStorage`.
- Token w przeglądarce jest trzymany w pamięci. Wznowienie korzysta z ciasteczka `Secure; HttpOnly; SameSite=None; Partitioned`; API używa `credentials: include`. Po odświeżeniu ocenione odpowiedzi i wynik są odczytywane z serwera.
- Safari lub ustawienia prywatności mogą blokować ciasteczka między GitHub Pages a workers.dev. Wtedy aplikacja wyjaśnia brak wznowienia, zachowuje szkic i pozwala zacząć nowy zestaw. Pełne wznowienie w każdej przeglądarce wymaga API w tej samej witrynie (np. własna domena). Równoległa sesja w innej karcie nie jest automatycznie podstawiana w miejsce zapisanej.
- Po niepewnym wyniku żądania AI tekst pozostaje zablokowany do ponowienia tej samej odpowiedzi; serwer mógł ją już ocenić. Zapobiega to rozbieżności tekstu i zapisanych punktów.

## Konfiguracja i bezpieczne wdrożenie

**Zmiany wymagają osobnego wdrożenia Cloudflare Worker. W ramach audytu nie wdrażano backendu ani nie zmieniano produkcyjnych danych.**

1. Sprawdź obecne ustawienia `chlopcy-quiz-ai`, bindingi, identyfikator produkcyjnej przestrzeni KV i istniejące migracje Durable Objects. Wykonaj kopię rankingu przed planowaną zmianą.
2. W `wrangler.toml` uzupełnij zakomentowany binding `LEADERBOARD` identyfikatorem **istniejącej** przestrzeni. Bez niego ranking zgłasza błąd konfiguracji zamiast pokazywać pustą listę. Zachowaj istniejące dodatkowe ustawienia Workera. Nie wklejaj samego `worker.js` do edytora — importuje dwa moduły.
3. Skonfiguruj binding AI `AI`, SQLite Durable Object `QUIZ` / `QuizCoordinator` i migrację `quiz-v1` (upewnij się, że tag nie koliduje z istniejącymi migracjami). Sekret OpenAI nie jest potrzebny: kod używa Workers AI.
4. Testuj na odrębnej konfiguracji staging z oddzielnym Durable Object i testowym KV; nie używaj produkcyjnego KV do testowych zapisów. Sprawdź AI na reprezentatywnych odpowiedziach i CORS/cookies w rzeczywistych urządzeniach.
5. Dopiero po zgodzie właściciela wdrażaj Workera, następnie scalaj frontend w uzgodnionym oknie. Wcześniejsze wdrożenie Workera czasowo odrzuci dawne zapisy biologii; należy odświeżyć stare karty. Sam merge nie wdraża Workera.
6. Powrót do poprzedniego frontendu/backendu nie usuwa danych Durable Object, ale poprzedni backend nie pokazuje nowych wpisów i ponownie otwiera dawną lukę. Zaplanuj odwrót bez przywracania niezabezpieczonego zapisu.

Koordynator jest świadomie prosty i obsługuje niewielki portal: wolna ocena AI może opóźnić inne żądania. Przed użyciem całej klasy/szkoły dopasuj limity współdzielonego IP, sprawdź obciążenie, budżet Workers AI i ochronę brzegową Cloudflare. Przy większym ruchu rozdziel sesje między Durable Objects, zachowując osobny transakcyjny koordynator rankingu, albo użyj D1 z unikalnym identyfikatorem zatwierdzenia. Transakcyjność DO i ograniczenia KV opisują [dokumentacja DO](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) oraz [dokumentacja KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

## Testy

Wymagany Node.js 22 lub nowszy.

```sh
npm ci
npm test
npm run test:runtime
npx playwright install --with-deps chromium webkit
npm run test:browser
```

`npm run test:chromium` uruchamia profile komputera i Androida bez WebKit. Testy przeglądarkowe przechwytują ruch i uruchamiają prawdziwy kod Workera z mockiem AI oraz pamięci; nie zapisują nic na produkcji. Test runtime używa lokalnego workerd/SQLite. CI uruchamia oba zestawy na Linuxie i zachowuje obrazy/trace jako artefakt `browser-evidence`.

Test wizualny porównuje PNG przed i po z bazą `539c6330f27b3598c0d4317514d69603a09ec5c6`; wymaga historii Git (`fetch-depth: 0`). Dodatkowo testowane są niezmienność CSS i statycznego HTML, zgodność banków, limity punktów, transakcje, powtórki, notatki, awarie i odzyskiwanie sesji. Szczegółowe wyniki oraz ograniczenia: [AUDIT.md](AUDIT.md).
