import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDatabase, user, asUser, rpc } from './database.mjs';

let db;
before(async()=>{db=await createDatabase();});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('delete from iv_private.sessions;delete from iv_private.researchers;update iv_private.study set assigned_a=0,assigned_b=0,is_open=true;');});

test('Migration is repeatable without deleting stored responses',async()=>{
 const u=await user(db);const s=await rpc(db,u,'iv_start',{p_language:'en'});
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 assert.equal((await rpc(db,u,'iv_session')).id,s.id);
});
test('Unauthenticated role cannot execute any public study RPC',async()=>{
 for(const name of ['iv_start','iv_session','iv_is_researcher','iv_admin_snapshot','iv_withdraw'])
  await assert.rejects(rpc(db,null,name,{p_language:'en'},'anon'),/permission denied/);
});
test('No direct table access is granted to participant or researcher roles',async()=>{
 const u=await user(db,false,true);
 for(const table of ['study','sessions','researchers'])await assert.rejects(asUser(db,u,`select * from iv_private.${table}`),/permission denied/);
});
test('Only an anonymous authenticated identity can start; group is not caller-selected',async()=>{
 const permanent=await user(db,false);await assert.rejects(rpc(db,permanent,'iv_start',{p_language:'en'}),/ANONYMOUS_PARTICIPANT_REQUIRED/);
 const participant=await user(db);const s=await rpc(db,participant,'iv_start',{p_language:'ru'});
 assert(['A','B'].includes(s.group));assert.equal(s.language,'ru');assert.equal(s.stage,'vote');
 await assert.rejects(rpc(db,participant,'iv_start',{p_language:'de'}),/INVALID_LANGUAGE/);
});
test('40 database assignments balance 20/20; repeated starts are idempotent',async()=>{
 const users=await Promise.all(Array.from({length:40},()=>user(db)));
 const sessions=await Promise.all(users.map(u=>rpc(db,u,'iv_start',{p_language:'en'})));
 assert.equal(sessions.filter(s=>s.group==='A').length,20);assert.equal(sessions.filter(s=>s.group==='B').length,20);
 const retry=await rpc(db,users[0],'iv_start',{p_language:'ru'});assert.equal(retry.id,sessions[0].id);
 const counts=(await db.query('select assigned_a+assigned_b as n from iv_private.study')).rows[0];assert.equal(counts.n,40);
});
test('Vote is immutable; retrying the same selection does not duplicate it',async()=>{
 const u=await user(db);await rpc(db,u,'iv_start',{p_language:'en'});
 const s=await rpc(db,u,'iv_choose',{p_option:'library'});assert.equal(s.stage,'survey');
 assert.deepEqual(await rpc(db,u,'iv_choose',{p_option:'library'}),s);
 await assert.rejects(rpc(db,u,'iv_choose',{p_option:'lounge'}),/VOTE_LOCKED/);
 await assert.rejects(rpc(db,u,'iv_choose',{p_option:'other'}),/INVALID_OPTION/);
});
test('Survey cannot precede the vote; invalid confidence, awareness and text are rejected',async()=>{
 const u=await user(db);await rpc(db,u,'iv_start',{p_language:'en'});
 await assert.rejects(rpc(db,u,'iv_complete',{p_awareness:'yes',p_confidence:3}),/VOTE_REQUIRED/);
 await rpc(db,u,'iv_choose',{p_option:'lounge'});
 for(const args of [{p_awareness:'bad',p_confidence:3},{p_awareness:'yes',p_confidence:0},{p_awareness:'yes',p_confidence:6},{p_awareness:'yes',p_confidence:null},{p_awareness:'yes',p_confidence:3,p_reason:'x'.repeat(501)}])
  await assert.rejects(rpc(db,u,'iv_complete',args),/INVALID_SURVEY/);
});
test('Completed survey is immutable and idempotent; only own session is returned',async()=>{
 const a=await user(db),b=await user(db);await rpc(db,a,'iv_start',{p_language:'en'});await rpc(db,b,'iv_start',{p_language:'ru'});
 await rpc(db,a,'iv_choose',{p_option:'library'});
 const s=await rpc(db,a,'iv_complete',{p_awareness:'unsure',p_confidence:4,p_reason:'Книги <script>example</script>'});
 assert.equal(s.stage,'reveal');assert.deepEqual(await rpc(db,a,'iv_complete',{p_awareness:'no',p_confidence:1,p_reason:'changed'}),s);
 assert.notEqual((await rpc(db,b,'iv_session')).id,s.id);assert.equal((await rpc(db,b,'iv_session')).reason,'');
 assert(!('owner_id' in s));
});
test('Participants and unlisted permanent users cannot obtain researcher snapshots or clear data',async()=>{
 for(const u of [await user(db),await user(db,false)]){
  assert.equal(await rpc(db,u,'iv_is_researcher'),false);
  await assert.rejects(rpc(db,u,'iv_admin_snapshot'),/RESEARCHER_REQUIRED/);
  await assert.rejects(rpc(db,u,'iv_admin_clear',{p_confirmation:'DELETE REAL RESPONSES'}),/RESEARCHER_REQUIRED/);
  await assert.rejects(rpc(db,u,'iv_admin_set_open',{p_open:false}),/RESEARCHER_REQUIRED/);
 }
});
test('Researcher access requires both an allowlisted ID and a non-anonymous token',async()=>{
 const a=await user(db,false,true);assert.equal(await rpc(db,a,'iv_is_researcher'),true);
 assert.equal(await rpc(db,{...a,anonymous:true},'iv_is_researcher'),false);
 const snapshot=await rpc(db,a,'iv_admin_snapshot');assert.equal(snapshot.rows.length,0);assert.equal(snapshot.isOpen,true);
});
test('Withdrawal erases answers, excludes results and retains a no-repeat marker',async()=>{
 const u=await user(db),a=await user(db,false,true);await rpc(db,u,'iv_start',{p_language:'en'});await rpc(db,u,'iv_choose',{p_option:'library'});
 await rpc(db,u,'iv_complete',{p_awareness:'yes',p_confidence:5,p_reason:'sensitive test text'});
 const s=await rpc(db,u,'iv_withdraw');assert.equal(s.stage,'withdrawn');assert.equal(s.reason,'');assert.equal(s.option,null);assert.equal(s.awareness,null);assert.equal(s.confidence,null);
 assert.equal((await rpc(db,a,'iv_admin_snapshot')).rows.length,0);
 assert.equal((await rpc(db,u,'iv_start',{p_language:'en'})).stage,'withdrawn');
 await assert.rejects(rpc(db,u,'iv_choose',{p_option:'lounge'}),/VOTE_LOCKED/);
});
test('Pause rejects new sessions but allows existing participants to finish and withdraw',async()=>{
 const a=await user(db,false,true),u=await user(db),fresh=await user(db);await rpc(db,u,'iv_start',{p_language:'en'});
 await rpc(db,a,'iv_admin_set_open',{p_open:false});await assert.rejects(rpc(db,fresh,'iv_start',{p_language:'en'}),/STUDY_CLOSED/);
 assert.equal((await rpc(db,u,'iv_start',{p_language:'en'})).stage,'vote');await rpc(db,u,'iv_choose',{p_option:'lounge'});await rpc(db,u,'iv_complete',{p_awareness:'no',p_confidence:2});
 assert.equal((await rpc(db,a,'iv_admin_snapshot')).rows.length,1);await rpc(db,u,'iv_withdraw');
});
test('Capacity is server-enforced',async()=>{
 const u=await user(db);await db.exec('update iv_private.study set assigned_a=5000,assigned_b=5000');
 await assert.rejects(rpc(db,u,'iv_start',{p_language:'en'}),/STUDY_CAPACITY/);
});
test('Admin clear requires confirmation, resets counts and closes enrollment',async()=>{
 const a=await user(db,false,true),u=await user(db);await rpc(db,u,'iv_start',{p_language:'en'});await rpc(db,u,'iv_choose',{p_option:'library'});
 await assert.rejects(rpc(db,a,'iv_admin_clear',{p_confirmation:'wrong'}),/CONFIRMATION_REQUIRED/);
 await rpc(db,a,'iv_admin_clear',{p_confirmation:'DELETE REAL RESPONSES'});
 const snap=await rpc(db,a,'iv_admin_snapshot');assert.deepEqual(snap.assignments,{A:0,B:0});assert.equal(snap.rows.length,0);assert.equal(snap.isOpen,false);
 assert.equal(await rpc(db,u,'iv_session'),null);
});
