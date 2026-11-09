'use strict';
Object.assign(state,{ready:false,busy:false,networkError:null,adminEmail:'',consented:false,polling:false});
if(location.hash==='#research')state.view='research';
window.addEventListener('hashchange',()=>{if(location.hash==='#research'){captureDraft();state.view='research';state.tab='overview';render();}});

function onlineError(error){
 const m=error?.message||'';
 if(/RESEARCHER_REQUIRED/.test(m))return t('notResearcher');
 if(/STUDY_CLOSED/.test(m))return t('closed');
 if(/STUDY_CAPACITY/.test(m))return t('capacity');
 if(/VOTE_LOCKED/.test(m))return t('lockedError');
 if(/SESSION_REQUIRED|VOTE_REQUIRED/.test(m))return t('sessionError');
 if(/SETUP_REQUIRED/.test(m))return t('cannotStart');
 if(/Invalid login credentials|Email not confirmed/.test(m))return t('loginFailed');
 return t('onlineError');
}
function onlineStatus(){
 if(!Cloud.configured)return `<div class="online-status error" role="status"><span><strong>${t('setupTitle')}</strong><br>${t('setupBody')}</span><a class="btn secondary small" href="offline.html">${t('offlineLink')} ↗</a></div>`;
 if(!state.ready)return `<div class="online-status" role="status">${t('connecting')}</div>`;
 if(state.networkError)return `<div class="online-status error" role="alert" tabindex="-1"><span>${onlineError(state.networkError)}</span><button class="btn secondary small" data-action="reconnect">${t('retry')}</button></div>`;
 return '';
}
function header(){return baseHeader()+onlineStatus();}
function footer(){return `<footer class="footer"><span>${t('localOnly')}</span><div><a href="offline.html">${t('offlineLink')}</a> · <button class="btn quiet" data-action="research">${t('researchAccess')} ↗</button></div></footer>`;}
function loginScreen(){return header()+`<main class="participant" id="main"><p class="eyebrow muted">THE INVISIBLE VOTE / RESEARCH</p><h1>${t('loginTitle')}</h1><p class="muted login-notice">${t('loginIntro')}</p><form class="panel login-form" id="login-form"><label for="researcher-email">${t('email')}</label><input id="researcher-email" type="email" autocomplete="username" required maxlength="254" value="${esc(state.adminEmail)}"><label for="researcher-password">${t('password')}</label><input id="researcher-password" type="password" autocomplete="current-password" required maxlength="256"><button class="btn" type="submit" ${!Cloud.configured?'disabled':''}>${t('login')} ↗</button></form><p class="muted login-notice" style="font-size:12px;margin-top:22px">${t('adminHelp')}</p><button class="btn quiet" data-action="participant">${t('backStudy')} ↗</button></main>`+footer();}
function syncMeta(){return `<div class="online-meta"><span>${t('lastSync')}: ${Cloud.lastSync?Cloud.lastSync.toLocaleTimeString(state.lang==='ru'?'ru-RU':'en-US'):'—'}</span><span>${t('studyState')}: <strong>${t(Cloud.isOpen?'open':'paused')}</strong></span>${Cloud.lastError?`<strong style="color:var(--danger)">${t('stale')}</strong>`:''}</div>`;}
function dashboard(){
 if(!Cloud.admin)return loginScreen();
 let html=baseDashboard();
 html=html.replace('<main class="dashboard" id="main">','<main class="dashboard" id="main">'+syncMeta());
 html=html.replace('<div class="sidebar-bottom">',`<button class="side-link" data-action="logout">${t('logout')}</button><div class="sidebar-bottom">`);
 return html;
}
function toolbar(){
 const old=baseToolbar();
 return old.replace(`<button class="btn secondary small" data-action="import">↑ ${t('import')}</button>`,state.dataset==='demo'?`<button class="btn secondary small" data-action="import">↑ ${t('demoOnlyImport')}</button>`:'')+`<p class="hint">${t('exportCurrent')}</p>`;
}
function sessions(){return `<div class="panel" style="margin-bottom:25px"><h2 style="font-size:22px">${t('studyState')}: ${t(Cloud.isOpen?'open':'paused')}</h2><p style="font-size:13px" class="muted">${t('startClosed')}</p><div class="control-buttons"><button class="btn secondary" data-action="study-open">${t(Cloud.isOpen?'pause':'reopen')}</button><button class="btn secondary" data-action="copy-link">${t('copyLink')} ↗</button></div><p class="hint study-link">${esc(participantLink())}</p></div>`+qrPanel()+baseSessions();}
function render(focus=true){
 baseRender(focus);
 const start=$('#start-button');
 if(start){$('#consent').checked=state.consented;start.disabled=!Cloud.configured||!state.ready||!state.consented||state.busy;}
 $('#app').setAttribute('aria-busy',String(state.busy));
 if(state.busy){document.querySelectorAll('#app button').forEach(b=>{b.disabled=true;});}
 if(!Cloud.configured)document.querySelectorAll('#login-form button').forEach(b=>b.disabled=true);
 if(state.view==='live'){
  const el=$('#main');
  const status=onlineStatus();
  if(status)el.insertAdjacentHTML('afterbegin',status);
  if(!state.liveReveal)el.insertAdjacentHTML('beforeend',syncMeta());
 }
}
function applyOwn(){
 state.session=Cloud.own?{id:Cloud.own.id,group:Cloud.own.group,stage:Cloud.own.stage}:null;
}
async function runNetwork(task){
 if(state.busy)return;
 captureDraft();state.busy=true;render(false);
 let success=false;
 try{await task();state.networkError=null;success=true;}
 catch(error){state.networkError=error;toast(onlineError(error));}
 finally{state.busy=false;render(success);}
}
const Experiment={
 async start(){if(!$('#consent')?.checked||!state.ready)return;state.consented=true;await runNetwork(async()=>{await Cloud.start(state.lang);applyOwn();});},
 async vote(option){if(state.test)return LocalExperiment.vote(option);if(state.session?.stage!=='vote')return;await runNetwork(async()=>{await Cloud.choose(option);applyOwn();});},
 async submit(){
  if(state.test)return LocalExperiment.submit();
  if(state.session?.stage!=='survey')return;
  captureDraft();const {awareness,confidence,reason}=state.draft;
  if(!['yes','no','unsure'].includes(awareness)||!['1','2','3','4','5'].includes(String(confidence))){toast(t('required'));return;}
  await runNetwork(async()=>{await Cloud.complete(awareness,Number(confidence),reason);applyOwn();state.draft={awareness:'',confidence:'',reason:''};toast(t('serverSaved'));});
 },
 async withdraw(){
  if(state.test)return LocalExperiment.withdraw();
  if(!state.session||state.session.stage==='withdrawn')return;
  const complete=state.session.stage==='reveal';
  if(!await ask(t(complete?'deleteTitle':'exitTitle'),t(complete?'deleteBody':'exitBody')))return;
  await runNetwork(async()=>{await Cloud.withdraw();applyOwn();state.draft={awareness:'',confidence:'',reason:''};toast(t('deleted'));});
 },
 async newSession(testGroup=null){
  if(!Cloud.admin){state.view='research';render();return;}
  if(activeSession()&&!await ask(t(testGroup?'testTitle':'next'),t('newSessionBody')))return;
  if(testGroup){state.test={id:uid(),group:testGroup,stage:'vote'};state.draft={awareness:'',confidence:'',reason:''};state.view='participant';render();return;}
  await runNetwork(async()=>{await Cloud.nextParticipant();state.test=null;applyOwn();state.draft={awareness:'',confidence:'',reason:''};state.consented=false;state.view='participant';});
 }
};
function participantLink(){const u=new URL(location.href);u.hash='';u.search='';return u.href;}
function qrPanel(){
 const local=location.protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 return `<section class="panel" style="margin-bottom:25px"><h2 style="font-size:22px">${t('qrTitle')}</h2>${local?`<p class="muted" style="font-size:13px">${t('qrLocal')}</p>`:`<div class="qr-code" style="max-width:220px">${Cloud.qrSvg(participantLink())}</div><p class="hint study-link">${esc(participantLink())}</p>`}</section>`;
}
async function action(name,value){
 if(state.busy)return;
 if(name==='start'){await Experiment.start();return;}
 if(name==='vote'){await Experiment.vote(value);return;}
 if(name==='withdraw'){await Experiment.withdraw();return;}
 if(name==='new-session'||name==='test'){await Experiment.newSession(name==='test'?value:null);return;}
 if(name==='reconnect'){await runNetwork(async()=>{if(!Cloud.configured)throw Error('SETUP_REQUIRED');const result=await Cloud.participant.auth.getSession();if(result.error)throw result.error;if(result.data.session){Cloud.own=await Cloud.rpc(Cloud.participant,'iv_session');applyOwn();}if(Cloud.admin)await Cloud.refresh();});return;}
 if(name==='research'){
  captureDraft();state.view='research';state.tab='overview';render();
  if(Cloud.admin)await runNetwork(()=>Cloud.refresh());return;
 }
 if(name==='logout'){await runNetwork(async()=>{await Cloud.logout();state.test=null;state.dataset='real';applyOwn();state.view='participant';});return;}
 if(name==='refresh'){if(Cloud.admin){await runNetwork(async()=>{await Cloud.refresh();toast(t('refreshed'));});}return;}
 if(name==='clear'&&state.dataset==='real'){
  if(!Cloud.admin)return;
  if(!await ask(t('clearTitle')+' · '+t('realData'),t('clearCloudBody')))return;
  await runNetwork(async()=>{await Cloud.clear();applyOwn();state.test=null;toast(t('cleared'));});return;
 }
 if(name==='study-open'){
  if(!Cloud.admin)return;
  await runNetwork(async()=>{await Cloud.setOpen(!Cloud.isOpen);await Cloud.refresh();});return;
 }
 if(name==='copy-link'){
  const link=participantLink();
  try{await navigator.clipboard.writeText(link);toast(t('linkCopied'));}catch{toast(link);}
  return;
 }
 if(name==='live'&&!Cloud.admin){state.view='research';render();return;}
 if(['csv','json','import'].includes(name)&&!Cloud.admin)return;
 if(name==='csv'||name==='json'){
  if(state.dataset==='real'&&Cloud.admin)await runNetwork(()=>Cloud.refresh());
  if(state.networkError)return;
 }
 // Local-only demonstration controls and shared navigation remain in the base UI.
 await localAction(name,value);
}

// Refresh charts only while a researcher is viewing results, without disturbing forms/dialogs.
setInterval(async()=>{
 if(!Cloud.admin||state.dataset!=='real'||state.busy||state.polling||modalPending||document.visibilityState==='hidden')return;
 if(!(state.view==='live'||state.view==='research'&&state.tab==='overview'))return;
 state.polling=true;
 try{await Cloud.refresh();state.networkError=null;render(false);}catch(error){state.networkError=error;render(false);}finally{state.polling=false;}
},Cloud.pollIntervalMs);
render(false);
(async()=>{
 try{await Cloud.init();applyOwn();}
 catch(error){state.networkError=error;}
 finally{state.ready=true;render(false);}
})();
