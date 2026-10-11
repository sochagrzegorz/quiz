# Portal quiz�w - klasa 5

Strona: https://sochagrzegorz.github.io/quiz/

Wygl�d, CSS, adresy podstron, banki pyta� i istniej�ce notatniki pozostaj� zachowane. `index.html` nie zosta� zmieniony. Zmiany dotycz� API, oceny, wznowienia i �wiczenia b��dnych odpowiedzi.

## Punktacja i �r�d�o prawdy

- **Biologia:** 7 pyta� jednokrotnego wyboru po 1 pkt i 3 pytania otwarte po 0-2 pkt, razem **13 pkt**.
- **Lektura:** po 2 pytania z ka�dej sekcji. I-III: 6 � 1 pkt; IV: 2 � 0-2 pkt; V: 2 � 0-5 pkt, razem **20 pkt**.
- Worker losuje identyfikatory i sprawdza odpowiedzi wzgl�dem `question-bank.js`. Tre�ci pyta�, wzorce i punkty przes�ane przez przegl�dark� nie s� �r�d�em oceny.
- `npm run bank:generate` odtwarza serwerowy bank z istniej�cych danych HTML. Test wymaga ich zgodno�ci. Przyk�adowe odpowiedzi/wskaz�wki do wypowiedzi z lektury znajduj� si� w `literature-guidance.js`; nie stanowi� jedynego dopuszczalnego klucza.
- AI akceptuje parafrazy, synonimy i liter�wki, ocenia tylko wymagane elementy i podaje kr�tkie uzasadnienie. Wynik musi by� ca�kowity, w zakresie pytania, z niepust� informacj� zwrotn�. Sumy liczy kod serwera. Brak odpowiedzi daje 0 bez wywo�ywania AI. Niedost�pno�� modelu nie daje punkt�w zast�pczych.

## Sesje, ranking i wsp��bie�no��

`QuizCoordinator` to SQLite-backed Durable Object wskazany bindingiem `QUIZ`. Wszystkie operacje przechodz� przez jednego koordynatora, co zapobiega wy�cigom podczas oceniania i zapisu.

1. `/session` tworzy kryptograficznie losowy identyfikator sesji wa�ny **2 godziny**, przypisuje pseudonim, quiz i pytania.
2. Odpowied� mo�na zatwierdzi� raz. Identyczne ponowienie zwraca zapisan� ocen�. Pr�ba zmiany zatwierdzonej odpowiedzi daje 409. Ka�da ocena w paczce jest zapisywana od razu - awaria drugiej odpowiedzi nie powoduje ponownej oceny pierwszej.
3. `/finish` wymaga wszystkich odpowiedzi i liczy wynik na serwerze. Wystawia losowy bilet zwi�zany z jednym wynikiem i terminem sesji.
4. `/leaderboard` POST przyjmuje wy��cznie quiz i bilet. Wynik i zu�ycie biletu s� zapisywane w jednej transakcji. Ponowienie zwraca ten sam rezultat bez drugiego wpisu. Przesy�anie `points`, `maxPoints` lub `nickname` jest odrzucane.
5. Nowe wyniki s� przechowywane osobno dla ka�dego quizu i pseudonimu w Durable Object. Dotychczasowy klucz `leaderboard` w KV `LEADERBOARD` jest **wy��cznie odczytywany**. Listy s� ��czone, deduplikowane i sortowane przed wyborem TOP 10 osobno dla ka�dego quizu. Historyczne wpisy bez oznaczenia quizu s� traktowane jako lektura, jak wcze�niej. Nie usuwa si� �adnych starych danych.

Origin s�u�y tylko do CORS. Nie jest dowodem rozwi�zania quizu. Limity s� trwa�e w Durable Object: 120 ��da�/min/IP, 60 zapis�w/min/IP, 12 nowych sesji/godz./IP; oczekuj�ca kolejka ma maksymalnie 32 ��dania. Rozmiar JSON jest ograniczony do 24 KB r�wnie� przy transmisji strumieniowej. IP jest haszowany przed zapisem klucza licznika. Alarm usuwa wygas�e sesje, bilety i liczniki, nigdy ranking.

**Granice ochrony:** publiczny bank pyta� nie zapewnia tajno�ci klucza ani dowodu samodzielnej pracy ucznia. Nie da si� dowolnie wpisa� punkt�w, ale nadal mo�na korzysta� ze �r�de� lub automatyzowa� poprawne odpowiedzi. Model j�zykowy nie gwarantuje odporno�ci na ka�d� manipulacj� odpowiedzi�. Historycznych wynik�w nie da si� zweryfikowa� wstecz i pozostaj� w rankingu. Pseudonim nie jest uwierzytelnionym kontem.

## API

| Endpoint | Dane |
| --- | --- |
| POST `/session` | `{quiz, nickname}`; domy�lny quiz `lektura` dla istniej�cego klienta |
| POST `/closed` | `{token, answers:[{id,value}]}` - komplet 6 pyta� I-III |
| POST `/grade` | `{token, section:'IV'|'V', answers:[{id,answer}]}` |
| POST `/answer` | `{token,id,answer}` - biologia |
| POST `/biology-grade` | `{token,id,answer}` - otwarte pytanie biologii |
| POST `/explain` | `{token,id}` - wyja�nienie dopiero po zatwierdzeniu odpowiedzi |
| POST `/finish` | `{token}` |
| POST `/leaderboard` | `{quiz,ticket}` |
| GET `/leaderboard?quiz=` | osobne TOP 10 |
| GET `/resume?quiz=` | stan serwera na podstawie ciasteczka HttpOnly |

Nie ma zgodno�ci z dawnym, niezabezpieczonym zapisem punkt�w biologii. Otwarte stare karty wymagaj� od�wie�enia po zmianie wersji. Nie nale�y utrzymywa� starego endpointu jako obej�cia.

## Powt�rka, notatniki i odzyskiwanie post�pu

- Przycisk "Prze�wicz b��dne odpowiedzi" pojawia si� **wewn�trz istniej�cej rozwijanej listy b��d�w**. U�ywa dotychczasowych klas. To jedyny nowy element uk�adu wynik�w, poza przyciskiem ponowienia zapisu widocznym wy��cznie po b��dzie.
- Powt�rka obejmuje b��dne pytania zamkni�te i odpowiedzi opisowe poni�ej maksimum. Po pr�bie pokazuje odpowied�/przyk�adowe rozwini�cie oraz wyja�nienie. Opisowe powt�rki s�u�� por�wnaniu z przyk�adem, nie otrzymuj� nowej oceny AI. Powt�rka nie wywo�uje API i nie zmienia rankingu.
- Notatki lektury dobierane s� do tre�ci bie��cego pytania po zatwierdzeniu, bez ponowienia przed wykorzystaniem talii. Biologia zachowuje materia�y do nauki dost�pne podczas pytania; filtr tematyczny i nast�pna notatka nie zmieniaj� pytania. Nie usuni�to �adnej notatki.
- `sessionStorage` przechowuje szkice odpowiedzi i identyfikatory pyta�, **bez token�w, bilet�w i ocen**. B��dy dost�pu do Web Storage nie przerywaj� quizu. Pseudonim i lokalne statystyki biologii pozostaj� w zabezpieczonym obs�ug� wyj�tk�w `localStorage`.
- Token w przegl�darce jest trzymany w pami�ci. Wznowienie korzysta z ciasteczka `Secure; HttpOnly; SameSite=None; Partitioned`; API u�ywa `credentials: include`. Po od�wie�eniu ocenione odpowiedzi i wynik s� odczytywane z serwera.
- Safari lub ustawienia prywatno�ci mog� blokowa� ciasteczka mi�dzy GitHub Pages a workers.dev. Wtedy aplikacja wyja�nia brak wznowienia, zachowuje szkic i pozwala zacz�� nowy zestaw. Pe�ne wznowienie w ka�dej przegl�darce wymaga API w tej samej witrynie (np. w�asna domena). R�wnoleg�a sesja w innej karcie nie jest automatycznie podstawiana w miejsce zapisanej.
- Po niepewnym wyniku ��dania AI tekst pozostaje zablokowany do ponowienia tej samej odpowiedzi; serwer m�g� j� ju� oceni�. Zapobiega to rozbie�no�ci tekstu i zapisanych punkt�w.

## Konfiguracja i bezpieczne wdro�enie

**Zmiany wymagaj� osobnego wdro�enia Cloudflare Worker. W ramach audytu nie wdra�ano backendu ani nie zmieniano produkcyjnych danych.**

1. Sprawd� obecne ustawienia `chlopcy-quiz-ai`, bindingi, identyfikator produkcyjnej przestrzeni KV i istniej�ce migracje Durable Objects. Wykonaj kopi� rankingu przed planowan� zmian�.
2. W `wrangler.toml` uzupe�nij zakomentowany binding `LEADERBOARD` identyfikatorem **istniej�cej** przestrzeni. Bez niego ranking zg�asza b��d konfiguracji zamiast pokazywa� pust� list�. Zachowaj istniej�ce dodatkowe ustawienia Workera. Nie wklejaj samego `worker.js` do edytora - importuje dwa modu�y.
3. Skonfiguruj binding AI `AI`, SQLite Durable Object `QUIZ` / `QuizCoordinator` i migracj� `quiz-v1` (upewnij si�, �e tag nie koliduje z istniej�cymi migracjami). Sekret OpenAI nie jest potrzebny: kod u�ywa Workers AI.
4. Testuj na odr�bnej konfiguracji staging z oddzielnym Durable Object i testowym KV; nie u�ywaj produkcyjnego KV do testowych zapis�w. Sprawd� AI na reprezentatywnych odpowiedziach i CORS/cookies w rzeczywistych urz�dzeniach.
5. Dopiero po zgodzie w�a�ciciela wdra�aj Workera, nast�pnie scalaj frontend w uzgodnionym oknie. Wcze�niejsze wdro�enie Workera czasowo odrzuci dawne zapisy biologii; nale�y od�wie�y� stare karty. Sam merge nie wdra�a Workera.
6. Powr�t do poprzedniego frontendu/backendu nie usuwa danych Durable Object, ale poprzedni backend nie pokazuje nowych wpis�w i ponownie otwiera dawn� luk�. Zaplanuj odwr�t bez przywracania niezabezpieczonego zapisu.

Koordynator jest �wiadomie prosty i obs�uguje niewielki portal: wolna ocena AI mo�e op��ni� inne ��dania. Przed u�yciem ca�ej klasy/szko�y dopasuj limity wsp��dzielonego IP, sprawd� obci��enie, bud�et Workers AI i ochron� brzegow� Cloudflare. Przy wi�kszym ruchu rozdziel sesje mi�dzy Durable Objects, zachowuj�c osobny transakcyjny koordynator rankingu, albo u�yj D1 z unikalnym identyfikatorem zatwierdzenia. Transakcyjno�� DO i ograniczenia KV opisuj� [dokumentacja DO](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) oraz [dokumentacja KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

## Testy

Wymagany Node.js 22 lub nowszy.

```sh
npm ci
npm test
npm run test:runtime
npx playwright install --with-deps chromium webkit
npm run test:browser
```

`npm run test:chromium` uruchamia profile komputera i Androida bez WebKit. Testy przegl�darkowe przechwytuj� ruch i uruchamiaj� prawdziwy kod Workera z mockiem AI oraz pami�ci; nie zapisuj� nic na produkcji. Test runtime u�ywa lokalnego workerd/SQLite. CI uruchamia oba zestawy na Linuxie i zachowuje obrazy/trace jako artefakt `browser-evidence`.

Test wizualny por�wnuje PNG przed i po z baz� `539c6330f27b3598c0d4317514d69603a09ec5c6`; wymaga historii Git (`fetch-depth: 0`). Dodatkowo testowane s� niezmienno�� CSS i statycznego HTML, zgodno�� bank�w, limity punkt�w, transakcje, powt�rki, notatki, awarie i odzyskiwanie sesji. Szczeg��owe wyniki oraz ograniczenia: [AUDIT.md](AUDIT.md).

