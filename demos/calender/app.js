/**
 * /demos/calender/app.js
 *
 * Pattern:
 *   - Demo JS Pattern（設定 → 状態 → DOM参照 → ユーティリティ → 描画 → イベント登録 → 初期化）
 * Role:
 *   - 週ビューカレンダーの UI ロジック（localStorage 保存／ドラッグ編集／空き時間検索など）
 * Notes:
 *   - 本番コードではなく UI 実験用。ロジックを読みやすくすることを優先する。
 */

(() => {
  // ====== 設定 ======
  const STEP_MIN = 15;                 // 15分刻み
  const HOURS = { start: 0, end: 24 }; // 24h固定
  const STORAGE_KEY = 'mochi.calendar.v1';

  const COLORS = {
    Work: cssVar('--event-a'),
    Personal: cssVar('--event-b'),
    Mochitecture: cssVar('--event-c'),
    Research: cssVar('--event-d'),
  };

  // ====== 状態 ======
  let events = load();
  let currentMonday = startOfWeek(new Date());

  // ====== 要素参照ユーティリティ ======
  const $ = (q)=>document.querySelector(q);

  // ====== DOM 参照 ======
  const weekbar = $('#weekbar');
  const calendar = $('#calendar');
  const calendarWrap = $('#calendarWrap');
  const legendEl = $('#legend');

  const dialog = $('#eventDialog');
  const form = $('#eventForm');
  const delBtn = $('#deleteBtn');

  const finderDialog = $('#finderDialog');
  const calPick = $('#calPick');
  const runFinderBtn = $('#runFinder');
  const resultsEl = $('#finderResults');

  // ====== ユーティリティ関数 ======
  function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function pad2(n){ return String(n).padStart(2,'0'); }
  function toKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
  function minutes(d){ return d.getHours()*60 + d.getMinutes(); }
  function dateAt(dayBase, min){ const t=new Date(dayBase); t.setMinutes(min); return t; }
  function snap(m){ return Math.round(m/STEP_MIN)*STEP_MIN; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function isSameDay(a,b){ return a.getFullYear()==b.getFullYear() && a.getMonth()==b.getMonth() && a.getDate()==b.getDate(); }
  function startOfWeek(d){
    const x=new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day=x.getDay();
    const diff=(day===0?-6:1-day); // 月曜始まり
    x.setDate(x.getDate()+diff);
    x.setHours(0,0,0,0);
    return x;
  }
  function load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); }

  // ====== Legend ======
  function renderLegend(){
    legendEl.innerHTML='';
    Object.entries(COLORS).forEach(([name,color])=>{
      const span = document.createElement('span'); span.className='item';
      span.innerHTML = `<span class="sw" style="background:${color}"></span>${name}`;
      legendEl.appendChild(span);
    });
  }

  // ====== Render（週全体） ======
  function render(){
    // weekbar
    weekbar.innerHTML = '<div></div>';
    for(let i=0;i<7;i++){
      const d = new Date(currentMonday); d.setDate(currentMonday.getDate()+i);
      const dow = ['月','火','水','木','金','土','日'][i];
      const today = toKey(d) === toKey(new Date());
      weekbar.insertAdjacentHTML('beforeend', `
        <div class="dow">
          <span class="date" style="${today?'color:var(--accent)':''}">${d.getDate()}</span>${dow}
        </div>
      `);
    }

    // grid
    const rows = (HOURS.end - HOURS.start)*(60/STEP_MIN); // 96
    calendar.innerHTML = '';

    // 時刻カラム
    const times = document.createElement('div'); times.className='times';
    for(let r=0;r<rows;r++){
      const totalMin = HOURS.start*60 + r*STEP_MIN;
      times.insertAdjacentHTML('beforeend', `<div class="timecell">${totalMin%60===0?`${pad2(totalMin/60)}:00`:''}</div>`);
    }
    calendar.appendChild(times);

    // 日付カラム（7列）
    const columns=[];
    for(let i=0;i<7;i++){
      const col = document.createElement('div'); col.className='day'; col.dataset.day=i;
      for(let r=0;r<rows;r++) col.insertAdjacentHTML('beforeend','<div class="slot"></div>');
      calendar.appendChild(col); columns.push(col);

      // 新規作成（ドラッグ）
      col.addEventListener('pointerdown', (ev)=>onPointerDownCol(ev,col));
    }

    // イベント配置
    const ws = new Date(currentMonday);
    const we = new Date(currentMonday); we.setDate(we.getDate()+7);
    const visible = events.filter(e => new Date(e.end) > ws && new Date(e.start) < we);
    visible.forEach(e=>{
      const s = new Date(e.start), t = new Date(e.end);
      for(let d=new Date(s); d < t; ){
        const dayIdx = ((d.getDay()+6)%7);
        const dayDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const segStart = new Date(Math.max(+d, +dayDate));
        const dayEnd = new Date(dayDate); dayEnd.setDate(dayEnd.getDate()+1);
        const segEnd = new Date(Math.min(+t, +dayEnd));
        place(e, dayIdx, minutes(segStart), minutes(segEnd));
        d = dayEnd;
      }
    });

    drawNowLine();      // 今日の列だけに現在線
    autoscrollToNow();  // 初回は中央近くへ
  }

  function colGeom(col){
    const r = col.getBoundingClientRect();
    const rowH = col.querySelector('.slot').getBoundingClientRect().height;
    return { rect:r, rowH };
  }

  function place(e, dayIdx, startMin, endMin){
    const col = calendar.querySelector(`.day[data-day="${dayIdx}"]`); if(!col) return;
    const { rowH } = colGeom(col);
    const span = clamp(endMin - startMin, STEP_MIN, 24*60);
    const top = ((startMin - HOURS.start*60) / STEP_MIN) * rowH;
    const height = (span / STEP_MIN) * rowH;

    const el = document.createElement('div');
    el.className = 'event'; el.dataset.id = e.id;
    el.style.top = `${top}px`; el.style.height = `${Math.max(height,16)}px`;
    el.style.background = COLORS[e.calendar] || 'var(--accent)';
    if(new Date(e.end) < new Date()) el.style.opacity = .5; // 過去は薄く
    el.innerHTML = `
      <div>${e.title||'(無題)'}</div>
      <small>${e.calendar}</small>
      <div class="handle h-top"></div><div class="handle h-btm"></div>
    `;

    // move / resize
    el.addEventListener('pointerdown', (ev)=>{
      if(ev.target.classList.contains('handle')){
        startResize(ev, e.id, ev.target.classList.contains('h-top')?'top':'btm');
      }else{
        startMove(ev, e.id);
      }
    });
    el.addEventListener('dblclick', ()=>openEdit(e.id));
    col.appendChild(el);
  }

  // ====== 現在時刻ライン（今日だけ） ======
  let nowTimer=null;
  function drawNowLine(){
    const old=$('.nowline'); if(old) old.remove();
    const today = new Date();
    // 今日が表示週に入っていなければ表示しない
    const start = new Date(currentMonday);
    const end = new Date(currentMonday); end.setDate(end.getDate()+7);
    if(!(today>=start && today<end)) return;

    const todayIdx = ((today.getDay()+6)%7);
    const col = calendar.querySelector(`.day[data-day="${todayIdx}"]`); if(!col) return;

    const { rowH } = colGeom(col);
    const makeY = ()=> ((minutes(new Date()) - HOURS.start*60) / STEP_MIN) * rowH;

    const line = document.createElement('div'); line.className='nowline';
    line.style.top = `${makeY()}px`;
    calendar.appendChild(line);

    clearInterval(nowTimer);
    nowTimer = setInterval(()=>{ line.style.top = `${makeY()}px`; }, 60000);
  }

  function autoscrollToNow(){
    const today = new Date();
    const start = new Date(currentMonday);
    const end = new Date(currentMonday); end.setDate(end.getDate()+7);
    if(!(today>=start && today<end)) return;

    const idx = ((today.getDay()+6)%7);
    const col = calendar.querySelector(`.day[data-day="${idx}"]`); if(!col) return;
    const { rowH } = colGeom(col);
    const y = ((minutes(today)-HOURS.start*60)/STEP_MIN)*rowH;
    const center = y - calendarWrap.clientHeight*0.4;
    calendarWrap.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
  }

  // ====== 新規作成（列をドラッグ） ======
  function onPointerDownCol(ev,col){
    if(ev.button!==0) return;
    const { rect, rowH } = colGeom(col);
    col.setPointerCapture(ev.pointerId);

    const dayIdx = +col.dataset.day;
    let startY = ev.clientY - rect.top;
    let startMin = HOURS.start*60 + Math.floor(startY/rowH)*STEP_MIN;

    const draft = document.createElement('div'); draft.className='event';
    draft.style.background='rgba(96,165,250,.65)';
    draft.style.left='6px'; draft.style.right='6px';
    draft.style.top = `${((startMin - HOURS.start*60)/STEP_MIN)*rowH}px`;
    draft.style.height = `${rowH}px`;
    draft.innerHTML = '<div>（新規）</div>';
    draft.id='__draft';
    col.appendChild(draft);

    const onMove = (e)=>{
      let cur = HOURS.start*60 + Math.floor((e.clientY-rect.top)/rowH)*STEP_MIN;
      const a = Math.min(startMin, cur), b = Math.max(startMin, cur+STEP_MIN);
      draft.style.top = `${((a - HOURS.start*60)/STEP_MIN)*rowH}px`;
      draft.style.height = `${((b-a)/STEP_MIN)*rowH}px`;
    };
    const onUp = (e)=>{
      col.removeEventListener('pointermove', onMove);
      col.removeEventListener('pointerup', onUp);
      const top = parseFloat(draft.style.top), h = parseFloat(draft.style.height);
      draft.remove(); col.releasePointerCapture(ev.pointerId);

      const a = Math.round(top/rowH)*STEP_MIN + HOURS.start*60;
      const b = a + Math.max(STEP_MIN, Math.round(h/rowH)*STEP_MIN);
      openNew(dayIdx, a, b);
    };
    col.addEventListener('pointermove', onMove);
    col.addEventListener('pointerup', onUp);
  }

  // ====== 移動・リサイズ ======
  function startMove(ev, id){
    ev.preventDefault();
    const item = events.find(x=>x.id===id); if(!item) return;
    const s0 = new Date(item.start), e0 = new Date(item.end);
    const srcCol = ev.currentTarget.closest('.day');
    const { rect, rowH } = colGeom(srcCol);
    const baseMin = minutes(s0);
    const offset = ev.clientY - rect.top - ((baseMin - HOURS.start*60)/STEP_MIN)*rowH;

    const onMove = (pe)=>{
      const col = pe.target.closest('.day') || srcCol;
      const g = colGeom(col);
      const y = pe.clientY - g.rect.top - offset;
      const m = snap(HOURS.start*60 + Math.max(0, Math.round(y/g.rowH)*STEP_MIN));
      const dayIdx = +col.dataset.day;
      const dur = minutes(e0) - minutes(s0);

      const base = new Date(currentMonday); base.setDate(base.getDate()+dayIdx);
      const ns = dateAt(base, clamp(m, 0, 24*60-STEP_MIN));
      const ne = new Date(+ns + dur*60000);
      item.start = ns.toISOString(); item.end = ne.toISOString();
      render();
    };
    const onUp = ()=>{
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      save();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function startResize(ev, id, where){
    ev.preventDefault();
    const item = events.find(x=>x.id===id); if(!item) return;
    const s0 = new Date(item.start), e0 = new Date(item.end);
    const col = ev.currentTarget.closest('.day');
    const { rect, rowH } = colGeom(col);

    const onMove = (pe)=>{
      const y = pe.clientY - rect.top;
      const m = snap(HOURS.start*60 + Math.round(y/rowH)*STEP_MIN);
      const base = new Date(currentMonday); base.setDate(base.getDate()+(+col.dataset.day));
      if(where==='top'){
        const ns = dateAt(base, clamp(m, 0, minutes(e0)-STEP_MIN));
        item.start = ns.toISOString();
      }else{
        const ne = dateAt(base, clamp(m, minutes(s0)+STEP_MIN, 24*60));
        item.end = ne.toISOString();
      }
      render();
    };
    const onUp = ()=>{
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      save();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  // ====== ダイアログ：新規/編集 ======
  function fillTimes(sel){
    sel.innerHTML=''; for(let h=0;h<24;h++){ for(let m=0;m<60;m+=STEP_MIN){
      const v = `${pad2(h)}:${pad2(m)}`; const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o);
    }}
  }
  fillTimes(form.startTime); fillTimes(form.endTime);

  function openNew(dayIdx, aMin, bMin){
    form.reset(); $('#deleteBtn').style.display='none'; form.id.value='';
    const base = new Date(currentMonday); base.setDate(base.getDate()+dayIdx);
    const s = dateAt(base, aMin), t = dateAt(base, bMin);
    form.startDate.value=toKey(s); form.endDate.value=toKey(t);
    form.startTime.value=`${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    form.endTime.value=`${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
    form.calendar.value='Mochitecture'; dialog.showModal();
  }

  function openEdit(id){
    const e = events.find(x=>x.id===id); if(!e) return;
    $('#deleteBtn').style.display='';
    form.id.value=e.id; form.title.value=e.title||''; form.calendar.value=e.calendar;
    const s=new Date(e.start), t=new Date(e.end);
    form.startDate.value=toKey(s); form.endDate.value=toKey(t);
    form.startTime.value=`${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    form.endTime.value=`${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
    dialog.showModal();
  }

  function parseDT(dStr,tStr){
    const [y,m,d]=dStr.split('-').map(Number);
    const [hh,mm]=tStr.split(':').map(Number);
    return new Date(y,m-1,d,hh,mm,0);
  }

  form.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const id=form.id.value || `e_${Date.now()}`;
    const s=parseDT(form.startDate.value, form.startTime.value);
    const t=parseDT(form.endDate.value,   form.endTime.value);
    if(+t<=+s){ alert('終了は開始より後にしてください'); return; }
    const payload={
      id,
      title:(form.title.value||'(無題)').trim(),
      calendar:form.calendar.value,
      start:s.toISOString(),
      end:t.toISOString()
    };
    const i=events.findIndex(x=>x.id===id); if(i>=0) events[i]=payload; else events.push(payload);
    save(); dialog.close(); render();
  });

  delBtn.addEventListener('click', ()=>{
    const id=form.id.value; if(!id) return;
    if(confirm('この予定を削除しますか？')){
      events = events.filter(x=>x.id!==id);
      save(); dialog.close(); render();
    }
  });

  // ====== Nav / Snapshot / Clear ======
  $('#prevBtn').addEventListener('click', ()=>{
    currentMonday.setDate(currentMonday.getDate()-7);
    render();
  });
  $('#nextBtn').addEventListener('click', ()=>{
    currentMonday.setDate(currentMonday.getDate()+7);
    render();
  });
  $('#todayBtn').addEventListener('click', ()=>{
    currentMonday=startOfWeek(new Date());
    render();
  });

  $('#clearBtn').addEventListener('click', ()=>{
    if(confirm('このデモの予定を全削除します。よろしいですか？')){
      events=[]; save(); render();
    }
  });

  $('#snapBtn').addEventListener('click', async ()=>{
    const target = $('.calendar-wrap');
    const canvas = await html2canvas(target, {backgroundColor:null, scale:2});
    const a = document.createElement('a');
    a.download = `schedule_${toKey(new Date())}.png`;
    a.href=canvas.toDataURL('image/png');
    a.click();
  });

  // ====== 空き時間検索（最小連続“確保可能期間”で出力） ======
  $('#finderBtn').addEventListener('click', ()=>{
    calPick.innerHTML='';
    Object.keys(COLORS).forEach(name=>{
      const id = `p_${name}`;
      const w = document.createElement('label');
      w.innerHTML = `<input type="checkbox" id="${id}" value="${name}" checked>
                     <span style="display:inline-flex;align-items:center;gap:.35rem">
                     <span class="sw" style="width:12px;height:12px;background:${COLORS[name]};border-radius:3px"></span>${name}</span>`;
      calPick.appendChild(w);
    });
    resultsEl.innerHTML=''; finderDialog.showModal();
  });

  runFinderBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    const chosen = [...calPick.querySelectorAll('input:checked')].map(x=>x.value);
    const need = +$('#needMin').value;
    const [wStart,wEnd] = $('#window').value.split('-').map(Number);
    const blocks = findFreeBlocks(chosen, need, wStart, wEnd);
    renderBlocks(blocks, chosen, need);
  });

  function findFreeBlocks(cals, needMin, wStart, wEnd){
    const out=[];
    for(let d=0; d<7; d++){
      const dayDate = new Date(currentMonday); dayDate.setDate(currentMonday.getDate()+d);

      // busy (選択カレンダーのみ)
      const busy = events
        .filter(e=>cals.includes(e.calendar))
        .map(e=>({s:new Date(e.start), t:new Date(e.end)}))
        .filter(x=> isSameDay(x.s, dayDate) || isSameDay(x.t, dayDate) || (x.s<dayDate && x.t>dayDate));

      const dayStart = new Date(dayDate); dayStart.setHours(wStart,0,0,0);
      const dayEnd   = new Date(dayDate); dayEnd.setHours(wEnd,0,0,0);

      const normalized = busy.map(b=>{
        const s=new Date(Math.max(+b.s,+dayStart)), t=new Date(Math.min(+b.t,+dayEnd));
        return (t>s)?[minutes(s), minutes(t)]:null;
      }).filter(Boolean).sort((a,b)=>a[0]-b[0]);

      // マージ
      const merged=[];
      for(const cur of normalized){
        if(!merged.length || merged.at(-1)[1]<cur[0]) merged.push(cur);
        else merged.at(-1)[1]=Math.max(merged.at(-1)[1],cur[1]);
      }

      // 補集合＝free の「連続ブロック」
      let cursor=wStart*60;
      for(const [bs,be] of merged){
        if(bs-cursor>=needMin) out.push({day:d, startMin:cursor, endMin:bs});
        cursor=Math.max(cursor,be);
      }
      if(wEnd*60-cursor>=needMin) out.push({day:d, startMin:cursor, endMin:wEnd*60});
    }
    // そのまま“ブロック”として返す（開始～終了の連続範囲）
    return out;
  }

  function renderBlocks(blocks, chosen, needMin){
    resultsEl.innerHTML='';
    if(!blocks.length){
      resultsEl.innerHTML='<p class="hint">条件に合う連続ブロックがありません。</p>';
      return;
    }

    blocks.forEach(b=>{
      const d=new Date(currentMonday); d.setDate(d.getDate()+b.day);
      const lab =
        `${d.getMonth()+1}/${d.getDate()}（${['月','火','水','木','金','土','日'][b.day]}） `
        +`${pad2(Math.floor(b.startMin/60))}:${pad2(b.startMin%60)} 〜 ${pad2(Math.floor(b.endMin/60))}:${pad2(b.endMin%60)}`
        +`（最小${needMin}分確保可）`;

      const row=document.createElement('div'); row.className='result-item';
      row.innerHTML=`<span>${lab}</span>`;

      const copy=document.createElement('button'); copy.className='btn'; copy.textContent='コピー';
      copy.addEventListener('click', ()=>{
        navigator.clipboard.writeText(lab);
        copy.textContent='✓ コピー済'; setTimeout(()=>copy.textContent='コピー',1200);
      });

      const hold=document.createElement('button'); hold.className='btn btn-primary'; hold.textContent='ホールド作成';
      hold.addEventListener('click', ()=>{
        const cal=chosen[0]||'Mochitecture';
        const base=new Date(currentMonday); base.setDate(base.getDate()+b.day); base.setHours(0,0,0,0);
        const s=dateAt(base,b.startMin), t=dateAt(base,Math.min(b.startMin+needMin,b.endMin));
        events.push({
          id:`e_${Date.now()}`,
          title:'Hold',
          calendar:cal,
          start:s.toISOString(),
          end:t.toISOString()
        });
        save(); render();
      });

      row.appendChild(copy);
      row.appendChild(hold);
      resultsEl.appendChild(row);
    });
  }

  // ====== 初期データ（初回のみ） ======
  if(!events.length){
    const mon = startOfWeek(new Date());
    const mk=(dow,h1,m1,h2,m2,title,cal)=>({
      id:`seed_${title}_${dow}`, title, calendar:cal,
      start:new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+dow,h1,m1).toISOString(),
      end:new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+dow,h2,m2).toISOString()
    });
    events=[
      mk(0,9,0,11,0,'企画レビュー','Work'),
      mk(1,13,0,14,30,'Mochitecture: アーカイブ整備','Mochitecture'),
      mk(4,10,0,12,0,'調査: UIパターン','Research'),
      mk(4,13,0,15,0,'顧客打合せ','Work'),
      mk(6,9,30,10,30,'家族','Personal'),
    ];
    save();
  }

  // ====== 初期化 ======
  renderLegend();
  render();
})();
