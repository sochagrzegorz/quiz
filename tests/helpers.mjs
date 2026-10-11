import worker, { QuizCoordinator } from '../worker.js';
export class MemoryStorage {
  constructor() { this.data = new Map(); this.alarm = null; }
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key); }
  async getAlarm() { return this.alarm; }
  async setAlarm(value) { this.alarm = value; }
  async list({ prefix, limit = 500, startAfter } = {}) { return new Map([...this.data].filter(([k]) => k.startsWith(prefix) && (!startAfter || k > startAfter)).sort(([a], [b]) => a.localeCompare(b)).slice(0, limit)); }
  async transaction(callback) { const old = structuredClone(this.data); try { return await callback(this); } catch (error) { this.data = old; throw error; } }
}
export function fixture(options = {}) {
  const storage = new MemoryStorage(), calls = [], legacy = options.legacy || [];
  const env = { AI_TIMEOUT_MS: options.timeout || 1000, LEADERBOARD: { get: async () => structuredClone(legacy), put: async () => { throw new Error('Never mutate legacy KV'); } }, AI: { run: async (model, input) => { calls.push(input); if (options.ai) return options.ai(input); return { response: { score: options.score ?? input.response_format.json_schema.properties.score.maximum, feedback: 'Dobra odpowied�. Sprawd� przyk�ad.' } }; } } };
  const coordinator = new QuizCoordinator({ storage }, env);
  env.QUIZ = { idFromName: name => name, get: () => coordinator };
  const request = async (path, body, headers = {}) => {
    const response = await worker.fetch(new Request('https://quiz.test' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'https://sochagrzegorz.github.io', 'CF-Connecting-IP': '192.0.2.1', 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
    return { status: response.status, data: await response.json(), headers: response.headers };
  };
  const start = async (quiz = 'lektura', nickname = 'Ucze�') => (await request('/session', { quiz, nickname })).data;
  return { storage, env, coordinator, calls, request, start, legacy };
}

