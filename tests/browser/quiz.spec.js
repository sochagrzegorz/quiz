import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fixture } from '../helpers.mjs';
import worker from '../../worker.js';
const root='https://sochagrzegorz.github.io/quiz/';
async function setup(page,{baseline=false,score=1,offline=false,ai}={}) {
 const f=fixture({score,ai}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{let seed=42;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296)});
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname==='chlopcy-quiz-ai.sochagrzegorz.workers.dev') {
   if(offline)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Backend chwilowo niedost�pny.'}),headers:{'Access-Control-Allow-Origin':'https://sochagrzegorz.github.io','Access-Control-Allow-Credentials':'true'}});
   const response=await worker.fetch(new Request(request.url(),{method:request.method(),headers:{...await request.allHeaders(),'CF-Connecting-IP':'192.0.2.2'},...(request.postData()?{body:request.postData()}: {})}),f.env);
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  if(request.url().startsWith(root)) {
   let path=decodeURIComponent(url.pathname.slice('/quiz/'.length));if(!path||path.endsWith('/'))path+='index.html';
   let body;try{body=baseline?execFileSync('git',['show','539c633:'+path],{encoding:'utf8',stdio:['ignore','pipe','ignore']}):fs.readFileSync(path,'utf8')}catch{return route.fulfill({status:404,body:'Not found'})}
   return route.fulfill({status:200,contentType:path.endsWith('.js')?'text/javascript':'text/html',body});
  }
  return route.abort();
 });
 return {f,errors};
}
for(const path of ['', 'biologia/', 'lektura/']) test('identical initial screenshot '+(path||'home'),async({page,browser},info)=>{
 await setup(page,{baseline:true});await page.goto(root+path);await page.waitForLoadState('networkidle');
 const before=await page.screenshot({fullPage:true,animations:'disabled',path:info.outputPath('before.png')});
 const context=await browser.newContext({...info.project.use});const afterPage=await context.newPage();
 const {errors}=await setup(afterPage);await afterPage.goto(root+path);await afterPage.waitForLoadState('networkidle');
 const after=await afterPage.screenshot({fullPage:true,animations:'disabled',path:info.outputPath('after.png')});
 expect(errors).toEqual([]);expect(after.equals(before)).toBe(true);await context.close();
});
test('biology: full run, partial open marks, notes, practice and ranking',async({page})=>{
 const {f,errors}=await setup(page);await page.goto(root+'biologia/');await page.locator('#nickname').fill('TestBio');await page.locator('#startBtn').click();await expect(page.locator('#play')).toHaveClass(/active/);
 for(let i=0;i<10;i++) {
  await expect(page.locator('#progressText')).toHaveText('Pytanie '+(i+1)+' z 10');
  const before=await page.locator('#qText').textContent(),note=await page.locator('#noteTitle').textContent();await page.locator('#nextNote').click();expect(await page.locator('#noteTitle').textContent()).not.toEqual(note);expect(await page.locator('#qText').textContent()).toEqual(before);
  const choice=page.locator('.choice-option');
  if(await choice.count()){await choice.first().click();await page.locator('#checkBtn').click();}
  else {for(const input of await page.locator('#inputArea textarea').all())await input.fill('Odpowied� ucznia z liter�wk�.');await page.locator('#revealBtn').click();}
  await expect(page.locator('#nextBtn')).toBeVisible();await page.locator('#nextBtn').click();
 }
 await expect(page.locator('#result')).toHaveClass(/active/);await expect(page.locator('#rankingStatus')).toContainText('zapisany');
 expect(f.calls.length).toEqual(3);const rows=[...(await f.storage.list({prefix:'entry:biologia:'})).values()];expect(rows).toHaveLength(1);expect(rows[0].maxPoints).toEqual(13);
 await page.locator('#mistakeSummary summary').click();await page.getByRole('button',{name:/Prze�wicz b��dne/}).click();
 const input=page.locator('#mistakeList select, #mistakeList textarea');if(await input.evaluate(el=>el.tagName)==='SELECT')await input.selectOption({index:1});else await input.fill('Nowa pr�ba');
 await page.getByRole('button',{name:'Sprawd� pr�b�'}).click();await expect(page.locator('#mistakeList')).toContainText('Powt�rka nie zmienia rankingu');expect([...(await f.storage.list({prefix:'entry:biologia:'})).values()]).toEqual(rows);expect(errors).toEqual([]);
});
test('biology hints are local, hidden until clicked, and preserve answers without affecting score',async({page})=>{
 let hintRequests=0;const {f,errors}=await setup(page);page.on('request',request=>{if(request.url().endsWith('/hint'))hintRequests++;});
 await page.goto(root+'biologia/');await page.locator('#nickname').fill('Podpowiedz');await page.locator('#startBtn').click();await expect(page.locator('#hintBtn')).toBeVisible();
 const initial=await page.evaluate(()=>{const q=bank.find(item=>item.text===document.querySelector('#qText').textContent);return {hint:q.hint,kind:q.kind};});
 await expect(page.locator('#hintArea')).toBeHidden();const scoreBefore=await page.locator('#scorePill').textContent();
 if(initial.kind==='choice')await page.locator('.choice-option').first().click();else await page.locator('#inputArea textarea').first().fill('moja robocza odpowied�');
 const answerBefore=initial.kind==='choice'?await page.locator('.choice-option.selected').textContent():await page.locator('#inputArea textarea').first().inputValue();
 await page.locator('#hintBtn').click();await expect(page.locator('#hintArea')).toHaveText(initial.hint);
 expect(hintRequests).toBe(0);expect(await page.locator('#scorePill').textContent()).toBe(scoreBefore);
 expect(initial.kind==='choice'?await page.locator('.choice-option.selected').textContent():await page.locator('#inputArea textarea').first().inputValue()).toBe(answerBefore);
 await page.locator('#hintBtn').click();await expect(page.locator('#hintArea')).toBeVisible();
 await page.evaluate(()=>{index++;renderQ();});await expect(page.locator('#hintArea')).toBeHidden();
 await page.evaluate(()=>{index--;renderQ();});await expect(page.locator('#hintArea')).toHaveText(initial.hint);
 expect(hintRequests).toBe(0);expect(errors).toEqual([]);
});
test('literature: closed questions, IV and V, server total and review',async({page})=>{
 const {f,errors}=await setup(page);await page.goto(root+'lektura/');await page.locator('#nickname').fill('TestLit');await page.locator('#startQuiz').click();await expect(page.locator('#quiz')).toBeVisible();
 for(let i=0;i<6;i++) {
  await expect(page.locator('#closedProgress')).toContainText('Pytanie '+(i+1));
  if(await page.locator('#activeMatch').count())await page.locator('#activeMatch').selectOption({index:1});else await page.locator('#closedQuestion input').first().check();
  await expect(page.locator('#closedMemory')).toBeVisible();await page.locator('#continueClosed').click();
 }
 await expect(page.locator('#writtenSection')).toBeVisible();for(const el of await page.locator('#short textarea').all())await el.fill('Przyja�� i odwaga bohater�w.');await page.locator('#gradeAi').click();await expect(page.locator('#ivActions')).toBeVisible();await page.locator('#continueToEssay').click();
 for(const el of await page.locator('#essay textarea').all())await el.fill('Bohater wykaza� si� odwag� i wierno�ci� przyjacio�om.');await page.locator('#gradeEssay').click();await expect(page.locator('#endActions')).toBeVisible();await page.locator('#check').click();await expect(page.locator('#score')).toContainText('/ 20 pkt');
 await page.locator('#submitScore').click();await expect(page.locator('#rankingStatus')).toContainText('Wynik zapisany');expect(f.calls.length).toBe(4);expect((await f.storage.list({prefix:'entry:lektura:'})).size).toBe(1);
 await page.locator('#mistakeSummary summary').click();await expect(page.getByRole('button',{name:/Prze�wicz b��dne/})).toBeVisible();expect(errors).toEqual([]);
});
for(const quiz of ['biologia','lektura'])test(quiz+' handles unavailable backend and blocked storage',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})});
 const {errors}=await setup(page,{offline:true});await page.goto(root+quiz+'/');await page.locator('#nickname').fill('Offline');await page.locator(quiz==='biologia'?'#startBtn':'#startQuiz').click();await expect(page.locator(quiz==='biologia'?'#nicknameError':'#startStatus')).toContainText('niedost�pny');expect(errors).toEqual([]);
});
test('biology resumes from server cookie or explains blocked third-party cookies',async({page})=>{
 const {errors}=await setup(page);await page.goto(root+'biologia/');await page.locator('#nickname').fill('Resume');await page.locator('#startBtn').click();await expect(page.locator('#play')).toHaveClass(/active/);const q=await page.locator('#qText').textContent();
 await page.reload();await expect.poll(async()=>await page.locator('#play').getAttribute('class')==='view active'||(await page.locator('#nicknameError').textContent()).includes('Nie mo�na wznowi�')).toBe(true);
 if(await page.locator('#play').getAttribute('class')==='view active')expect(await page.locator('#qText').textContent()).toEqual(q);
 const draft=await page.evaluate(()=>sessionStorage.getItem('bio-progress'));expect(draft).not.toContain('token');expect(errors).toEqual([]);
});
test('double start and answer clicks are idempotent; network retry retains answer',async({page})=>{
 const {f,errors}=await setup(page);await page.goto(root+'biologia/');await page.locator('#nickname').fill('Double');
 await page.locator('#startBtn').evaluate(el=>{el.click();el.click()});await expect(page.locator('#play')).toHaveClass(/active/);
 expect((await f.storage.list({prefix:'session:'})).size).toBe(1);
 // Move to a choice while retaining the actual server-assigned set.
 await page.evaluate(()=>{index=session.findIndex(q=>q.kind==='choice');renderQ()});
 await page.locator('.choice-option').first().click();
 const selected=await page.locator('.choice-option.selected').textContent();
 await page.route('**/answer',route=>route.abort());await page.locator('#checkBtn').click();await expect(page.locator('#feedback')).toHaveClass(/bad/);
 expect(await page.locator('.choice-option.selected').textContent()).toEqual(selected);
 await page.unroute('**/answer');await page.locator('#checkBtn').evaluate(el=>{el.click();el.click()});await expect(page.locator('#nextBtn')).toBeVisible();
 const saved=[...(await f.storage.list({prefix:'session:'})).values()][0];expect(Object.keys(saved.answers)).toHaveLength(1);expect(errors).toEqual([]);
});
test('notebook topic filter and touch preserve active question',async({page},info)=>{
 const {errors}=await setup(page);await page.goto(root+'biologia/');await page.locator('#nickname').fill('Notes');
 if(info.project.use.hasTouch)await page.locator('#startBtn').tap();else await page.locator('#startBtn').click();await expect(page.locator('#play')).toHaveClass(/active/);
 const question=await page.locator('#qText').textContent();await page.locator('#noteTopic').selectOption('microscope');
 expect(await page.evaluate(()=>notePool.every(n=>n.topic==='microscope'))).toBe(true);
 const first=await page.locator('#noteTitle').textContent();if(info.project.use.hasTouch)await page.locator('#nextNote').tap();else await page.locator('#nextNote').click();
 expect(await page.locator('#noteTitle').textContent()).not.toEqual(first);expect(await page.locator('#qText').textContent()).toEqual(question);expect(errors).toEqual([]);
});
test('literature refresh preserves closed answers and written drafts without stored tokens',async({page})=>{
 const {errors}=await setup(page);await page.goto(root+'lektura/');await page.locator('#nickname').fill('ResumeLit');await page.locator('#startQuiz').click();await expect(page.locator('#quiz')).toBeVisible();
 await page.locator('#closedQuestion input').first().check();await page.locator('#continueClosed').click();await expect(page.locator('#closedProgress')).toContainText('Pytanie 2');await page.reload();
 await expect.poll(async()=>await page.locator('#quiz').isVisible()||(await page.locator('#startStatus').textContent()).includes('Nie mo�na wznowi�')).toBe(true);
 if(await page.locator('#quiz').isVisible())await expect(page.locator('#closedProgress')).toContainText('Pytanie 2');
 expect(await page.evaluate(()=>sessionStorage.getItem('lit-progress'))).not.toContain('token');expect(errors).toEqual([]);
});

