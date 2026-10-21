const $=id=>document.getElementById(id);
let appData=null, screen='meal', selectedExercise='', selectedWorkoutDate='', monthCursor=new Date();
const DEFAULT_GOALS={kcal:1750,ratioP:17.4,ratioF:31.4,ratioC:51.2};
function goalsFromRatios(kcal,ratioP,ratioF,ratioC){return {kcal,ratioP,ratioF,ratioC,p:kcal*ratioP/100/4,f:kcal*ratioF/100/9,c:kcal*ratioC/100/4};}
function loadGoals(){
 try{
  const saved=JSON.parse(localStorage.getItem('mealLogGoalsV2')||'null');
  if(saved&&Number(saved.kcal)>0){
   const ratioP=Number(saved.ratioP??saved.p??DEFAULT_GOALS.ratioP);
   const ratioF=Number(saved.ratioF??saved.f??DEFAULT_GOALS.ratioF);
   const ratioC=Number(saved.ratioC??saved.c??DEFAULT_GOALS.ratioC);
   if([ratioP,ratioF,ratioC].every(Number.isFinite)&&Math.abs(ratioP+ratioF+ratioC-100)<0.1)
    return goalsFromRatios(Number(saved.kcal),ratioP,ratioF,ratioC);
  }
 }catch(e){}
 return goalsFromRatios(DEFAULT_GOALS.kcal,DEFAULT_GOALS.ratioP,DEFAULT_GOALS.ratioF,DEFAULT_GOALS.ratioC);
}
let goals=loadGoals();
const mealHeaders={date:'日付',mealType:'食事区分',kcal:'カロリー(kcal)',p:'たんぱく質P(g)',f:'脂質F(g)',c:'炭水化物C(g)',water:'水分量(mL)',food:'食品・メニュー'};
const workoutHeaders={date:'日付',name:'種目',part:'部位',weight:'重量(kg)',reps:'回数',sets:'セット数',note:'メモ'};
const fmt=(v,d=0)=>Number(v||0).toLocaleString('ja-JP',{maximumFractionDigits:d,minimumFractionDigits:d});
function num(v){if(v===''||v===null||v===undefined)return 0;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:0}
function dateKey(v){
 if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
 const s=String(v??'').trim();let m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
 if(typeof v==='number'&&v>20000){const d=new Date(Math.round((v-25569)*86400*1000));return dateKey(d)}return '';
}
function parseRows(rows,kind){
 return (rows||[]).map(r=>({
  raw:r,date:dateKey(r[kind==='meal'?mealHeaders.date:workoutHeaders.date]),
  name:String(r[kind==='meal'?mealHeaders.food:workoutHeaders.name]||'').trim(),
  mealType:kind==='meal'?String(r[mealHeaders.mealType]||'').trim():'',
  part:String(r[workoutHeaders.part]||'').trim(),
  kcal:num(r[mealHeaders.kcal]),p:num(r[mealHeaders.p]),f:num(r[mealHeaders.f]),c:num(r[mealHeaders.c]),water:num(r[mealHeaders.water]),
  weight:r[workoutHeaders.weight]===''||r[workoutHeaders.weight]===null||r[workoutHeaders.weight]===undefined?'':num(r[workoutHeaders.weight]),
  reps:r[workoutHeaders.reps]===''||r[workoutHeaders.reps]===null||r[workoutHeaders.reps]===undefined?'':num(r[workoutHeaders.reps]),
  sets:r[workoutHeaders.sets]===''||r[workoutHeaders.sets]===null||r[workoutHeaders.sets]===undefined?'':num(r[workoutHeaders.sets]),
  note:String(r[workoutHeaders.note]||'').trim()
 })).filter(r=>r.date);
}
function dayAggregate(rows,date){
 const matched=rows.filter(r=>r.date===date);if(!matched.length)return {date,recorded:false,entries:0,kcal:0,p:0,f:0,c:0,water:0};
 const sum=k=>matched.reduce((s,r)=>s+r[k],0);
 return {date,recorded:true,entries:matched.length,kcal:sum('kcal'),p:sum('p'),f:sum('f'),c:sum('c'),water:sum('water')};
}
function dateOffset(offset){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return keyFromDate(d)}
function keyFromDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function displayDate(key,withWeek=true){const d=new Date(key+'T12:00:00');return `${d.getMonth()+1}/${d.getDate()}${withWeek?' ('+'日月火水木金土'[d.getDay()]+')':''}`}
function aggregateRange(rows,n){const days=[];for(let i=n-1;i>=0;i--)days.push(dayAggregate(rows,dateOffset(-i)));return days}
function sumAvg(days,key){const recorded=days.filter(d=>d.recorded);return {days:recorded.length,value:recorded.length?recorded.reduce((s,d)=>s+d[key],0)/recorded.length:null}}
function setText(id,v){$(id).textContent=v}
function renderMealSummary(rows,date){
 const todays=rows.filter(r=>r.date===date);
 const groups=[
  {label:'朝',match:/朝|朝食|breakfast/i},
  {label:'昼',match:/昼|昼食|ランチ|lunch/i},
  {label:'夜',match:/夜|晩|夕食|夕飯|dinner/i},
  {label:'間食',match:/間食|おやつ|snack/i}
 ];
 const sums=groups.map(g=>{const list=todays.filter(r=>g.match.test(r.mealType));return {label:g.label,kcal:list.reduce((s,r)=>s+r.kcal,0),p:list.reduce((s,r)=>s+r.p,0),f:list.reduce((s,r)=>s+r.f,0),c:list.reduce((s,r)=>s+r.c,0)}});
 const known=new Set(todays.filter(r=>groups.some(g=>g.match.test(r.mealType))));
 const others=todays.filter(r=>!groups.some(g=>g.match.test(r.mealType)));
 if(others.length)sums.push({label:'その他',kcal:others.reduce((s,r)=>s+r.kcal,0),p:others.reduce((s,r)=>s+r.p,0),f:others.reduce((s,r)=>s+r.f,0),c:others.reduce((s,r)=>s+r.c,0)});
 $('mealSummaryRows').innerHTML=sums.map(g=>`<div class="meal-summary-row"><span class="meal-summary-name">${g.label}</span><span class="meal-summary-values"><b>${fmt(g.kcal)} kcal</b>（P${fmt(g.p,1)} F${fmt(g.f,1)} C${fmt(g.c,1)} g）</span></div>`).join('');
}
function renderMeal(){
 const rows=appData.meals,today=dayAggregate(rows,dateOffset(0)),g=goals;
 setText('goalKcal',fmt(g.kcal));setText('goalP',fmt(g.p));setText('goalF',fmt(g.f));setText('goalC',fmt(g.c));
 setText('kcal',today.recorded?fmt(today.kcal):'—');setText('p',today.recorded?fmt(today.p,1)+' g':'—');setText('f',today.recorded?fmt(today.f,1)+' g':'—');setText('c',today.recorded?fmt(today.c,1)+' g':'—');setText('water',today.recorded?fmt(today.water)+' mL':'—');
 setText('kcalDiff',today.recorded?diffLabel(today.kcal,g.kcal,'kcal'):'未記録');
 const pk=today.p*4,fk=today.f*9,ck=today.c*4,macro=pk+fk+ck,gramsPfc=Math.max(0,today.p)+Math.max(0,today.f)+Math.max(0,today.c);
 $('pfcProgress').style.width=today.recorded?Math.min(100,Math.max(0,today.kcal/g.kcal*100))+'%':'0%';
 $('pSeg').style.width=gramsPfc?Math.max(0,today.p)/gramsPfc*100+'%':'0%';$('fSeg').style.width=gramsPfc?Math.max(0,today.f)/gramsPfc*100+'%':'0%';$('cSeg').style.width=gramsPfc?Math.max(0,today.c)/gramsPfc*100+'%':'0%';
 setText('pfcCurrent',`PFC合計 ${today.recorded?fmt(gramsPfc,1):'—'} g`);setText('pfcGoal','各色の割合＝P・F・Cの摂取グラム比');
 setText('pLegend',today.recorded?`${fmt(today.p,1)}g · ${gramsPfc?fmt(today.p/gramsPfc*100,1):'0.0'}%`:'—');setText('fLegend',today.recorded?`${fmt(today.f,1)}g · ${gramsPfc?fmt(today.f/gramsPfc*100,1):'0.0'}%`:'—');setText('cLegend',today.recorded?`${fmt(today.c,1)}g · ${gramsPfc?fmt(today.c/gramsPfc*100,1):'0.0'}%`:'—');
 setText('pDiff',today.recorded?diffLabel(today.p,g.p,'g'):'—');setText('fDiff',today.recorded?diffLabel(today.f,g.f,'g'):'—');setText('cDiff',today.recorded?diffLabel(today.c,g.c,'g'):'—');
 setText('todayNote',today.recorded?`食事記録 ${today.entries} 件`:'今日はまだ記録がありません（0として扱いません）。');
 renderMealSummary(rows,dateOffset(0));
 renderTrend();
}
function diffLabel(actual,target,unit){const diff=target-actual;if(Math.abs(diff)<0.05)return '目標達成';return diff>0?`あと ${fmt(diff,1)} ${unit}`:`${fmt(Math.abs(diff),1)} ${unit} 超過`}
function renderTrend(){
 const n=Number(document.querySelector('[data-range].active').dataset.range),days=aggregateRange(appData.meals,n),recorded=days.filter(d=>d.recorded);
  setText('trendTitle',`直近${n}日間`);const goalMacro=goals.p*4+goals.f*9+goals.c*4;
  $('trendList').innerHTML=days.map(d=>{const grams=Math.max(0,d.p)+Math.max(0,d.f)+Math.max(0,d.c),progress=d.recorded?Math.min(100,Math.max(0,d.kcal/goals.kcal*100)):0;const pp=grams?Math.max(0,d.p)/grams*100:0,fp=grams?Math.max(0,d.f)/grams*100:0,cp=grams?Math.max(0,d.c)/grams*100:0;return `<div class="day-row ${d.recorded?'':'missing'}"><span class="day-date">${displayDate(d.date,false)}</span><div class="trend-pfc" title="カロリー進捗 ${fmt(d.kcal)} / ${fmt(goals.kcal)} kcal。内訳 P ${fmt(d.p,1)}g / F ${fmt(d.f,1)}g / C ${fmt(d.c,1)}g"><div class="trend-pfc-fill" style="width:${progress}%"><span style="width:${pp}%;background:var(--p)"></span><span style="width:${fp}%;background:var(--f)"></span><span style="width:${cp}%;background:var(--c)"></span></div></div><span style="text-align:right">${d.recorded?fmt(d.kcal)+' kcal':'未記録'}</span></div>${d.recorded?`<div class="trend-legend">P ${fmt(d.p,0)}g · F ${fmt(d.f,0)}g · C ${fmt(d.c,0)}g</div>`:''}`}).join('');
 setText('trendNote',`記録日 ${recorded.length} / ${n} 日。未記録日は平均から除外。`);
 const ak=sumAvg(days,'kcal'),ap=sumAvg(days,'p'),aw=sumAvg(days,'water');setText('avgKcal',ak.days?fmt(ak.value):'—');setText('avgP',ap.days?fmt(ap.value,1)+' g':'—');setText('avgWater',aw.days?fmt(aw.value)+' mL':'—');
}
function setScreen(next){
 screen=next;const meal=next==='meal',detail=next==='detail';$('mealScreen').classList.toggle('hidden',!meal);$('workoutScreen').classList.toggle('hidden',next!=='workout');$('detailScreen').classList.toggle('hidden',!detail);
 $('navMeal').classList.toggle('active',meal);$('navWorkout').classList.toggle('active',!meal);setText('pageTitle',meal?'食事':detail?'種目詳細':'筋トレ');
}
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function renderWorkoutList(){
 const key=monthKey(monthCursor);setText('monthLabel',`${monthCursor.getFullYear()}年${monthCursor.getMonth()+1}月`);
 const rows=appData.workouts.filter(r=>r.date.startsWith(key)).sort((a,b)=>a.date.localeCompare(b.date));
 const dates=new Set(rows.map(r=>r.date));
 const first=new Date(monthCursor.getFullYear(),monthCursor.getMonth(),1),daysInMonth=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,0).getDate();
 const offset=first.getDay();
 const weekdays=['日','月','火','水','木','金','土'];
 $('workoutCalendar').innerHTML=weekdays.map(d=>`<div class="calendar-weekday">${d}</div>`).join('')+
   Array.from({length:offset},()=>'<div></div>').join('')+
   Array.from({length:daysInMonth},(_,i)=>{const d=new Date(monthCursor.getFullYear(),monthCursor.getMonth(),i+1),date=keyFromDate(d),has=dates.has(date),selected=date===selectedWorkoutDate;return `<button class="calendar-day ${has?'has-workout':''} ${selected?'selected':''}" data-date="${date}" aria-label="${date}${has?' トレーニングあり':''}">${i+1}</button>`}).join('');
 $('workoutCalendar').querySelectorAll('[data-date]').forEach(btn=>btn.addEventListener('click',()=>{selectedWorkoutDate=btn.dataset.date;renderWorkoutList()}));
 if(!selectedWorkoutDate||!selectedWorkoutDate.startsWith(key)){
   const today=keyFromDate(new Date());selectedWorkoutDate=dates.has(today)?today:(Array.from(dates).sort().reverse()[0]||keyFromDate(new Date(monthCursor.getFullYear(),monthCursor.getMonth(),1)));
   $('workoutCalendar').querySelectorAll('[data-date]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.date===selectedWorkoutDate));
 }
 const dayRows=rows.filter(r=>r.date===selectedWorkoutDate).sort((a,b)=>a.name.localeCompare(b.name));
 setText('selectedDateLabel',displayDate(selectedWorkoutDate));setText('selectedDayCount',dayRows.length?`${dayRows.length}種目`:'');
 $('workoutEmpty').classList.toggle('hidden',dayRows.length>0);
 $('workoutList').innerHTML=dayRows.map(r=>`<button class="exercise" data-exercise="${escapeAttr(r.name)}"><span><span class="exercise-name">${escapeHtml(r.name||'名称未入力')}</span><div class="exercise-meta">${r.weight!==''?fmt(r.weight,1)+' kg':'重量記録なし'}${r.sets!==''?' ・ '+fmt(r.sets)+'セット':''}</div></span><span class="chevron">›</span></button>`).join('');
 $('workoutList').querySelectorAll('[data-exercise]').forEach(btn=>btn.addEventListener('click',()=>openDetail(btn.dataset.exercise)));
 $('nextMonth').disabled=key>=monthKey(new Date());
}
function openDetail(name){
 selectedExercise=name;const rows=appData.workouts.filter(r=>r.name===name).sort((a,b)=>b.date.localeCompare(a.date));
 if(!rows.length)return;setScreen('detail');setText('detailName',name);setText('detailPart',rows.find(r=>r.part)?.part||'種目詳細');
 renderChart(rows);$('historyList').innerHTML=rows.map(r=>`<div class="history-row"><div class="history-date">${displayDate(r.date,false)}</div><div class="history-main">${r.weight!==''?fmt(r.weight,1)+' kg':'自重'} × ${r.reps!==''?fmt(r.reps)+'回':'—回'} × ${r.sets!==''?fmt(r.sets)+'セット':'—セット'}${r.note?`<div class="history-note">${escapeHtml(r.note)}</div>`:''}</div></div>`).join('');
}
function weightLabel(r){return r.weight!==''?`${fmt(r.weight,1)} kg`:'重量記録なし'}
function renderChart(rows){
 const canvas=$('progressChart'),ctx=canvas.getContext('2d'),sorted=rows.slice().sort((a,b)=>a.date.localeCompare(b.date)).filter(r=>r.weight!=='');
 const hasWeight=sorted.length>1;$('chartPanel').classList.toggle('hidden',!hasWeight);
 if(!hasWeight)return;
 const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||320,h=220;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const left=38,right=12,top=15,bottom=32,cw=w-left-right,ch=h-top-bottom;
 let min=Math.min(...sorted.map(r=>r.weight)),max=Math.max(...sorted.map(r=>r.weight));if(min===max){min=Math.max(0,min-1);max=max+1}else{const pad=(max-min)*.12;min=Math.max(0,min-pad);max+=pad}
 ctx.font='10px sans-serif';ctx.strokeStyle='#e4e8e4';ctx.fillStyle='#727a75';ctx.lineWidth=1;
 for(let i=0;i<4;i++){const y=top+ch*i/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillText(fmt(max-(max-min)*i/3,1),2,y+3)}
 const pts=sorted.map((r,i)=>({x:left+(i/Math.max(1,sorted.length-1))*cw,y:top+ch-(r.weight-min)/(max-min)*ch,r}));ctx.strokeStyle='#326b50';ctx.fillStyle='#326b50';ctx.lineWidth=2;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill()});
 const first=new Date(sorted[0].date+'T12:00:00'),last=new Date(sorted[sorted.length-1].date+'T12:00:00');ctx.fillStyle='#727a75';ctx.font='10px sans-serif';ctx.fillText(`${first.getMonth()+1}/${first.getDate()}`,left,h-8);const end=`${last.getMonth()+1}/${last.getDate()}`;ctx.fillText(end,w-right-ctx.measureText(end).width,h-8);
 setText('chartNote',`重量記録 ${sorted.length}回分。重量が入力されている記録のみ表示しています。`);
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escapeAttr(s){return escapeHtml(s)}
function updateGoalPreview(){const kcal=Number($('inputGoalKcal').value),p=Number($('inputRatioP').value),f=Number($('inputRatioF').value),c=Number($('inputRatioC').value),sum=p+f+c;const valid=kcal>0&&p>=0&&f>=0&&c>=0;const pk=kcal*p/100,fk=kcal*f/100,ck=kcal*c/100;setText('goalCalcPreview',valid?`P ${fmt(pk/4,1)} g（${fmt(pk)} kcal） / F ${fmt(fk/9,1)} g（${fmt(fk)} kcal） / C ${fmt(ck/4,1)} g（${fmt(ck)} kcal）`:'目標値を入力してください。');setText('ratioSumNote',`PFC比率の合計：${fmt(sum,1)}%${Math.abs(sum-100)<0.01?'（OK）':'（100%にしてください）'}`);$('ratioSumNote').style.color=Math.abs(sum-100)<0.01?'var(--green)':'var(--red)';}
function openSettings(){ $('inputGoalKcal').value=goals.kcal;$('inputRatioP').value=goals.ratioP;$('inputRatioF').value=goals.ratioF;$('inputRatioC').value=goals.ratioC;updateGoalPreview();$('settingsPanel').classList.remove('hidden');$('toggleSettings').textContent='目標設定を閉じる';}
function closeSettings(){$('settingsPanel').classList.add('hidden');$('toggleSettings').textContent='目標を変更';}
$('toggleSettings').addEventListener('click',()=>{$('settingsPanel').classList.contains('hidden')?openSettings():closeSettings()});
$('cancelSettings').addEventListener('click',closeSettings);
['inputGoalKcal','inputRatioP','inputRatioF','inputRatioC'].forEach(id=>$(id).addEventListener('input',updateGoalPreview));
$('saveSettings').addEventListener('click',()=>{const kcal=Number($('inputGoalKcal').value),ratioP=Number($('inputRatioP').value),ratioF=Number($('inputRatioF').value),ratioC=Number($('inputRatioC').value),sum=ratioP+ratioF+ratioC;if(!Number.isFinite(kcal)||kcal<=0||![ratioP,ratioF,ratioC].every(v=>Number.isFinite(v)&&v>=0&&v<=100)){alert('目標値を正しく入力してください。');return;}if(Math.abs(sum-100)>0.01){alert('PFC比率の合計を100%にしてください。');return;}const next={kcal,ratioP,ratioF,ratioC};$('saveSettings').disabled=true;$('saveSettings').textContent='保存中…';
 try{
  localStorage.setItem('mealLogGoalsV2',JSON.stringify(next));
  goals=goalsFromRatios(kcal,ratioP,ratioF,ratioC);
  $('saveSettings').disabled=false;$('saveSettings').textContent='保存';closeSettings();renderMeal();alert('目標設定をこのブラウザに保存しました。');
 }catch(e){$('saveSettings').disabled=false;$('saveSettings').textContent='保存';alert('設定を保存できませんでした。ブラウザの保存設定を確認してください。');}});
$('navMeal').addEventListener('click',()=>setScreen('meal'));$('navWorkout').addEventListener('click',()=>{setScreen('workout');renderWorkoutList()});$('backToList').addEventListener('click',()=>{setScreen('workout');renderWorkoutList()});
$('prevMonth').addEventListener('click',()=>{monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()-1,1);selectedWorkoutDate='';renderWorkoutList()});
$('nextMonth').addEventListener('click',()=>{monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,1);selectedWorkoutDate='';renderWorkoutList()});
document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-range]').forEach(x=>x.classList.toggle('active',x===b));renderTrend()}));

function showError(message){$('error').textContent=message;$('error').classList.remove('hidden');setText('stamp','接続エラー');}
function rowsAsObjects(values){
 if(!Array.isArray(values)||!values.length)return [];
 const headers=values[0].map(v=>String(v??'').trim());
 return values.slice(1).filter(row=>row.some(v=>v!==''&&v!=null)).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));
}
function connectGoogle(){
 const cfg=window.MEAL_CONFIG||{};
 if(!cfg.googleClientId){showError('OAuthクライアントIDが設定されていません。');return;}
 if(!window.google?.accounts?.oauth2){showError('Google認証を読み込めませんでした。ページを再読み込みしてください。');return;}
 $('connectBtn').disabled=true;$('connectBtn').textContent='接続中…';
 google.accounts.oauth2.initTokenClient({
  client_id:cfg.googleClientId,
  scope:'https://www.googleapis.com/auth/spreadsheets.readonly',
  callback:async response=>{
   if(response.error){showError('認証エラー: '+response.error);$('connectBtn').disabled=false;$('connectBtn').textContent='Googleに接続';return;}
   try{
    const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(cfg.spreadsheetId)+'/values:batchGet?'+['食事記録!A:J','筋トレ記録!A:G'].map(x=>'ranges='+encodeURIComponent(x)).join('&');
    const res=await fetch(url,{headers:{Authorization:'Bearer '+response.access_token}});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error?.message||'スプレッドシートを取得できませんでした');
    appData={
     meals:parseRows(rowsAsObjects(data.valueRanges?.[0]?.values||[]),'meal'),
     workouts:parseRows(rowsAsObjects(data.valueRanges?.[1]?.values||[]),'workout')
    };
    $('error').classList.add('hidden');
    $('connectBtn').disabled=false;$('connectBtn').textContent='再読み込み';
    setText('stamp','更新 '+new Date().toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}));
    renderMeal();renderWorkoutList();
   }catch(e){
    showError('データを読み込めませんでした：'+(e&&e.message?e.message:String(e))+'。シート名と読み取り権限を確認してください。');
    $('connectBtn').disabled=false;$('connectBtn').textContent='再試行';
   }
  }
 }).requestAccessToken({prompt:''});
}
$('connectBtn').addEventListener('click',connectGoogle);
setText('stamp','Googleアカウント未接続');
