(() => {
  // ====== 設定 ======
  const STEP_MIN = 15;                 // 15分刻み
  const HOURS = { start: 0, end: 24 }; // 24h固定
  const STORAGE_KEY = 'mochi.schedule.v2';

  const COLORS = {
    Work: cssVar('--event-a'),
    Personal: cssVar('--event-b'),
    Mochitecture: cssVar('--event-c'),
    Research: cssVar('--event-d'),
  };

  // ====== 状態 ======
  let events = load();
  let currentMonday = startOfWeek(new Date());
  let dragState = null; // {type:'new'|'move'|'resize', id?, dayIdx?, startMin?, endMin?, offsetMin?}

  // ====== 要素 ======
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

  // ====== ツール ======
  function $(q){ return document.querySelector(q); }
  function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function pad2(n){ return String(n).padStart(2,'0'); }
  function toKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
  function startOfWeek(d){
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay(); const diff = (day===0 ? -6 : 1-day);
    x.setDate(x.getDate()+diff); x.setHours(0,0,0,0); return x;
  }
  function load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); }
  function minutes(d){ return d.getHours()*60 + d.getMinutes(); }
  function dateAt(dayBase, min){ const t=new Date(dayBase); t.setMinutes(min); return t; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function snap15(m){ return Math.round(m/STEP_MIN)*STEP_MIN; }
  function isSameDay(a,b){ return a.getFullYear()==b.getFullYear() && a.getMonth()==b.getMonth() && a.getDate()==b.getDate(); }

  // ====== レジェンド ======
  function renderLegend(){
    legendEl.innerHTML='';
    Object.entries(COLORS).forEach(([name,color])=>{
      const span = document.createElement('span'); span.className='item';
      span.innerHTML = `<span class="sw" style="background:${color}"></span>${name}`;
      legendEl.appendChild(span);
    });
  }

  // ====== 週ヘッダとグリッド ======
  function render(){
    // 週ヘッダ
    weekbar.innerHTML = `<div></div>`;
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

    // グリッド
    calendar.innerHTML='';
    // 時刻ガター
    const times = document.createElement('div'); times.className='times';
    const rows = (HOURS.end - HOURS.start) * (60/STEP_MIN); // 96
    for(let r=0;r<rows;r++){
      const totalMin = HOURS.start*60 + r*STEP_MIN;
      const lab = (totalMin%60===0) ? `${pad2(totalMin/60)}:00` : '';
      times.insertAdjacentHTML('beforeend', `<div class="timecell">${lab}</div>`);
    }
    calendar.appendChild(times);

    // 日カラム
    const columns = [];
    for(let i=0;i<7;i++){
      const col = document.createElement('div');
      col.className='day'; col.dataset.day=i;
      for(let r=0;r<rows;r++) col.insertAdjacentHTML('beforeend','<div class="slot"></div>');
      calendar.appendChild(col); columns.push(col);
    }

    // イベントを配置
    const weekStart = new Date(currentMonday);
    const weekEnd = new Date(currentMonday); weekEnd.setDate(weekEnd.getDate()+7);
    const visible = events.filter(e => new Date(e.end) > weekStart && new Date(e.start) < weekEnd);

    visible.forEach(e=>{
      const s = new Date(e.start), t = new Date(e.end);
      // 日ごとに分割配置
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

    // 現在時刻ライン
    drawNowLine();
    // 初回スクロール：現在時刻を中央付近に
    autoscrollToNow();

    // ポインタイベント登録（新規作成／ドラッグ移動・リサイズ）
    columns.forEach(col => {
      col.addEventListener('pointerdown', onPointerDownCol);
    });
  }

  function colGeometry(col){
    const rect = col.getBoundingClientRect();
    const top = rect.top + window.scrollY; // viewport -> page
    const perRow = col.querySelector('.slot').getBoundingClientRect().height;
    return {top, perRow, rect};
  }

  function place(e, dayIdx, startMin, endMin){
    const col = calendar.querySelector(`.day[data-day="${dayIdx}"]`);
    if(!col) return;
    const { perRow } = colGeometry(col);

    const spanMin = clamp(endMin - startMin, STEP_MIN, 24*60);
    const y = ((startMin - HOURS.start*60) / STEP_MIN) * perRow;
    const h = (spanMin / STEP_MIN) * perRow;

    const node = document.createElement('div');
    node.className='event';
    node.dataset.id = e.id;
    node.style.top = `${y}px`;
    node.style.height = `${Math.max(h, 16)}px`;
    node.style.background = COLORS[e.calendar] || 'var(--accent)';
    node.innerHTML = `
      <div>${e.title}</div>
      <small>${e.calendar}</small>
      <div class="handle h-top"></div>
      <div class="handle h-btm"></div>
    `;

    // 過去イベントは薄く
    if(new Date(e.end) < new Date()) node.style.opacity = .5;

    // ドラッグ移動
    node.addEventListener('pointerdown', ev=>{
      if(ev.target.classList.contains('handle')){
        const type = ev.target.classList.contains('h-top') ? 'resize-top' : 'resize-btm';
        startResize(ev, e.id, type);
      }else{
        startMove(ev, e.id);
      }
    });

    // クリックで編集
    node.addEventListener('dblclick', ()=> openEdit(e.id));

    col.appendChild(node);
  }

  // ====== 現在時刻ライン ======
  let nowTimer = null;
  function drawNowLine(){
    // remove old
    const old = $('.nowline'); if(old) old.remove();

    const todayIdx = ((new Date().getDay()+6)%7);
    const nowMin = minutes(new Date());
    const y = ((nowMin - HOURS.start*60) / STEP_MIN);

    const col = calendar.querySelector(`.day[data-day="${todayIdx}"]`);
    if(!col) return;
    const { perRow } = colGeometry(col);

    const line = document.createElement('div');
    line.className='nowline';
    line.style.top = `${y*perRow}px`;
    calendar.appendChild(line);

    // 1分ごとに更新
    clearInterval(nowTimer);
    nowTimer = setInterval(()=>{
      const nm = minutes(new Date());
      line.style.top = `${((nm - HOURS.start*60)/STEP_MIN)*perRow}px`;
    }, 60000);
  }

  function autoscrollToNow(){
    const now = new Date(); const todayIdx = ((now.getDay()+6)%7);
    const targetCol = calendar.querySelector(`.day[data-day="${todayIdx}"]`);
    if(!targetCol) return;
    const { perRow } = colGeometry(targetCol);
    const y = ((minutes(now)-HOURS.start*60)/STEP_MIN)*perRow;
    const center = y - calendarWrap.clientHeight*0.4;
    calendarWrap.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
  }

  // ====== 新規作成（ドラッグ） ======
  function onPointerDownCol(ev){
    if(ev.button!==0) return;
    const col = ev.currentTarget;
    const { perRow, rect } = colGeometry(col);

    col.setPointerCapture(ev.pointerId);
    const dayIdx = +col.dataset.day;
    let startY = ev.clientY - rect.top;
    let startMin = HOURS.start*60 + Math.floor(startY/perRow)*STEP_MIN;

    dragState = { type:'new', dayIdx, startMin, endMin:startMin+STEP_MIN };

    const draft = document.createElement('div'); draft.className='event';
    draft.style.background = 'rgba(96,165,250,.65)';
    draft.style.left='6px'; draft.style.right='6px';
    draft.style.top = `${((dragState.startMin - HOURS.start*60)/STEP_MIN)*perRow}px`;
    draft.style.height = `${perRow}px`;
    draft.innerHTML='<div>（新規）</div>';
    draft.id='__draft';
    col.appendChild(draft);

    const onMove = (e)=>{
      let curY = e.clientY - rect.top;
      let curMin = HOURS.start*60 + Math.floor(curY/perRow)*STEP_MIN;
      dragState.endMin = Math.max(curMin, dragState.startMin+STEP_MIN);
      const top = ((Math.min(dragState.startMin, dragState.endMin)-HOURS.start*60)/STEP_MIN)*perRow;
      const h = (Math.abs(dragState.endMin - dragState.startMin)/STEP_MIN)*perRow || perRow;
      draft.style.top = `${top}px`; draft.style.height = `${h}px`;
    };
    const onUp = ()=>{
      col.removeEventListener('pointermove', onMove);
      col.removeEventListener('pointerup', onUp);
      draft.remove();
      col.releasePointerCapture(ev.pointerId);

      // 保存ダイアログ
      openNew(dragState.dayIdx, Math.min(dragState.startMin, dragState.endMin), Math.max(dragState.startMin, dragState.endMin));
      dragState=null;
    };
    col.addEventListener('pointermove', onMove);
    col.addEventListener('pointerup', onUp);
  }

  // ====== 移動・リサイズ ======
  function startMove(ev, id){
    ev.preventDefault();
    const e = events.find(x=>x.id===id); if(!e) return;

    const start = new Date(e.start), end = new Date(e.end);
    const srcCol = ev.currentTarget.closest('.day');
    const { perRow, rect } = colGeometry(srcCol);
    const baseMin = minutes(start);
    const offsetY = ev.clientY - rect.top - ((baseMin - HOURS.start*60)/STEP_MIN)*perRow;
    const origDay = ((start.getDay()+6)%7);

    const onMove = (pe)=>{
      const col = pe.target.closest('.day') || srcCol;
      const geo = colGeometry(col);
      const y = pe.clientY - geo.rect.top - offsetY;
      const m = snap15(HOURS.start*60 + Math.max(0, Math.round(y/geo.perRow))*STEP_MIN);
      const dayIdx = +col.dataset.day;
      // 長さ維持
      const dur = minutes(end) - minutes(start);
      const sDate = new Date(currentMonday); sDate.setDate(currentMonday.getDate()+dayIdx);
      const ns = dateAt(sDate, clamp(m, 0, 24*60-STEP_MIN));
      const ne = new Date(+ns + dur*60000);
      e.start = ns.toISOString(); e.end = ne.toISOString();
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
    const e = events.find(x=>x.id===id); if(!e) return;
    const start = new Date(e.start), end = new Date(e.end);
    const col = ev.currentTarget.closest('.day');
    const { perRow, rect } = colGeometry(col);

    const onMove = (pe)=>{
      const y = pe.clientY - rect.top;
      const m = snap15(HOURS.start*60 + Math.round(y/perRow)*STEP_MIN);
      const dayBase = new Date(currentMonday); dayBase.setDate(currentMonday.getDate()+(+col.dataset.day));

      if(where==='resize-top'){
        const ns = dateAt(dayBase, clamp(m, 0, minutes(end)-STEP_MIN));
        e.start = ns.toISOString();
      }else{
        const ne = dateAt(dayBase, clamp(m, minutes(start)+STEP_MIN, 24*60));
        e.end = ne.toISOString();
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

  // ====== ダイアログ（新規／編集） ======
  function fillTimeSelects(sel){
    sel.innerHTML='';
    for(let h=0; h<24; h++){
      for(let m=0; m<60; m+=STEP_MIN){
        const v = `${pad2(h)}:${pad2(m)}`;
        const opt = document.createElement('option');
        opt.value = v; opt.textContent=v; sel.appendChild(opt);
      }
    }
  }
  // 初期化
  fillTimeSelects(form.startTime); fillTimeSelects(form.endTime);

  function openNew(dayIdx, startMin, endMin){
    form.reset(); $('#deleteBtn').style.display='none'; form.id.value='';
    const base = new Date(currentMonday); base.setDate(base.getDate()+dayIdx);

    const s = dateAt(base, startMin);
    const t = dateAt(base, endMin);

    form.startDate.value = toKey(s);
    form.endDate.value   = toKey(t);
    form.startTime.value = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    form.endTime.value   = `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
    form.calendar.value  = 'Mochitecture';

    dialog.showModal();
  }

  function openEdit(id){
    const e = events.find(x=>x.id===id); if(!e) return;
    $('#deleteBtn').style.display='';
    form.id.value = e.id;
    form.title.value = e.title;
    form.calendar.value = e.calendar;

    const s = new Date(e.start), t = new Date(e.end);
    form.startDate.value = toKey(s);
    form.endDate.value   = toKey(t);
    form.startTime.value = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    form.endTime.value   = `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;

    dialog.showModal();
  }

  function parseDateTime(dStr, tStr){
    const [y,m,d] = dStr.split('-').map(Number);
    const [hh,mm] = tStr.split(':').map(Number);
    return new Date(y, m-1, d, hh, mm, 0);
  }

  form.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const id = form.id.value || `e_${Date.now()}`;
    const start = parseDateTime(form.startDate.value, form.startTime.value);
    const end   = parseDateTime(form.endDate.value, form.endTime.value);
    if(+end <= +start){ alert('終了は開始より後にしてください'); return; }

    const payload = {
      id,
      title: (form.title.value||'（無題）').trim(),
      calendar: form.calendar.value,
      start: start.toISOString(),
      end: end.toISOString()
    };
    const idx = events.findIndex(x=>x.id===id);
    if(idx>=0) events[idx]=payload; else events.push(payload);
    save(); dialog.close(); render();
  });

  delBtn.addEventListener('click', ()=>{
    const id = form.id.value;
    if(!id) return;
    if(confirm('この予定を削除しますか？')){
      events = events.filter(x=>x.id!==id); save(); dialog.close(); render();
    }
  });

  // ====== ナビゲーション・スナップショット・クリア ======
  $('#prevBtn').addEventListener('click', ()=>{ currentMonday.setDate(currentMonday.getDate()-7); render(); });
  $('#nextBtn').addEventListener('click', ()=>{ currentMonday.setDate(currentMonday.getDate()+7); render(); });
  $('#todayBtn').addEventListener('click', ()=>{ currentMonday = startOfWeek(new Date()); render(); autoscrollToNow(); });

  $('#clearBtn').addEventListener('click', ()=>{
    if(confirm('このデモの予定を全削除します。よろしいですか？')){
      events = []; save(); render();
    }
  });

  $('#snapBtn').addEventListener('click', async ()=>{
    const target = $('.calendar-wrap');
    const canvas = await html2canvas(target, {backgroundColor:null, scale:2});
    const a = document.createElement('a');
    a.download = `schedule_${toKey(new Date())}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  // ====== 空き時間ファインダ ======
  $('#finderBtn').addEventListener('click', ()=>{
    // カレンダー選択
    calPick.innerHTML='';
    Object.keys(COLORS).forEach(name=>{
      const id = `p_${name}`;
      const w = document.createElement('label');
      w.innerHTML = `<input type="checkbox" id="${id}" value="${name}" checked>
                     <span style="display:inline-flex;align-items:center;gap:.35rem">
                       <span class="sw" style="width:12px;height:12px;background:${COLORS[name]};border-radius:3px"></span>${name}
                     </span>`;
      calPick.appendChild(w);
    });
    resultsEl.innerHTML='';
    finderDialog.showModal();
  });

  runFinderBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    const chosen = [...calPick.querySelectorAll('input:checked')].map(x=>x.value);
    const need = +$('#needMin').value;
    const [wStart,wEnd] = $('#window').value.split('-').map(Number);

    const suggestions = findFreeSlots(chosen, need, wStart, wEnd);
    renderSuggestions(suggestions, chosen, need);
  });

  function findFreeSlots(cals, needMin, wStart, wEnd){
    // 今週 7日分について、選択カレンダーの busy を合成→ free を抽出
    const slots = [];
    for(let d=0; d<7; d++){
      const dayDate = new Date(currentMonday); dayDate.setDate(currentMonday.getDate()+d);
      const dayKey = toKey(dayDate);

      // busy intervals（選択カレンダーのみ）
      const busy = events
        .filter(e=> cals.includes(e.calendar))
        .map(e=>({ start:new Date(e.start), end:new Date(e.end) }))
        .filter(x=> isSameDay(x.start, dayDate) || isSameDay(x.end, dayDate) || (x.start<dayDate && x.end>dayDate));

      // その日の範囲に切り出し
      const dayStart = new Date(dayDate); dayStart.setHours(wStart,0,0,0);
      const dayEnd   = new Date(dayDate); dayEnd.setHours(wEnd,0,0,0);

      const normalized = busy.map(b=>{
        const s = new Date(Math.max(+b.start, +dayStart));
        const t = new Date(Math.min(+b.end,   +dayEnd));
        return (t>s) ? [minutes(s), minutes(t)] : null;
      }).filter(Boolean);

      // マージ
      normalized.sort((a,b)=>a[0]-b[0]);
      const merged=[];
      for(const cur of normalized){
        if(!merged.length || merged.at(-1)[1] < cur[0]) merged.push(cur);
        else merged.at(-1)[1] = Math.max(merged.at(-1)[1], cur[1]);
      }

      // free = complement
      let cursor = wStart*60;
      for(const [bs,be] of merged){
        if(bs - cursor >= needMin) slots.push({ day:d, startMin:cursor, endMin:bs });
        cursor = Math.max(cursor, be);
      }
      if(wEnd*60 - cursor >= needMin) slots.push({ day:d, startMin:cursor, endMin:wEnd*60 });
    }

    // 15分刻みに丸めて返す（先頭10件）
    const packed = [];
    for(const s of slots){
      let cur = snap15(s.startMin);
      while(cur + needMin <= s.endMin){
        packed.push({ day:s.day, startMin:cur, endMin:cur+needMin });
        cur += STEP_MIN;
      }
    }
    return packed.slice(0, 10);
  }

  function renderSuggestions(list, cals, needMin){
    resultsEl.innerHTML='';
    if(!list.length){ resultsEl.innerHTML='<p class="meta">候補なし</p>'; return; }

    list.forEach(item=>{
      const d = new Date(currentMonday); d.setDate(d.getDate()+item.day);
      const lab = `${d.getMonth()+1}/${d.getDate()} (${['月','火','水','木','金','土','日'][item.day]})  `+
                  `${pad2(Math.floor(item.startMin/60))}:${pad2(item.startMin%60)} – ${pad2(Math.floor(item.endMin/60))}:${pad2(item.endMin%60)}`;
      const row = document.createElement('div'); row.className='result-item';
      row.innerHTML = `<span>${lab}</span><span class="meta">${needMin}分</span>`;
      const addBtn = document.createElement('button'); addBtn.textContent='ホールド作成';
      addBtn.addEventListener('click', ()=>{
        // 先頭の選択カレンダーに仮置き
        const cal = cals[0] || 'Mochitecture';
        const s = new Date(currentMonday); s.setDate(s.getDate()+item.day); s.setHours(0,0,0,0);
        const start = dateAt(s, item.startMin);
        const end   = dateAt(s, item.endMin);
        events.push({ id:`e_${Date.now()}`, title:'Hold', calendar:cal, start:start.toISOString(), end:end.toISOString() });
        save(); render();
      });
      row.appendChild(addBtn);
      resultsEl.appendChild(row);
    });
  }

  // ====== 初期データ（初回のみ） ======
  if(!events.length){
    const mon = startOfWeek(new Date());
    const mk = (dow,h1,m1,h2,m2,title,cal)=>({
      id:`seed_${title}_${dow}`,
      title, calendar:cal,
      start:new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+dow,h1,m1).toISOString(),
      end:new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+dow,h2,m2).toISOString()
    });
    events = [
      mk(0, 9,0, 11,0, '企画レビュー', 'Work'),
      mk(1, 13,0, 14,30, 'Mochitecture: アーカイブ整備', 'Mochitecture'),
      mk(4, 10,0, 12,0, '調査: UIパターン', 'Research'),
      mk(4, 13,0, 15,0, '顧客打合せ', 'Work'),
      mk(6, 9,30, 10,30, '家族', 'Personal'),
    ];
    save();
  }

  // ====== 起動 ======
  renderLegend();
  render();

  // ====== おまけ：ユーティリティ ======
  function toKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
})();
