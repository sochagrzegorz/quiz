import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const ORIGIN = 'https://sochagrzegorz.github.io';
const BASE = 'https://example.workers.dev';
const headers = { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.42' };

function request(path, body, extraHeaders = {}) {
  return new Request(BASE + path, { method: 'POST', headers: { ...headers, ...extraHeaders }, body: JSON.stringify(body) });
}
function fakeAI(score, maxPoints, ids) {
  return { AI: { run: async () => ({ response: JSON.stringify({
    results: ids.map(id => ({ id, score, feedback: 'Informacja zwrotna' })),
    total: score * ids.length, max_points: maxPoints, summary: 'Ocena'
  }) }) } };
}
const answers = [
  { id: 'e1', question: 'Omów zachowanie bohatera i uzasadnij.', answer: 'Bohater postąpił odważnie, ponieważ bronił przyjaciół.' },
  { id: 'e2', question: 'Wyjaśnij przesłanie powieści.', answer: 'Powieść mówi o przyjaźni, lojalności i poświęceniu.' }
];

test('sekcja V: 5 + 5 = 10 punktów', async () => {
  const res = await worker.fetch(request('/grade', { section: 'V', answers }), fakeAI(5, 10, ['e1', 'e2']));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.max_points, 10);
  assert.equal(data.total, 10);
});
test('sekcja IV: 2 + 2 = 4 punkty', async () => {
  const res = await worker.fetch(request('/grade', { section: 'IV', answers }), fakeAI(2, 4, ['e1', 'e2']));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).total, 4);
});
test('sekcja V: odrzuca oceny powyżej 5', async () => {
  const res = await worker.fetch(request('/grade', { section: 'V', answers }), fakeAI(6, 10, ['e1', 'e2']));
  assert.equal(res.status, 502);
});
test('sekcja IV: odrzuca oceny powyżej 2', async () => {
  const res = await worker.fetch(request('/grade', { section: 'IV', answers }), fakeAI(3, 4, ['e1', 'e2']));
  assert.equal(res.status, 502);
});
test('odrzuca nieznaną sekcję', async () => {
  const res = await worker.fetch(request('/grade', { section: 'INVALID', answers }), fakeAI(2, 4, ['e1', 'e2']));
  assert.equal(res.status, 400);
});
test('odrzuca niepoprawny origin', async () => {
  const res = await worker.fetch(request('/grade', { section: 'IV', answers }, { Origin: 'https://example.org' }), fakeAI(2, 4, ['e1', 'e2']));
  assert.equal(res.status, 403);
});
test('ranking odrzuca błędną punktację maksymalną', async () => {
  const env = { LEADERBOARD: { get: async () => [], put: async () => {} } };
  const res = await worker.fetch(request('/leaderboard', { nickname: 'Uczen', quiz: 'lektura', points: 13, maxPoints: 13 }), env);
  assert.equal(res.status, 400);
});
