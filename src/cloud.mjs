import { createClient } from '@supabase/supabase-js';
import qrCode from 'qrcode-generator';

// Transport and credentials stay outside the UI. Only the public key is configured.
export class OnlineStore {
  constructor(config = {}) {
    this.config = config;
    this.configured = false;
    this.admin = false;
    this.snapshot = { version: 1, rows: [], assignments: { A: 0, B: 0 } };
    this.own = null;
    this.isOpen = true;
    this.lastSync = null;
    this.lastError = null;
    this.pollIntervalMs = Math.max(5000, Number(config.pollIntervalMs) || 10000);
    try {
      const url = new URL(config.supabaseUrl);
      const key = config.supabasePublishableKey;
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return;
      if (typeof key !== 'string' || !key) return;
      if (!key.startsWith('sb_publishable_')) {
        const payload = JSON.parse(atob(key.split('.')[1]));
        if (payload.role !== 'anon') return;
      }
      const timedFetch = (resource, options = {}) => fetch(resource, {
        ...options,
        signal: AbortSignal.any([AbortSignal.timeout(20000), ...(options.signal ? [options.signal] : [])])
      });
      this.participant = createClient(url.origin, key, {
        auth: { storageKey: 'iv-online-participant-v1', persistSession: true, detectSessionInUrl: false },
        global: { fetch: timedFetch }
      });
      this.researcher = createClient(url.origin, key, {
        auth: { storageKey: 'iv-online-researcher-v1', storage: sessionStorage, persistSession: true, detectSessionInUrl: false },
        global: { fetch: timedFetch }
      });
      this.configured = true;
    } catch { /* The setup screen remains usable if config or storage is unavailable. */ }
  }
  async rpc(client, name, args = {}) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }
  async init() {
    if (!this.configured) return;
    const { data, error } = await this.participant.auth.getSession();
    if (error) throw error;
    if (data.session) this.own = await this.rpc(this.participant, 'iv_session');
    const adminSession = await this.researcher.auth.getSession();
    if (adminSession.data.session) {
      this.admin = await this.rpc(this.researcher, 'iv_is_researcher');
      if (this.admin) await this.refresh();
      else await this.researcher.auth.signOut({ scope: 'local' });
    }
  }
  requireConfig() { if (!this.configured) throw Error('SETUP_REQUIRED'); }
  async start(language) {
    this.requireConfig();
    const { data, error } = await this.participant.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      const result = await this.participant.auth.signInAnonymously();
      if (result.error) throw result.error;
    }
    this.own = await this.rpc(this.participant, 'iv_start', { p_language: language });
    return this.own;
  }
  async choose(option) {
    this.own = await this.rpc(this.participant, 'iv_choose', { p_option: option });
    return this.own;
  }
  async complete(awareness, confidence, reason) {
    this.own = await this.rpc(this.participant, 'iv_complete', {
      p_awareness: awareness, p_confidence: confidence, p_reason: reason
    });
    return this.own;
  }
  async withdraw() {
    this.own = await this.rpc(this.participant, 'iv_withdraw');
    return this.own;
  }
  async login(email, password) {
    this.requireConfig();
    const { error } = await this.researcher.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.admin = await this.rpc(this.researcher, 'iv_is_researcher');
    if (!this.admin) {
      await this.researcher.auth.signOut({ scope: 'local' });
      throw Error('RESEARCHER_REQUIRED');
    }
    await this.refresh();
  }
  async logout() {
    if (this.researcher) {
      const { error } = await this.researcher.auth.signOut({ scope: 'local' });
      if (error) throw error;
    }
    this.admin = false;
    this.snapshot = { version: 1, rows: [], assignments: { A: 0, B: 0 } };
    this.lastSync = null;
  }
  async refresh() {
    if (!this.admin) throw Error('RESEARCHER_REQUIRED');
    try {
      const result = await this.rpc(this.researcher, 'iv_admin_snapshot');
      this.snapshot = { version: result.version, rows: result.rows, assignments: result.assignments };
      this.isOpen = result.isOpen;
      this.lastSync = new Date();
      this.lastError = null;
      return this.snapshot;
    } catch (error) {
      this.lastError = error;
      if (error.code === '42501' || /JWT|refresh.token|expired/i.test(error.message || '')) {
        this.admin = false;
        this.snapshot = { version: 1, rows: [], assignments: { A: 0, B: 0 } };
      }
      throw error;
    }
  }
  async setOpen(value) {
    this.isOpen = await this.rpc(this.researcher, 'iv_admin_set_open', { p_open: value });
  }
  async clear() {
    await this.rpc(this.researcher, 'iv_admin_clear', { p_confirmation: 'DELETE REAL RESPONSES' });
    this.own = null;
    await this.refresh();
  }
  async nextParticipant() {
    if (!this.admin) throw Error('RESEARCHER_REQUIRED');
    if (this.own && ['vote', 'survey'].includes(this.own.stage)) await this.withdraw();
    const { error } = await this.participant.auth.signOut({ scope: 'local' });
    if (error) throw error;
    this.own = null;
  }
  dataset() {
    if (this.admin) return this.snapshot;
    const s = this.own;
    const rows = s && ['survey', 'reveal'].includes(s.stage) ? [{
      id: s.id, group: s.group, option: s.option, status: s.stage === 'survey' ? 'pending' : 'complete',
      synthetic: false, awareness: s.awareness, confidence: s.confidence, reason: s.reason
    }] : [];
    return { version: 1, rows, assignments: { A: s?.group === 'A' ? 1 : 0, B: s?.group === 'B' ? 1 : 0 } };
  }
  qrSvg(url) {
    const qr = qrCode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  }
}

if (typeof window !== 'undefined') window.InvisibleVoteCloud = new OnlineStore(window.INVISIBLE_VOTE_CONFIG);
