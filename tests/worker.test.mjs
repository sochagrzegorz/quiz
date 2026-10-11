import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import worker, { gradeAnswer, nickname, QuizCoordinator } from '../worker.js';
import { biology, literature } from '../question-bank.js';
import { fixture } from './helpers.mjs';

async function complete(f, quiz='lektura') {
 const s=await f.start(quiz);
 if(quiz==='biologia') for(const id of s.picks.biology) { const q=biology.find(q=>q.id===id); assert.equal((await f.request('/answer',{token:s.token,id,answer:q.kind==='open'?'Przykładowa odpowiedź.':q.answer})).status,200); }
 else {
  const answers=['mcq','tf','match'].flatMap(k=>s.picks[k].map(id=>({id,value:literature[k].find(q=>q.id===id).correct})));
  assert.equal((await f.request('/closed',{token:s.token,answers})).data.points,6);
  for(const [section,key] of [['IV','short'],['V','essay']]) assert.equal((await f.request('/grade',{token:s.token,section,answers:s.picks[key].map(id=>({id,answer:'Przykładowa odpowiedź.'}))})).status,200);
 }
 return {s,result:(await f.request('/finish',{token:s.token})).data};
}
test('server banks exactly match existing HTML question pools',()=>{
 const bio=fs.readFileSync('biologia/index.html','utf8'),lit=fs.readFileSync('lektura/index.html','utf8');
 assert.equal(JSON.stringify(vm.runInNewContext(bio.slice(bio.indexOf('const bank='),bio.indexOf('let session='))+'\nbank')),JSON.stringify(biology));
 assert.equal(JSON.stringify(vm.runInNewContext(lit.slice(lit.indexOf('const mcq='),lit.indexOf('const API_BASE='))+'\npools')),JSON.stringify(literature));
});
test('biology questions carry source context and every choice question has one unique correct option',()=>{
 assert.equal(biology.length,100); assert.equal(biology.filter(q=>q.kind==='choice').length,70); assert.equal(biology.filter(q=>q.kind==='open').length,30);
 for(const q of biology){assert.ok(q.sourcePhotos?.length,q.id+' source');assert.ok(q.sourceReferences?.length,q.id+' reference');assert.ok(q.hintContext?.length,q.id+' hint context');}
 const norm=s=>String(s).toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.,!?;:()\"']/g,'').replace(/\s+/g,' ').trim();
 for(const q of biology.filter(q=>q.kind==='choice')){assert.equal(new Set(q.choices.map(norm)).size,4,q.id+' distinct options');assert.equal(q.choices.filter(c=>norm(c)===norm(q.answer)).length,1,q.id+' one correct option');}
});
test('CSS, homepage, static markup and notes are retained',()=>{
 assert.equal(fs.readFileSync('index.html','utf8').replaceAll('\r\n','\n'),execFileSync('git',['show','539c633:index.html'],{encoding:'utf8'}).replaceAll('\r\n','\n'));
 for(const file of ['biologia/index.html','lektura/index.html']){
  const before=execFileSync('git',['show',`539c633:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n'),after=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
  const beforeStyles=before.match(/<style>[\s\S]*?<\/style>/g),afterStyles=after.match(/<style>[\s\S]*?<\/style>/g);
  let checkedStyles=afterStyles; let checkedMarkup=after.slice(0,after.indexOf('<script'));
  if(file==='biologia/index.html'){checkedStyles=afterStyles.map(css=>css.replace('.hint-controls{margin:0 0 12px}.hint-area{margin:0 0 16px;padding:13px 15px;border-left:3px solid #8b79a5;border-radius:0 9px 9px 0;background:#f1edf6;color:#403452;font-size:14px;line-height:1.55}',''));checkedMarkup=checkedMarkup.replace('.hint-controls{margin:0 0 12px}.hint-area{margin:0 0 16px;padding:13px 15px;border-left:3px solid #8b79a5;border-radius:0 9px 9px 0;background:#f1edf6;color:#403452;font-size:14px;line-height:1.55}','').replace(/<div class="hint-controls">[\s\S]*?<\/div><div class="hint-area"[^>]*><\/div>/,'');}
  assert.deepEqual(checkedStyles,beforeStyles);
  assert.equal(checkedMarkup,before.slice(0,before.indexOf('<script')));
 }
});
test('random sessions have unique tokens and correct selection counts',async()=>{
 const f=fixture(),a=await f.start(),b=await f.start('biologia');assert.notEqual(a.token,b.token);
 for(const ids of Object.values(a.picks)){assert.equal(ids.length,2);assert.equal(new Set(ids).size,2)}
 const selected=b.picks.biology.map(id=>biology.find(q=>q.id===id));assert.equal(selected.filter(q=>q.kind==='open').length,3);assert.equal(selected.filter(q=>q.kind==='choice').length,7);
});
test('biology avoids recent question ids and semantic groups while retaining 7+3', async () => {
 const f=fixture(), history=biology.slice(0,30).map(q=>q.id), started=await f.request('/session',{quiz:'biologia',nickname:'Historia',history});
 assert.equal(started.status,200); const selected=started.data.picks.biology.map(id=>biology.find(q=>q.id===id));
 assert.equal(selected.length,10); assert.equal(new Set(selected.map(q=>q.id)).size,10);
 assert.equal(selected.filter(q=>q.kind==='choice').length,7); assert.equal(selected.filter(q=>q.kind==='open').length,3);
 assert.ok(selected.every(q=>!history.includes(q.id)));
 const groups=selected.flatMap(q=>q.similarGroups||[]); assert.equal(groups.length,new Set(groups).size);
});
test('each biology question has an individual, concise saved hint',()=>{
 assert.equal(biology.length,100);assert.equal(biology.filter(q=>q.kind==='choice').length,70);assert.equal(biology.filter(q=>q.kind==='open').length,30);
 const normalized=s=>s.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 for(const q of biology){
  assert.ok(typeof q.hint==='string'&&q.hint.trim(),q.id+' hint');
  assert.ok(q.hint.length<=350,q.id+' concise hint');
  assert.ok(!/poprawna odpowiedź to|odpowiedź to|wybierz [abcd][.)]/i.test(q.hint),q.id+' answer disclosure');
  assert.ok(!normalized(q.hint).includes(normalized(q.answer)),q.id+' complete answer disclosure');
  if(q.explanation)assert.notEqual(normalized(q.hint),normalized(q.explanation),q.id+' duplicates explanation');
  assert.ok(q.sourceReferences?.length&&q.hintContext?.length,q.id+' source basis');
 }
 assert.equal(new Set(biology.map(q=>q.hint)).size,100,'each question has its own hint');
});
test('nickname validation rejects control characters, markup and long input',()=>{for(const value of [null,'','<b>','x\u007f','x\u202e','a'.repeat(25)])assert.throws(()=>nickname(value));assert.equal(nickname('  Żółw  5 '),'Żółw 5')});
test('literature I–V total is 20; finish is repeatable',async()=>{const f=fixture(),{s,result}=await complete(f);assert.equal(result.points,20);assert.equal(result.shortScore,4);assert.equal(result.essayScore,10);assert.deepEqual((await f.request('/finish',{token:s.token})).data,result)});
test('biology total is 13 with three open questions',async()=>{const f=fixture(),{result}=await complete(f,'biologia');assert.equal(result.points,13);assert.equal(result.maxPoints,13)});
test('forged scores and fabricated tickets are rejected',async()=>{const f=fixture();assert.equal((await f.request('/leaderboard',{quiz:'biologia',nickname:'X',points:13,maxPoints:13})).status,400);assert.equal((await f.request('/leaderboard',{quiz:'lektura',ticket:crypto.randomUUID()})).status,410)});
test('missing token is rejected even with allowed Origin',async()=>{const f=fixture();assert.equal((await f.request('/grade',{section:'IV',answers:[]})).status,401)});
test('unknown section rejected in valid session',async()=>{const f=fixture(),s=await f.start();assert.equal((await f.request('/grade',{token:s.token,section:'INVALID'})).status,400)});
test('wrong Origin rejected; Origin absence does not authenticate',async()=>{const f=fixture();assert.equal((await f.request('/session',{nickname:'X'},{Origin:'https://bad.test'})).status,403);assert.equal((await f.request('/finish',{}, {Origin:''})).status,401)});
test('unselected questions and wrong types cannot be submitted',async()=>{const f=fixture(),s=await f.start('biologia');assert.equal((await f.request('/answer',{token:s.token,id:'invented',answer:'yes'})).status,400);const id=s.picks.biology.find(id=>biology.find(q=>q.id===id).kind==='choice');assert.equal((await f.request('/answer',{token:s.token,id,answer:13})).status,400)});
test('early finish and cross-quiz endpoints are rejected',async()=>{const f=fixture(),s=await f.start();assert.equal((await f.request('/finish',{token:s.token})).status,409);assert.equal((await f.request('/answer',{token:s.token,id:'s0',answer:'x'})).status,400)});
test('expiry enforced and cleanup retains legacy and ranking data',async()=>{const f=fixture(),s=await f.start();const saved=await f.storage.get('session:'+s.token);saved.expires=Date.now()-1;await f.storage.put('session:'+s.token,saved);await f.storage.put('ranking:lektura',[{nickname:'History'}]);assert.equal((await f.request('/finish',{token:s.token})).status,410);await f.coordinator.alarm();assert.equal(await f.storage.get('session:'+s.token),undefined);assert.ok(await f.storage.get('ranking:lektura'))});
test('resume uses HttpOnly secure cookie; does not accept browser points',async()=>{const f=fixture(),start=await f.request('/session',{nickname:'X',quiz:'lektura'});assert.match(start.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=None; Partitioned/);const resumed=await f.request('/resume?quiz=lektura',undefined,{Cookie:'quiz_lektura='+start.data.token});assert.equal(resumed.data.token,start.data.token);assert.equal((await f.request('/resume?quiz=biologia',undefined,{Cookie:'quiz_biologia='+start.data.token})).status,401)});
test('same answer concurrent retries invoke AI only once',async()=>{const f=fixture(),s=await f.start('biologia'),id=s.picks.biology.find(id=>biology.find(q=>q.id===id).kind==='open');const request={token:s.token,id,answer:'Odpowiedź ucznia.'};const replies=await Promise.all([f.request('/biology-grade',request),f.request('/biology-grade',request)]);assert.equal(f.calls.length,1);assert.deepEqual(replies[0].data,replies[1].data);assert.equal((await f.request('/biology-grade',{...request,answer:'Inna odpowiedź'})).status,409)});
test('client question and expected answer never reach model',async()=>{const f=fixture(),s=await f.start('biologia'),id=s.picks.biology.find(id=>biology.find(q=>q.id===id).kind==='open');await f.request('/biology-grade',{token:s.token,id,answer:'Moja odpowiedź.',question:'HACKED',expected_answer:'HACKED'});const payload=JSON.parse(f.calls[0].messages[1].content);assert.equal(payload.question,biology.find(q=>q.id===id).text);assert.ok(!JSON.stringify(payload).includes('HACKED'));assert.match(f.calls[0].messages[0].content,/literówki/)});
for(const max of [2,5])test(`reject invalid AI score for maximum ${max}`,async()=>{const q={kind:max===5?'essay':'short',q:'Pytanie?'};await assert.rejects(()=>gradeAnswer(q,'odpowiedź',{AI:{run:async()=>({response:{score:max+1,feedback:'OK'}})}}),{status:502})});
for(const response of [null,{},'garbage',{score:1.5,feedback:'x'},{score:1,feedback:''}])test('malformed model response fails safely '+JSON.stringify(response),async()=>{await assert.rejects(()=>gradeAnswer({kind:'short',q:'Pytanie?'},'Odpowiedź',{AI:{run:async()=>({response})}}))});
test('empty answer scores zero without invoking AI',async()=>{const f=fixture();assert.equal((await gradeAnswer({kind:'short'},'',f.env)).score,0);assert.equal(f.calls.length,0)});
test('AI timeout and outage return retryable errors',async()=>{const q={kind:'short',q:'Pytanie?'};await assert.rejects(()=>gradeAnswer(q,'Odpowiedź',{AI_TIMEOUT_MS:5,AI:{run:()=>new Promise(()=>{})}}),{status:503});await assert.rejects(()=>gradeAnswer(q,'Odpowiedź',{}),{status:503})});
test('long input rejected before AI',async()=>{const f=fixture(),s=await f.start(),body={token:s.token,section:'IV',answers:s.picks.short.map(id=>({id,answer:'a'.repeat(1801)}))};assert.equal((await f.request('/grade',body)).status,400);assert.equal(f.calls.length,0)});
test('partial AI batch failure reuses already persisted first grade',async()=>{let count=0;const f=fixture({ai:async()=>{if(++count===2)throw Error('offline');return {response:{score:2,feedback:'OK'}}}}),s=await f.start(),body={token:s.token,section:'IV',answers:s.picks.short.map(id=>({id,answer:'Moja odpowiedź.'}))};assert.equal((await f.request('/grade',body)).status,503);assert.equal((await f.request('/grade',body)).data.total,4);assert.equal(count,3)});
test('duplicate ids rejected before evaluation',async()=>{const f=fixture(),s=await f.start();assert.equal((await f.request('/grade',{token:s.token,section:'IV',answers:[1,2].map(()=>({id:s.picks.short[0],answer:'X'}))})).status,400);assert.equal(f.calls.length,0)});
test('one ticket saves once even concurrently and survives object recreation',async()=>{const f=fixture(),{result}=await complete(f);const body={quiz:'lektura',ticket:result.ticket};const out=await Promise.all([f.request('/leaderboard',body),f.request('/leaderboard',body)]);assert.deepEqual(out[0].data,out[1].data);assert.equal((await f.storage.list({prefix:'entry:lektura:'})).size,1);f.env.QUIZ.get=()=>new QuizCoordinator({storage:f.storage},f.env);assert.deepEqual((await f.request('/leaderboard',body)).data,out[0].data);assert.equal((await f.request('/leaderboard',{...body,quiz:'biologia'})).status,400)});
test('legacy TOP 10 sorted independently for each quiz, no KV writes',async()=>{const legacy=Array.from({length:15},(_,i)=>({nickname:'L'+i,points:i,maxPoints:20})).concat([{nickname:'Bio',quiz:'biologia',points:13,maxPoints:13}]);const f=fixture({legacy});const lit=await f.request('/leaderboard?quiz=lektura'),bio=await f.request('/leaderboard?quiz=biologia');assert.equal(lit.data.entries.length,10);assert.equal(lit.data.entries[0].points,14);assert.equal(bio.data.entries.length,1);assert.equal(f.legacy.length,16)});
test('rate limits are durable across requests and reject excess starts',async()=>{const f=fixture();for(let i=0;i<12;i++)assert.equal((await f.request('/session',{nickname:'X'})).status,200);assert.equal((await f.request('/session',{nickname:'X'})).status,429)});
test('oversize bodies, null JSON and invalid quiz rejected',async()=>{const f=fixture();assert.equal((await f.request('/session',{nickname:'x'.repeat(25000)})).status,413);assert.equal((await f.request('/session',null)).status,400);assert.equal((await f.request('/leaderboard?quiz=bad')).status,400)});
test('missing backend fails closed',async()=>{const r=await worker.fetch(new Request('https://quiz.test/session',{method:'POST',body:'{}'}),{});assert.equal(r.status,503)});
