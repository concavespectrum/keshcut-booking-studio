/* KeshCut online booking, "Your bookings" and live chat. All checks that matter run on the server;
   this file only renders. The quick math check is a simple client-side CAPTCHA by design. */
(function(){
const $=s=>document.querySelector(s),API='/api/public/kc',RT=window.KC_RT||{};
let SV=[[1,'Haircut & Modern Hairstyles',30],[2,'Beard Trimming & Styling',20],[3,'Hair Coloring & Highlights',90],[4,'Hair Perming',120],[5,'Dreadlocks (Locs) Styling',180],[6,'Hair Washing & Cleansing',15],[7,'Facial Treatments',45],[8,'Hair & Scalp Care',30],[9,'Hair Styling & Blow Dry',30],[10,'Professional Grooming',60],[11,'Barber Training & Academy Courses',30],[13,'Others',30]];
let DUR=Object.fromEntries(SV.map(s=>[s[0],s[2]]));const PRICE={},OPEN=540,CLOSE=1140,STEP=5;
const ST={pending:'Pending',confirmed:'Confirmed',completed:'Completed',cancelled:'Cancelled',no_show:'Missed'};
const el=(t,a={},...k)=>{const e=document.createElement(t);for(const x in a){if(x==='text')e.textContent=a[x];else if(x.startsWith('on'))e[x]=a[x];else e.setAttribute(x,a[x])}k.forEach(c=>c&&e.append(c));return e};
const api=async(m,q,b)=>{const r=await fetch(API+(q||''),{method:m,headers:b?{'content-type':'application/json'}:{},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Something went wrong. Please try again.');return j};
const show=(n,m)=>{n.textContent=m||'';n.hidden=!m};
function cap(lbl){const a=1+Math.floor(Math.random()*9),b=1+Math.floor(Math.random()*9);lbl.textContent=`Verify you're not a bot: what is ${a} + ${b}?`;return a+b}
let me=null;

/* ---- service checkboxes ---- */
function svcList(box,name,checked){SV.forEach(([id,n])=>{const i=el('input',{type:'checkbox',name,value:id});if(checked&&checked.includes(id))i.checked=true;box.append(el('label',{class:'kc-chk'},i,document.createTextNode(' '+n+(PRICE[id]!=null?' · Rs '+PRICE[id]:''))))})}
const F=$('#tk'),svcs=$('#svcs');svcList(svcs,'svc');
/* live service list, prices and studio media (admins edit these) */
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const murl=p=>p.startsWith('/')?p:API+'?file='+encodeURIComponent(p);
fetch(API+'?site=1').then(r=>r.ok?r.json():null).then(d=>{if(!d)return;
 if(d.services&&d.services.length){const keep=picked(svcs);SV=d.services.map(x=>[x.id,x.name,x.duration_min]);DUR=Object.fromEntries(SV.map(x=>[x[0],x[2]]));
  d.services.forEach(x=>{PRICE[x.id]=x.price_npr});svcs.innerHTML='';svcList(svcs,'svc',keep);syncOther();
  const ul=$('#svc'),ids=new Set(SV.map(x=>x[0]));
  ul.querySelectorAll('[data-m]').forEach(a=>{const id=+a.dataset.m+1,sv=SV.find(x=>x[0]===id);if(!sv){a.parentElement.hidden=true;return}a.querySelector('.nm').textContent=sv[1]+(PRICE[id]!=null?' · Rs '+PRICE[id]:'')});
  SV.filter(x=>x[0]>13&&!ul.querySelector(`[data-m="${x[0]-1}"]`)).forEach(x=>{const li=document.createElement('li');li.innerHTML=`<a class="row" data-m="${x[0]-1}" href="#book"><span class="nm">${esc(x[1])}${PRICE[x[0]]!=null?' · Rs '+PRICE[x[0]]:''}</span><span class="go">Book<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span></a>`;const o=ul.querySelector('[data-m="12"]');o?ul.insertBefore(li,o.parentElement):ul.append(li)});
  ids.size&&slots()}
 const md=d.media||[],teach=md.filter(m=>m.section==='teach'),studio=md.filter(m=>m.section==='studio');
 const cl=$('#academy .clips');if(cl){cl.innerHTML=teach.map(m=>m.kind==='video'?`<li><button type="button" class="clip" data-src="${esc(murl(m.path))}" data-poster="${esc(m.poster?murl(m.poster):'')}" data-title="${esc(m.title)}" aria-label="Play video: ${esc(m.title)}"><img src="${esc(m.poster?murl(m.poster):'/images/general/og-image.jpg')}" alt="${esc(m.title)}" width="540" height="960" loading="lazy" decoding="async"><span class="pl" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span><span class="cap">${esc(m.title)}</span></button></li>`:`<li><img class="clip-img" src="${esc(murl(m.path))}" alt="${esc(m.title)}" width="540" height="960" loading="lazy" decoding="async"></li>`).join('');cl.closest('.clips-wrap').hidden=!teach.length}
 const g=$('#studio .grid');if(g){g.innerHTML=studio.map(m=>m.kind==='video'?`<video src="${esc(murl(m.path))}" ${m.poster?`poster="${esc(murl(m.poster))}"`:''} controls playsinline preload="none" width="720" height="960" aria-label="${esc(m.title)}"></video>`:`<img src="${esc(murl(m.path))}" alt="${esc(m.title)}" width="720" height="960" loading="lazy" decoding="async">`).join('');$('#studio').hidden=!studio.length}
}).catch(()=>{});
const picked=root=>[...root.querySelectorAll('input[type=checkbox]:checked')].map(i=>+i.value);
document.addEventListener('click',e=>{const a=e.target.closest('[data-m]');if(a){const c=svcs.querySelector(`input[value="${+a.dataset.m+1}"]`);if(c){c.checked=true;syncOther();slots()}}});

/* ---- dates and free times (Kathmandu time, UTC+05:45) ---- */
const ktmNow=()=>new Date(Date.now()+345*60000),iso=d=>d.toISOString().slice(0,10);
const dt=$('#dt'),tm=$('#tm');dt.min=iso(ktmNow());dt.max=iso(new Date(ktmNow().getTime()+59*864e5));
const busyCache={};
async function slots(){
 const d=dt.value,dur=picked(svcs).reduce((s,i)=>s+DUR[i],0);tm.innerHTML='';
 if(!d){tm.append(el('option',{value:'',text:'Choose a date first'}));return}
 if(!dur){tm.append(el('option',{value:'',text:'Choose a service first'}));return}
 tm.append(el('option',{value:'',text:'Loading times…'}));
 try{const b=busyCache[d]&&Date.now()-busyCache[d].t<15000?busyCache[d].v:(busyCache[d]={t:Date.now(),v:((await api('GET','?busy='+d)).busy||[])}).v;
  const busy=b.map(([s,e])=>[Date.parse(s),Date.parse(e)]),opts=[];
  for(let m=OPEN;m+dur<=CLOSE;m+=STEP){const hh=String(m/60|0).padStart(2,'0'),mm=String(m%60).padStart(2,'0'),st=Date.parse(`${d}T${hh}:${mm}:00+05:45`),en=st+dur*60000;
   if(st<Date.now()+15*60000)continue;if(busy.some(([s,e])=>st<e&&en>s))continue;
   const h12=((m/60|0)%12)||12;opts.push(el('option',{value:new Date(st).toISOString(),text:`${h12}:${mm} ${m<720?'AM':'PM'}`}))}
  tm.innerHTML='';tm.append(el('option',{value:'',text:opts.length?'Choose a time':'No free times on this day'}),...opts)
 }catch(e){tm.innerHTML='';tm.append(el('option',{value:'',text:'Could not load times'}))}}
const other=$('#other-service');
function syncOther(){const yes=picked(svcs).includes(13);$('#other-wrap').hidden=!yes;other.required=yes}
dt.onchange=slots;svcs.onchange=()=>{syncOther();slots()};

/* ---- booking submit ---- */
let capA=cap($('#capq'));
F.onsubmit=async e=>{e.preventDefault();const err=$('#err');show(err);
 const s=picked(svcs),name=$('#nm').value.trim(),phone=$('#ph').value.trim();
 if(!s.length)return show(err,'Please choose at least one service.');
  if(s.includes(13)&&!other.value.trim())return show(err,'Please describe the service you need.');
 if(!dt.value||!tm.value)return show(err,'Please choose a date and an available time.');
 if(!name)return show(err,'Please enter your name.');
 if(!/^\+?[\d\s-]{9,18}$/.test(phone))return show(err,'Please enter a valid phone number.');
 if(+$('#cap').value!==capA){capA=cap($('#capq'));$('#cap').value='';return show(err,'The quick check answer is not right. Please try again.')}
 const btn=F.querySelector('button[type=submit]');btn.disabled=true;
 try{const r=await api('POST','',{action:'book',services:s,start:tm.value,name,phone,custom:other.value.trim()});
  $('#tid').textContent=r.ticket_id;$('#ok').hidden=false;delete busyCache[dt.value];slots();window.track&&window.track('booking_created',{});
  await loadMe();$('#ok').scrollIntoView({block:'nearest',behavior:'smooth'})
 }catch(x){show(err,x.message);delete busyCache[dt.value];slots()}
 finally{btn.disabled=false;capA=cap($('#capq'));$('#cap').value=''}};

/* ---- your bookings ---- */
const fmt=s=>new Date(s).toLocaleString('en-GB',{timeZone:'Asia/Kathmandu',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
function renderMe(){
 const box=$('#mine'),list=$('#mylist');if(!me||!me.bookings.length){box.hidden=true;if(!me||!me.bookings.some(b=>b.ticket_id===$('#tid').textContent))$('#ok').hidden=true;if(!me){M.innerHTML='';last=0}return}
 if(!me.bookings.some(b=>b.ticket_id===$('#tid').textContent))$('#ok').hidden=true;
 box.hidden=false;$('#hello').textContent='Welcome back, '+me.name;
 if(!$('#nm').value)$('#nm').value=me.name;if(!$('#ph').value)$('#ph').value=me.phone;
 list.innerHTML='';if(!me.bookings.length)list.append(el('p',{class:'note',text:'No bookings yet.'}));
 me.bookings.forEach(b=>{
  const ids=(b.services||[]).map(x=>x.id),open=(b.status==='pending'||b.status==='confirmed')&&Date.parse(b.starts_at)>Date.now();
  const card=el('div',{class:'kc-bk'},el('p',{},el('b',{text:b.ticket_id}),document.createTextNode(' · '),el('span',{class:'kc-st kc-'+b.status,text:ST[b.status]||b.status})),
   el('p',{text:fmt(b.starts_at)}),el('p',{class:'kc-mut',text:(b.services||[]).map(x=>x.name).join(', ')+(b.total_price_npr!=null?` · Rs ${b.total_price_npr}`:'')}));
  if(b.custom_service)card.append(el('p',{class:'kc-custom-text',text:'Others: '+b.custom_service}));
   if(open){const msg=el('p',{class:'kc-err',role:'alert',hidden:''}),ed=el('fieldset',{class:'kc-svc',hidden:''},el('legend',{text:'Services for this booking'}));svcList(ed,'e'+b.ticket_id,ids);
    const custom=el('textarea',{rows:'3',maxlength:'500',id:'other-'+b.ticket_id});custom.value=b.custom_service||'';
    const customWrap=el('div',{},el('label',{for:'other-'+b.ticket_id,text:'Describe the service you need'}),custom);
    const sync=()=>{customWrap.hidden=!picked(ed).includes(13);custom.required=!customWrap.hidden};ed.onchange=sync;sync();ed.append(customWrap);
   const save=el('button',{type:'button',class:'btn',text:'Save services',onclick:async()=>{show(msg);if(picked(ed).includes(13)&&!custom.value.trim())return show(msg,'Please describe the service you need.');try{await api('POST','',{action:'update',ticket:b.ticket_id,services:picked(ed),custom:custom.value.trim()});await loadMe()}catch(x){show(msg,x.message)}}});
   const row=el('div',{class:'kc-row'},el('button',{type:'button',class:'lk',text:'Change or add services',onclick:()=>{ed.hidden=!ed.hidden}}),
    el('button',{type:'button',class:'lk',text:'Cancel booking',onclick:async()=>{if(!confirm('Cancel booking '+b.ticket_id+'?'))return;try{await api('POST','',{action:'cancel',ticket:b.ticket_id});await loadMe();delete busyCache[dt.value];slots()}catch(x){show(msg,x.message)}}}));
   ed.append(save);card.append(row,ed,msg)}
  list.append(card)})}
async function loadMe(){try{me=(await api('GET','')).me}catch(e){}renderMe();connect()}

/* ---- live updates: a data-free "doorbell" on a private random channel, then refetch ---- */
let ws=null,joined='',hb=0,retry=0;
function connect(){
 if(!me||!me.channel||!RT.url||joined===me.channel&&ws)return;
 if(ws)try{ws.close()}catch(e){}
 const topic='realtime:kc-'+me.channel;joined=me.channel;
 ws=new WebSocket(RT.url.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(RT.key)+'&vsn=1.0.0');
 let ref=1;const send=(t,ev,p)=>ws.readyState===1&&ws.send(JSON.stringify({topic:t,event:ev,payload:p,ref:String(ref++)}));
 ws.onopen=()=>{retry=0;send(topic,'phx_join',{config:{broadcast:{self:false},presence:{key:''},private:false}});clearInterval(hb);hb=setInterval(()=>send('phoenix','heartbeat',{}),25000)};
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}if(m.event!=='broadcast')return;const k=m.payload&&m.payload.payload&&m.payload.payload.k;
  if(k==='booking'){for(const d in busyCache)delete busyCache[d];loadMe();slots();}if(k==='message'){pull();if($('#chat').open===false)$('#chatbtn').classList.add('kc-new')}};
 ws.onclose=()=>{clearInterval(hb);ws=null;const c=joined;joined='';if(me&&me.channel===c)setTimeout(connect,Math.min(30000,1000*2**retry++))}}

/* ---- chat ---- */
const D=$('#chat'),M=$('#msgs');let last=0,ccap=0;
function addMsg(m){if(m.id<=last)return;last=m.id;M.append(el('div',{class:'kc-m kc-'+m.sender},el('p',{text:m.body}),el('small',{text:(m.sender==='admin'?'KeshCut Studio · ':'You · ')+fmt(m.at)})));M.scrollTop=M.scrollHeight}
async function pull(){if(!me)return;try{const ms=(await api('GET','?messages=1&after=0')).messages;if(!ms.length||ms[ms.length-1].id<last){M.innerHTML='';last=0}ms.forEach(addMsg)}catch(e){}}
$('#chatbtn').onclick=()=>{$('#chatbtn').classList.remove('kc-new');const need=!me;$('#chatid').hidden=!need;if(need){ccap=cap($('#ccapq'));$('#cnm').value=$('#nm').value;$('#cph').value=$('#ph').value}
 if(!M.childElementCount&&!me)M.append(el('p',{class:'kc-mut',text:'Ask anything about services, times or the academy. The studio replies here.'}));D.showModal();pull()};
D.querySelector('.lg-x').onclick=()=>D.close();D.addEventListener('click',e=>{if(e.target===D)D.close()});
$('#chatf').onsubmit=async e=>{e.preventDefault();const t=$('#cmsg'),err=$('#cerr'),body=t.value.trim();show(err);if(!body)return;
 const b={action:'message',body};
 if(!me){b.name=$('#cnm').value.trim();b.phone=$('#cph').value.trim();if(!b.name||!b.phone)return show(err,'Please enter your name and phone number.');
  if(+$('#ccap').value!==ccap){ccap=cap($('#ccapq'));$('#ccap').value='';return show(err,'The quick check answer is not right.')}}
 const btn=e.target.querySelector('button');btn.disabled=true;
 try{await api('POST','',b);t.value='';if(!me){await loadMe();$('#chatid').hidden=true;M.innerHTML=''}await pull()}catch(x){show(err,x.message)}finally{btn.disabled=false}};
$('#cmsg').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chatf').requestSubmit()}});
/* block pasting/dropping files: text and emoji only */
['#cmsg'].forEach(s=>{const n=$(s);n.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length)e.preventDefault()});n.addEventListener('paste',e=>{if(e.clipboardData&&e.clipboardData.files.length)e.preventDefault()})});

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&me){loadMe();pull()}});
loadMe();
})();
