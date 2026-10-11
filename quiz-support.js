/* Shared nonvisual helpers. No server tokens or grades are stored in Web Storage. */
window.QuizSupport = {
  storage: {
    getItem(key) { try { return localStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { try { localStorage.setItem(key, value); } catch {} }
  },
  draft(key, value) {
    try {
      if (arguments.length > 1) { sessionStorage.setItem(key, JSON.stringify(value)); return; }
      return JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch { return null; }
  },
  async request(base, path, body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch(base + path, { credentials: 'include', signal: controller.signal,
        ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Backend jest chwilowo niedostępny. Ponów próbę.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Przekroczono czas oczekiwania. Ponów próbę — odpowiedź została zachowana.');
      throw error;
    } finally { clearTimeout(timer); }
  },
  // Practice never calls a grading/ranking API; model answers are revealed only after submitting.
  review(host, items, buttonClass) {
    if (!items.length) return;
    const launch = document.createElement('button'); launch.type = 'button'; launch.className = buttonClass;
    launch.textContent = 'Przećwicz błędne odpowiedzi (' + items.length + ')';
    launch.onclick = () => {
      let position = 0;
      function render() {
        host.replaceChildren();
        const item = items[position], card = document.createElement('article'), title = document.createElement('strong');
        card.className = 'mistake-item'; title.textContent = (position + 1) + '/' + items.length + ' · ' + item.question; card.append(title);
        const input = document.createElement(item.options ? 'select' : 'textarea');
        input.className = item.options ? '' : 'answer'; input.setAttribute('aria-label', 'Twoja odpowiedź w powtórce');
        if (item.options) for (const text of ['', ...item.options]) { const option = document.createElement('option'); option.value = text; option.textContent = text || 'Wybierz odpowiedź'; input.append(option); }
        else input.maxLength = 5000;
        const submit = document.createElement('button'); submit.type = 'button'; submit.className = buttonClass; submit.textContent = 'Sprawdź próbę';
        const feedback = document.createElement('p'); feedback.setAttribute('aria-live', 'polite');
        submit.onclick = () => {
          if (!input.value.trim()) { feedback.textContent = 'Najpierw wpisz lub wybierz odpowiedź.'; return; }
          input.disabled = true; submit.disabled = true;
          feedback.textContent = (item.options ? (input.value === item.answer ? 'Dobrze! ' : 'Spróbuj zapamiętać: ') : 'Porównaj swoją odpowiedź z przykładem. ') + item.answer + ' ' + (item.explanation || '') + ' Powtórka nie zmienia rankingu.';
          const next = document.createElement('button'); next.type = 'button'; next.className = buttonClass; next.textContent = position + 1 < items.length ? 'Następne pytanie' : 'Zakończ powtórkę';
          next.onclick = () => { if (++position < items.length) render(); else { host.textContent = 'Powtórka zakończona. Wynik pełnego quizu pozostał bez zmian.'; host.append(launch); } }; card.append(next);
        };
        card.append(input, submit, feedback); host.append(card);
      }
      render();
    };
    host.append(launch);
  }
};
