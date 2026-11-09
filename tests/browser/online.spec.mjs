import { test, expect } from '@playwright/test';
import { createDatabase, user, rpc } from '../database.mjs';
import { mkdir } from 'node:fs/promises';

const fakeUrl='https://test-project.supabase.co';
const fakeKey='sb_publishable_test_only_not_a_real_key';
let db,admin,identities,tokens,failNext,requests;
test.beforeAll(async()=>{db=await createDatabase();});
test.afterAll(async()=>{await db.close();});
test.beforeEach(async()=>{
 await db.exec('delete from iv_private.sessions;delete from iv_private.researchers;update iv_private.study set assigned_a=0,assigned_b=0,is_open=true;');
 admin=await user(db,false,true);identities=new Map();tokens=new Map();failNext=null;requests=[];
});
function session(u){
 const now=Math.floor(Date.now()/1000);
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:u.id,role:'authenticated',is_anonymous:u.anonymous,iat:now,exp:now+3600}].map(o=>Buffer.from(JSON.stringify(o)).toString('base64url')).join('.')+'.test-signature';
 tokens.set(jwt,u);
 const authUser={id:u.id,aud:'authenticated',role:'authenticated',is_anonymous:u.anonymous,app_metadata:{provider:u.anonymous?'anonymous':'email'},user_metadata:{},created_at:new Date().toISOString(),...(u.anonymous?{}:{email:'researcher@example.invalid'})};
 identities.set(u.id,authUser);
 return {access_token:jwt,refresh_token:'test-refresh-'+u.id,expires_in:3600,expires_at:now+3600,token_type:'bearer',user:authUser};
}
async function configure(context){
 await context.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.INVISIBLE_VOTE_CONFIG=${JSON.stringify({supabaseUrl:fakeUrl,supabasePublishableKey:fakeKey,pollIntervalMs:60000})}`}));
 await context.route(fakeUrl+'/**',async route=>{
  const req=route.request(),url=new URL(req.url());requests.push(url.pathname);
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  const respond=(data,status=200)=>route.fulfill({status,headers:cors,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return respond({});
  if(url.pathname==='/auth/v1/signup')return respond(session(await user(db)));
  if(url.pathname==='/auth/v1/token'){
   const b=req.postDataJSON();
   if(b.email==='researcher@example.invalid'&&b.password==='test-password-only')return respond(session(admin));
   return respond({error:'invalid_grant',error_description:'Invalid login credentials'},400);
  }
  const token=req.headers().authorization?.replace(/^Bearer /,'');const u=tokens.get(token);
  if(url.pathname==='/auth/v1/user')return u?respond(identities.get(u.id)):respond({message:'Unauthorized'},401);
  if(url.pathname==='/auth/v1/logout')return respond({});
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1);
   if(failNext===name){failNext=null;return route.abort('failed');}
   if(!u)return respond({message:'Unauthorized'},401);
   try{return respond(await rpc(db,u,name,req.postDataJSON()||{}));}
   catch(e){return respond({code:e.code||'P0001',message:e.message,details:null,hint:null},e.code==='42501'?403:400);}
  }
  return respond({message:'Unexpected test request'},404);
 });
}
const click=(page,a,v)=>page.locator(`[data-action="${a}"]${v?`[data-value="${v}"]`:''}`).first().click();
async function start(page){await page.goto('/');await expect(page.locator('#start-button')).toBeDisabled();await page.locator('#consent').check();await expect(page.locator('#start-button')).toBeEnabled();await click(page,'start');await expect(page.locator('.choices')).toBeVisible();}
async function vote(page,option='library'){await click(page,'vote',option);await expect(page.locator('#survey-form')).toBeVisible();}
async function survey(page,reason='Книги',awareness='yes',confidence='4'){
 await page.locator(`input[name="awareness"][value="${awareness}"]`).check();await page.locator(`input[name="confidence"][value="${confidence}"]`).check();await page.locator('#reason').fill(reason);await page.locator('button[type="submit"]').click();await expect(page.locator('.reveal-title')).toBeVisible();
}
async function login(page){await page.goto('/#research');await expect(page.locator('#login-form')).toBeVisible();await page.locator('#researcher-email').fill('researcher@example.invalid');await page.locator('#researcher-password').fill('test-password-only');await page.locator('#login-form button').click();await expect(page.locator('.stats')).toBeVisible();}
async function screenshot(page,name){await mkdir('test-results/screens',{recursive:true});await page.waitForTimeout(300);await page.locator('#toast').evaluate(e=>e.classList.add('hidden'));await page.screenshot({path:`test-results/screens/${name}.png`,fullPage:true});}

test('Unconfigured site refuses collection and offers the standalone offline file',async({page})=>{
 await page.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INVISIBLE_VOTE_CONFIG={};'}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByText('The online study is not connected yet.')).toBeVisible();await page.locator('#consent').check();await expect(page.locator('#start-button')).toBeDisabled();await expect(page.locator('a[href="offline.html"]').first()).toBeVisible();expect(errors).toEqual([]);await screenshot(page,'setup');
});
test('Two independent phones submit to one real database and researcher sees both',async({browser})=>{
 const c1=await browser.newContext(),c2=await browser.newContext(),c3=await browser.newContext();for(const c of [c1,c2,c3])await configure(c);
 const a=await c1.newPage(),b=await c2.newPage(),r=await c3.newPage();const errors=[];for(const p of [a,b,r])p.on('pageerror',e=>errors.push(e.message));
 await Promise.all([start(a),start(b)]);expect(await a.locator('.popular').count()+await b.locator('.popular').count()).toBe(1);
 await vote(a,'library');await vote(b,'lounge');await survey(a,'=HYPERLINK("x","Тест")');await survey(b,'Общение','no','2');
 await login(r);await expect(r.locator('.stat .value').first()).toHaveText('2');await expect(r.locator('.stat .value').nth(1)).toHaveText('1');await expect(r.locator('.stat .value').nth(2)).toHaveText('1');
 await expect(r.locator('tbody tr')).toHaveCount(2);await expect(r.locator('.delta strong')).toHaveText(/100\.0 pp/);await screenshot(r,'online-dashboard');
 await r.reload();await expect(r.locator('.stats')).toBeVisible();await a.reload();await expect(a.locator('.reveal-title')).toBeVisible();
 await click(a,'withdraw');await a.locator('#modal-confirm').click();await expect(a.locator('#main').getByText(/Your vote and survey answers have been deleted/)).toBeVisible();
 await click(r,'refresh');await expect(r.locator('.stat .value').first()).toHaveText('1');
 expect(errors).toEqual([]);for(const c of [c1,c2,c3])await c.close();
});
test('Pending vote survives reload, is excluded from totals and cannot be changed',async({browser})=>{
 const c=await browser.newContext(),ac=await browser.newContext();await configure(c);await configure(ac);const p=await c.newPage(),r=await ac.newPage();await start(p);await vote(p);await p.reload();await expect(p.locator('#survey-form')).toBeVisible();await expect(p.locator('.choices')).toHaveCount(0);
 await login(r);await expect(r.locator('.stat .value').first()).toHaveText('0');await expect(r.getByText(/1 unfinished vote/)).toBeVisible();await survey(p);await click(r,'refresh');await expect(r.locator('.stat .value').first()).toHaveText('1');await c.close();await ac.close();
});
test('Network failure does not advance or falsely confirm saving; retry restores session',async({context,page})=>{
 await configure(context);await start(page);failNext='iv_choose';await click(page,'vote','library');await expect(page.locator('.online-status.error')).toBeVisible();await expect(page.locator('.choices')).toBeVisible();await expect(page.locator('.reveal-title')).toHaveCount(0);
 await click(page,'reconnect');await expect(page.locator('.online-status.error')).toHaveCount(0);await vote(page);await survey(page);await expect(page.locator('.reveal-title')).toBeVisible();
});
test('Researcher login is required; wrong credentials expose no participant table',async({context,page})=>{
 await configure(context);await page.goto('/#research');await page.locator('#researcher-email').fill('other@example.invalid');await page.locator('#researcher-password').fill('incorrect');await page.locator('#login-form button').click();await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('.stats')).toHaveCount(0);await expect(page.locator('tbody')).toHaveCount(0);
});
test('Demo data is local and isolated from real snapshots and exports',async({context,page})=>{
 await configure(context);await start(page);await vote(page);await survey(page);await login(page);await click(page,'generate');await expect(page.locator('.stat .value').first()).toHaveText('40');await expect(page.locator('.stat .value').nth(1)).toHaveText('20');await expect(page.locator('.stat .value').nth(2)).toHaveText('20');await expect(page.locator('.tag.synthetic')).toBeVisible();
 const demoDownload=page.waitForEvent('download');await click(page,'json');const demo=await demoDownload;const demoStream=await demo.createReadStream();const chunks=[];for await(const chunk of demoStream)chunks.push(chunk);expect(JSON.parse(Buffer.concat(chunks)).dataset).toBe('demo');
 await click(page,'dataset','real');await expect(page.locator('.stat .value').first()).toHaveText('1');expect((await rpc(db,admin,'iv_admin_snapshot')).rows.length).toBe(1);
 const pending=page.waitForEvent('download');await click(page,'csv');const download=await pending;const stream=await download.createReadStream();const csv=[];for await(const chunk of stream)csv.push(chunk);const raw=Buffer.concat(csv);expect([...raw.subarray(0,3)]).toEqual([239,187,191]);expect(raw.toString('utf8')).toContain('Книги');expect(raw.toString('utf8')).not.toContain('DEMO_');
});
test('Tests A/B write nothing to real database; normal participants cannot select groups',async({context,page})=>{
 await configure(context);await login(page);
 await click(page,'tab','sessions');await expect(page.getByText('The participant QR appears on the published HTTPS site. Local preview addresses cannot be shared with phones.')).toBeVisible();
 expect(await page.evaluate(()=>Cloud.qrSvg('https://w1theri.github.io/the-invisible-vote/'))).toContain('<svg');
 for(const group of ['A','B']){await click(page,'tab','sessions');await click(page,'test',group);if(await page.locator('#modal-confirm').count())await page.locator('#modal-confirm').click();await expect(page.locator('.popular')).toHaveCount(group==='B'?1:0);await vote(page);await survey(page);await click(page,'research');}
 expect((await rpc(db,admin,'iv_admin_snapshot')).rows.length).toBe(0);expect(requests.filter(p=>p.includes('iv_start')).length).toBe(0);
});
test('Pause blocks new enrollment, preserves existing participation, clear closes study',async({browser})=>{
 const c=await browser.newContext(),ac=await browser.newContext(),fresh=await browser.newContext();for(const x of [c,ac,fresh])await configure(x);const p=await c.newPage(),r=await ac.newPage(),f=await fresh.newPage();await start(p);await login(r);await click(r,'tab','sessions');await click(r,'study-open');await expect(r.locator('.online-meta')).toContainText('Paused');
 await f.goto('/');await f.locator('#consent').check();await click(f,'start');await expect(f.locator('.online-status.error')).toContainText('paused');await vote(p);await survey(p);await click(r,'tab','overview');await click(r,'refresh');await expect(r.locator('.stat .value').first()).toHaveText('1');
 await click(r,'clear');await r.locator('#modal-confirm').click();await expect(r.locator('.stat .value').first()).toHaveText('0');await expect(r.locator('.online-meta')).toContainText('Paused');for(const x of [c,ac,fresh])await x.close();
});
test('Mobile layouts, both languages, equal neutral cards and accessible survey',async({context,page})=>{
 await configure(context);await login(page);await click(page,'tab','sessions');await click(page,'test','A');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});for(const lang of ['en','ru']){await click(page,'language',lang);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);const sizes=await page.locator('.choice').evaluateAll(es=>es.map(e=>({w:e.offsetWidth,h:e.offsetHeight})));expect(sizes[0]).toEqual(sizes[1]);}}
 await screenshot(page,'mobile-vote');await vote(page);await page.locator('input[name="awareness"][value="yes"]').check();await page.locator('input[name="confidence"][value="5"]').check();await page.locator('#reason').fill('Свой довод');await click(page,'language','en');await expect(page.locator('#reason')).toHaveValue('Свой довод');await expect(page.locator('input[name="confidence"][value="5"]')).toBeChecked();await screenshot(page,'mobile-survey');
});
test('Live projector uses shared real results, supports reveal, researcher logout removes access',async({context,page})=>{
 await configure(context);await start(page);await vote(page);await survey(page);await login(page);await click(page,'generate');await click(page,'live');await expect(page.locator('.live-count')).toHaveText('40');await click(page,'dataset','real');await expect(page.locator('.live-count')).toHaveText('1');await click(page,'live-reveal');await expect(page.locator('.live-final h1')).toContainText('WHAT IF');await screenshot(page,'live-reveal');await click(page,'research');await click(page,'logout');await click(page,'research');await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('tbody')).toHaveCount(0);
});
