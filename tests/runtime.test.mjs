import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { biology } from '../question-bank.js';

test('real workerd: SQLite Durable Object sessions, grading, concurrent tickets and persistent rate limits',async()=>{
 const mf=new Miniflare({workers:[{modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:'worker.js',compatibilityDate:'2026-07-01',durableObjects:{QUIZ:{className:'QuizCoordinator',useSQLite:true}},kvNamespaces:['LEADERBOARD']}]});
 try{
  const call=async(path,body)=>{
   const r=await mf.dispatchFetch('https://quiz.test'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','Origin':'https://sochagrzegorz.github.io','CF-Connecting-IP':'192.0.2.4'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   return {status:r.status,data:await r.json()};
  };
  const namespace=await mf.getKVNamespace('LEADERBOARD');await namespace.put('leaderboard',JSON.stringify([{nickname:'Historyczny',points:10,maxPoints:20}]));
  const started=await call('/session',{quiz:'biologia',nickname:'Runtime'});assert.equal(started.status,200);const s=started.data;
  for(const id of s.picks.biology){const q=biology.find(q=>q.id===id);const result=await call('/answer',{token:s.token,id,answer:q.kind==='choice'?q.answer:''});assert.equal(result.status,200)}
  const completed=await call('/finish',{token:s.token});assert.equal(completed.data.points,7);assert.equal(completed.data.maxPoints,13);
  const responses=await Promise.all([call('/leaderboard',{quiz:'biologia',ticket:completed.data.ticket}),call('/leaderboard',{quiz:'biologia',ticket:completed.data.ticket})]);assert.equal(responses[0].status,200);assert.deepEqual(responses[0],responses[1]);
  assert.equal((await call('/leaderboard?quiz=biologia')).data.entries.length,1);
  assert.equal((await call('/leaderboard?quiz=lektura')).data.entries[0].nickname,'Historyczny');
  assert.equal(JSON.parse(await namespace.get('leaderboard')).length,1);
  for(let i=1;i<12;i++)assert.equal((await call('/session',{quiz:'biologia',nickname:'Rate'})).status,200);
  assert.equal((await call('/session',{quiz:'biologia',nickname:'Rate'})).status,429);
 }finally{await mf.dispose()}
});



