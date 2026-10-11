let bioToken = '', bioResult = null, starting = false, finishing = false;
const bioBase = AI_API_URL.replace(/\/grade$/, '');
const bioApi = (path, body) => QuizSupport.request(bioBase, path, body);
function saveBioDraft() { QuizSupport.draft('bio-progress', { nickname: playerNickname, picks: session.map(q => q.id), values: answers.map(a => a?.value ?? null), index }); }
function installBioSession(data) {
  if (!Array.isArray(data.picks?.biology) || data.picks.biology.length !== 10 || new Set(data.picks.biology).size !== 10 || data.picks.biology.some(id => !bank.some(q => q.id === id))) throw new Error('Nieprawid�owy zestaw pyta� serwera.');
  bioToken = data.token; bioResult = data.result || null; sessionVersion++; gradePending = false; finished = false;
  session = data.picks.biology.map(id => { const q = { ...bank.find(q => q.id === id) }; if (q.kind === 'choice') q.options = makeOptions(q); return q; });
  const draft = QuizSupport.draft('bio-progress'), same = draft && JSON.stringify(draft.picks) === JSON.stringify(data.picks.biology);
  answers = session.map((q, i) => {
    const a = data.answers?.[q.id], value = same ? draft.values?.[i] : null;
    if (!a) return value == null ? null : { value };
    return { value: q.fields && value && typeof value === 'object' ? value : a.value, checked: true, rated: q.kind === 'open', points: a.score, correct: a.score === a.max, aiFeedback: a.feedback };
  });
  index = answers.findIndex(a => !a?.checked); if (index < 0) index = 9;
  orderState = []; renderQ(); show('play');
}
start = async function () {
  if (starting) return;
  const name = $('nickname').value.trim().replace(/\s+/g, ' ');
  if (!name || [...name].length > 24 || /[<>\u0000-\u001f\u007f]/.test(name)) { $('nicknameError').textContent = 'Wpisz pseudonim: 1-24 znaki, bez znak�w steruj�cych, < i >.'; $('nicknameError').hidden = false; return; }
  starting = true; $('startBtn').disabled = true; $('nextRoundBtn').disabled = true;
  try {
    const data = await bioApi('/session', { quiz: 'biologia', nickname: name, history: loadQuestionHistory() });
    playerNickname = name; QuizSupport.storage.setItem('bioQuizNickname', name); saveQuestionHistory(data.picks.biology); installBioSession(data); saveBioDraft(); $('nicknameError').hidden = true;
  } catch (error) { $('nicknameError').hidden = false; $('nicknameError').textContent = error.message; $('rankingStatus').textContent = error.message; }
  finally { starting = false; $('startBtn').disabled = false; $('nextRoundBtn').disabled = false; }
};
check = async function (value) {
  const q = session[index], current = index, version = sessionVersion;
  if (!q || q.kind !== 'choice' || finished || gradePending || answers[index]?.checked) return;
  value ??= answers[index]?.value;
  if (!value) { $('feedback').className = 'feedback show bad'; $('feedback').textContent = 'Wybierz odpowied�.'; return; }
  gradePending = true; $('checkBtn').disabled = true;
  try {
    const data = await bioApi('/answer', { token: bioToken, id: q.id, answer: value }), grade = data.results?.[0];
    if (version !== sessionVersion || current !== index) return;
    if (!grade || grade.id !== q.id || ![0, 1].includes(grade.score)) throw new Error('Nieprawid�owa odpowied� serwera.');
    answers[index] = { value, checked: true, points: grade.score, correct: grade.score === 1 }; renderQ(); saveBioDraft();
  } catch (error) { if (version === sessionVersion) { $('feedback').className = 'feedback show bad'; $('feedback').textContent = error.message; } }
  finally { if (version === sessionVersion) gradePending = false; $('checkBtn').disabled = false; }
};
const displayBioFinish = finish;
finish = async function () {
  if (finished || finishing || session.length !== 10 || answers.some(a => !a?.checked)) return;
  finishing = true; $('nextBtn').disabled = true;
  try {
    bioResult = await bioApi('/finish', { token: bioToken });
    if (bioResult.maxPoints !== 13 || !Number.isInteger(bioResult.points) || bioResult.points < 0 || bioResult.points > 13) throw new Error('Nieprawid�owy wynik serwera.');
    displayBioFinish();
    const misses = session.map((q, i) => ({ q, a: answers[i] })).filter(({ q, a }) => (a.points ?? 0) < (q.kind === 'open' ? 2 : 1));
    $('mistakeCount').textContent = '(' + misses.length + ')';
    if (misses.length && misses.every(({ q }) => q.kind === 'open')) $('mistakeList').textContent = 'Warto prze�wiczy� odpowiedzi opisowe.';
    if (misses.some(({ q }) => q.kind === 'open')) { const p = document.createElement('p'); p.textContent = 'Powt�rka obejmuje r�wnie� niepe�ne odpowiedzi opisowe.'; $('mistakeList').append(p); }
    QuizSupport.review($('mistakeList'), misses.map(({ q, a }) => ({ question: q.text, options: q.choices, answer: q.answer, explanation: q.explanation || a.aiFeedback })), 'btn secondary');
  } catch (error) { $('feedback').className = 'feedback show bad'; $('feedback').textContent = error.message; }
  finally { finishing = false; $('nextBtn').disabled = false; }
};
recordRanking = async function () {
  try {
    const result = await bioApi('/leaderboard', { quiz: 'biologia', ticket: bioResult.ticket });
    $('rankingStatus').textContent = result.saved ? 'Wynik zapisany w rankingu.' : 'Tw�j lepszy wynik jest ju� zapisany w rankingu.';
    await renderRankings();
  } catch (error) {
    $('rankingStatus').textContent = error.message + ' ';
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn secondary'; retry.textContent = 'Pon�w zapis';
    retry.onclick = () => { retry.disabled = true; recordRanking(); }; $('rankingStatus').append(retry);
  }
};

function loadQuestionHistory() { try { const ids = JSON.parse(QuizSupport.storage.getItem('bioQuestionHistory') || '[]'); return Array.isArray(ids) ? ids.filter(id => typeof id === 'string').slice(-100) : []; } catch { return []; } }
function saveQuestionHistory(ids) { QuizSupport.storage.setItem('bioQuestionHistory', JSON.stringify([...loadQuestionHistory(), ...ids].slice(-100))); }
function updateHintForQuestion() {
  const q = session[index], button = $('hintBtn'), area = $('hintArea');
  if (!button || !area) return;
  button.hidden = !q;
  button.disabled = !q?.hint;
  area.hidden = !q?.hintOpened;
  area.textContent = q?.hintOpened ? q.hint : '';
}
const renderBioQuestion = renderQ;
renderQ = function () { renderBioQuestion(); updateHintForQuestion(); };
$('hintBtn').onclick = () => {
  const q = session[index];
  if (!q?.hint) return;
  q.hintOpened = true;
  updateHintForQuestion();
};

// Keep topic pools stable between related questions and avoid an immediate repeat.
const originalChooseTopic = chooseNoteTopic;
chooseNoteTopic = function (topic) {
  const old = notePool[notePosition]?.id; originalChooseTopic(topic);
  if (notePool.length > 1 && notePool[notePosition]?.id === old) { notePosition = (notePosition + 1) % notePool.length; renderNotebook(); }
};
syncNotebook = function(q) {
  const key = q?.id ?? null, topic = noteTopicFor(q);
  if (noteQuestionKey === key) return;
  noteQuestionKey = key;
  if ($('noteTopic').value === topic) { notePosition = (notePosition + 1) % notePool.length; renderNotebook(); }
  else chooseNoteTopic(topic);
};
$('startBtn').onclick = start; $('nextRoundBtn').onclick = start; $('checkBtn').onclick = () => check();
document.addEventListener('input', saveBioDraft);
window.addEventListener('pagehide', saveBioDraft);
(async () => {
  if (!QuizSupport.draft('bio-progress')) return;
  $('startBtn').disabled = true;
  try {
    const data = await bioApi('/resume?quiz=biologia');
    if (JSON.stringify(data.picks.biology) !== JSON.stringify(QuizSupport.draft('bio-progress')?.picks)) throw new Error('Sesja nale�y do innej karty.');
    playerNickname = data.nickname; $('nickname').value = data.nickname; installBioSession(data);
    if (data.result) await finish();
  } catch { $('nicknameError').hidden = false; $('nicknameError').textContent = 'Nie mo�na wznowi� sesji (mog�a wygasn�� lub przegl�darka blokuje ciasteczko). Rozpocznij nowy zestaw. Szkic odpowiedzi pozostaje w tej karcie.'; }
  finally { $('startBtn').disabled = false; }
})();

