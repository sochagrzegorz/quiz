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
      if (!response.ok) throw new Error(data.error || 'Backend jest chwilowo niedost�pny. Pon�w pr�b�.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Przekroczono czas oczekiwania. Pon�w pr�b� - odpowied� zosta�a zachowana.');
      throw error;
    } finally { clearTimeout(timer); }
  },
  // Practice never calls a grading/ranking API; model answers are revealed only after submitting.
  review(host, items, buttonClass) {
    if (!items.length) return;
    const launch = document.createElement('button'); launch.type = 'button'; launch.className = buttonClass;
    launch.textContent = 'Prze�wicz b��dne odpowiedzi (' + items.length + ')';
    launch.onclick = () => {
      let position = 0;
      function render() {
        host.replaceChildren();
        const item = items[position], card = document.createElement('article'), title = document.createElement('strong');
        card.className = 'mistake-item'; title.textContent = (position + 1) + '/' + items.length + '  ' + item.question; card.append(title);
        const input = document.createElement(item.options ? 'select' : 'textarea');
        input.className = item.options ? '' : 'answer'; input.setAttribute('aria-label', 'Twoja odpowied� w powt�rce');
        if (item.options) for (const text of ['', ...item.options]) { const option = document.createElement('option'); option.value = text; option.textContent = text || 'Wybierz odpowied�'; input.append(option); }
        else input.maxLength = 5000;
        const submit = document.createElement('button'); submit.type = 'button'; submit.className = buttonClass; submit.textContent = 'Sprawd� pr�b�';
        const feedback = document.createElement('p'); feedback.setAttribute('aria-live', 'polite');
        submit.onclick = () => {
          if (!input.value.trim()) { feedback.textContent = 'Najpierw wpisz lub wybierz odpowied�.'; return; }
          input.disabled = true; submit.disabled = true;
          feedback.textContent = (item.options ? (input.value === item.answer ? 'Dobrze! ' : 'Spr�buj zapami�ta�: ') : 'Por�wnaj swoj� odpowied� z przyk�adem. ') + item.answer + ' ' + (item.explanation || '') + ' Powt�rka nie zmienia rankingu.';
          const next = document.createElement('button'); next.type = 'button'; next.className = buttonClass; next.textContent = position + 1 < items.length ? 'Nast�pne pytanie' : 'Zako�cz powt�rk�';
          next.onclick = () => { if (++position < items.length) render(); else { host.textContent = 'Powt�rka zako�czona. Wynik pe�nego quizu pozosta� bez zmian.'; host.append(launch); } }; card.append(next);
        };
        card.append(input, submit, feedback); host.append(card);
      }
      render();
    };
    host.append(launch);
  }
};

