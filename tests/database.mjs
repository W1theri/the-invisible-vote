import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, is_anonymous boolean not null default false);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  return db;
}
export async function user(db, anonymous = true, researcher = false) {
  const u = { id: randomUUID(), anonymous };
  await db.query('insert into auth.users(id,is_anonymous) values ($1,$2)', [u.id, anonymous]);
  if (researcher) await db.query('insert into iv_private.researchers values ($1)', [u.id]);
  return u;
}
export async function asUser(db, u, query, params = [], role = 'authenticated') {
  if (!['authenticated', 'anon'].includes(role)) throw Error('Invalid test role');
  return db.transaction(async tx => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [u?.id ?? '', JSON.stringify(u ? { sub: u.id, is_anonymous: u.anonymous } : {})]);
    return tx.query(query, params);
  });
}
const signatures = {
  iv_is_researcher: [], iv_session: [], iv_start: ['p_language'], iv_choose: ['p_option'],
  iv_complete: ['p_awareness', 'p_confidence', 'p_reason'], iv_withdraw: [],
  iv_admin_snapshot: [], iv_admin_set_open: ['p_open'], iv_admin_clear: ['p_confirmation']
};
export async function rpc(db, u, name, args = {}, role = 'authenticated') {
  const keys = signatures[name];
  if (!keys) throw Error('Unknown RPC');
  const result = await asUser(db, u, `select public.${name}(${keys.map((_, i) => '$' + (i + 1)).join(',')}) as result`,
    keys.map(k => args[k] ?? (k === 'p_reason' ? '' : null)), role);
  return result.rows[0].result;
}
