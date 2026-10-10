# Quiz „Chłopcy z Placu Broni”

Mobilny quiz dla uczniów. Bank zawiera 100 pytań (po 20 w pięciu sekcjach); jedna sesja losuje 10 pytań, po dwa z każdej sekcji. Uczeń podaje wyłącznie pseudonim.

## Strona

Quiz jest publikowany przez GitHub Pages:

https://sochagrzegorz.github.io/quiz/

Repozytorium: https://github.com/sochagrzegorz/chlopcy-z-placu-broni-quiz

Po zmianach w index.html GitHub Pages automatycznie przebuduje stronę.

Quiz biologiczny korzysta z endpointu `/grade` tego samego Workera. Po zmianach w `worker.js` opublikuj nową wersję Workera w Cloudflare; sam commit na GitHubie nie wdraża backendu.

## Backend AI i ranking

Quiz korzysta z Cloudflare Worker `chlopcy-quiz-ai` oraz OpenAI Responses API. Ocena AI w sekcji IV jest włączona. GitHub Pages obsługuje statyczne pliki, dlatego sekret `OPENAI_API_KEY` pozostaje po stronie Cloudflare.

Aby odtworzyć konfigurację:

1. Utwórz Workera w Cloudflare Workers & Pages i wklej kod z `worker.js`.
2. W ustawieniach dodaj sekret `OPENAI_API_KEY`.
3. Utwórz namespace Workers KV `chlopcy-quiz-ranking` i podłącz go do Workera jako binding `LEADERBOARD` (dla środowiska Production; Previews mogą używać tej samej przestrzeni).
4. Ustaw w `index.html` `AI_API_URL` na adres Workera zakończony `/grade`; endpoint `/leaderboard` jest tworzony automatycznie przez Worker.

Worker przechowuje do 100 najlepszych pseudonimów, a strona wyświetla TOP 10. Quiz biologiczny automatycznie wysyła wynik (maks. 13 pkt) oraz pseudonim po ukończeniu; quiz z lektury zachowuje przycisk ręcznego dodania wyniku. Publicznie widoczne są wyłącznie pseudonim i wynik. Odpowiedzi opisowe nie są zapisywane w rankingu. Lepszy wynik danego pseudonimu zastępuje słabszy.

Klucz OpenAI jest osobnym sekretem API. Skorzystaj z [oficjalnego przewodnika OpenAI API](https://developers.openai.com/api/docs/quickstart), by go utworzyć. Nie udostępniaj klucza uczniom. API przesyła do modelu wyłącznie dwie krótkie odpowiedzi i treść pytań — pseudonim nie jest wysyłany. Ocena AI (0–4 pkt) jest propozycją do sprawdzenia przez nauczyciela.

Worker ogranicza liczbę żądań na adres IP w obrębie aktywnego procesu. To podstawowa ochrona przed nadużyciami, a nie pełny system limitowania. Ustaw limit wydatków w panelu API i obserwuj użycie.

## Funkcje

- pięć sekcji: wybór odpowiedzi, prawda/fałsz, dopasowywanie, krótkie odpowiedzi, dłuższa wypowiedź;
- 10 losowych pytań na sesję — po dwa z każdej sekcji;
- punktowanie pytań z sekcji I–III;
- opcjonalna ocena AI dla krótkich odpowiedzi w sekcji IV;
- odpowiedź z sekcji V nadal ocenia nauczyciel;
- pseudonim zamiast imienia, nazwiska i klasy;
- przycisk rozpoczęcia nowej sesji;
- układ dostosowany do telefonu, inspirowany Placem Broni i węgierską flagą;
- opcjonalny, publiczny ranking TOP 10 z pseudonimami i wynikami;
- drukowanie lub zapis do PDF z przeglądarki.

Treść banku pytań przygotowano na podstawie lektury; pytania i odpowiedzi warto zweryfikować pod kątem wydania omawianego w klasie.

