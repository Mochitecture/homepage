(() => {
  // ====== カラー / ストレージ ======
  const css = getComputedStyle(document.documentElement);
  const colors = {
    Work: css.getPropertyValue('--event-a').trim(),
    Personal: css.getPropertyValue('--event-b').trim(),
    Mochitecture: css.getPropertyValue('--event-c').trim(),
    Research: css.getPropertyValue('--event-d').trim(),
  };
  const STORAGE_KEY = 'mochitecture.week.events.v1';

  let events = load();
  let currentMonday = startOfWeek(new Date());

  // ====== DOM ======
  const weekbar = document.getElementById('weekbar');
  const calendar = document.getElementById('calendar');
  const nowLine  = document.getElementById('nowLine');
  const dialog  = document.getElementById('eventDialog');
  const form    = document.getElementById('eventForm');

  // ====== Util ======
  function startOfWeek(d){
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay(); // 0 Sun
    const diff = (day===0 ? -6 : 1 - day); // Monday start
    x.setDate(x.getDate() + diff);
    x.setHours(0,0,0,0);
    return x;
  }
  function fmtDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function toLocalInput(d){
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); }

  // ====== ビルド ======
  function renderLegend(){
    const el = document.getElementById('legend'); el.innerHTML='';
    Object.entries(colors).forEach(([name,color])=>{
      const item = document.createElement('span'); item.className='item';
      item.innerHTML = `<span class="sw" style="background:${color}"></span>${name}`;
      el.appendChild(item);
    });
  }

  function render(){
    // Weekbar
    weekbar.innerHTML = `<div></div>`; // gutter
    for(let i=0;i<7;i++){
      const d = new Date(currentMonday); d.setDate(currentMonday.getDate()+i);
      const dow = ['月','火','水','木','金','土','日'][i];
      const isToday = fmtDate(d) === fmtDate(new Date());
      weekbar.insertAdjacentHTML('beforeend', `
        <div class="dow" aria-label="${d.toDateString()}">
          <span class="date" style="${isToday?'color:var(--accent)':''}">${d.getDate()}</span>${dow}
        </div>
      `);
    }

    // グリッド（24h固定）
    calendar.querySelectorAll(':scope > *:not(#nowLine)').forEach(n=>n.remove());

    // 時間ガター
    const times = document.createElement('div'); times.className='times';
    for(let h=0; h<24; h++){
      times.insertAdjacentHTML('beforeend', `<div class="timecell">${String(h).padStart(2,'0')}:00</div>`);
    }
    calendar.prepend(times);

    // 7日分のカラム
    const dayCols = [];
    for(let c=0;c<7;c++){
      const dayCol = document.createElement('div'); dayCol.className='day'; dayCol.dataset.col=c;
      for(let r=0;r<24;r++) dayCol.insertAdjacentHTML('beforeend', `<div class="slot" data-hour="${r}"></div>`);
      calendar.appendChild(dayCol); dayCols.push(dayCol);
    }

    // 予定を当週にフィルタ
    const weekStart = new Date(currentMonday);
    const weekEnd = new Date(currentMonday); weekEnd.setDate(weekEnd.getDate()+7); weekEnd.setHours(0,0,0,0);
    const visible = events.filter(e => new Date(e.end) > weekStart && new Date(e.start) < weekEnd);

    const now = Date.now();
    visible.forEach(e=>{
      const s = new Date(e.start), t = new Date(e.end);
      // 日を跨ぐイベントは日毎に分割
      let cur = new Date(s);
      while(cur < t){
        const dayIdx = (cur.getDay()===0?6:cur.getDay()-1);
        const dayStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0);
        const nextDay  = new Date(dayStart); nextDay.setDate(nextDay.getDate()+1);
        const segStart = new Date(Math.max(cur, dayStart));
        const segEnd   = new Date(Math.min(t, nextDay));
        placeSegment(e, dayIdx, segStart, segEnd, now);
        cur = nextDay;
      }
    });

    placeNowLine(); // 初回配置
  }

  function placeSegment(e, dayIdx, segStart, segEnd, nowMs){
    if(dayIdx<0 || dayIdx>6) return;
    const col = calendar.querySelectorAll('.day')[dayIdx]; if(!col) return;

    const colRect = col.getBoundingClientRect();
    const rowH = colRect.height / 24; // 24時間固定

    const startH = segStart.getHours() + segStart.getMinutes()/60;
    const endH   = segEnd.getHours()   + segEnd.getMinutes()/60;

    const top    = Math.max(0, startH * rowH);
    const height = Math.max(22, (endH - startH) * rowH);

    const div = document.createElement('div');
    div.className='event';
    div.style.top = `${top}px`;
    div.style.height = `${height}px`;
    div.style.background = colors[e.calendar] || 'var(--accent)';
    div.title = `${e.title}\n${new Date(e.start).toLocaleString()} - ${new Date(e.end).toLocaleString()}\n${e.calendar}`;
    div.innerHTML = `<div>${e.title}</div><small>${e.calendar}</small>`;
    if(Date.parse(e.end) < nowMs) div.classList.add('past'); // ★過去予定の減光
    div.addEventListener('click', ()=> openEdit(e));
    col.appendChild(div);
  }

  // ====== 現在時刻ライン ======
  function placeNowLine(){
    if(!nowLine) return;
    const H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 72;
    const now = new Date();
    const minutesFromStart = now.getHours() * 60 + now.getMinutes(); // 0..1440
    const y = (minutesFromStart / 60) * H;
    nowLine.style.top = `${y}px`;
    nowLine.style.display = (minutesFromStart >= 0 && minutesFromStart <= 1440) ? 'block' : 'none';
  }
  setInterval(placeNowLine, 30 * 1000); // 30秒ごとに位置更新

  // ====== Dialog ======
  function openNew(){
    const base = new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0);
    const end   = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 11, 0, 0);
    form.id.value = '';
    form.title.value = '';
    form.start.value = toLocalInput(start);
    form.end.value   = toLocalInput(end);
    form.calendar.value = 'Mochitecture';
    dialog.showModal();
  }
  function openEdit(e){
    form.id.value = e.id;
    form.title.value = e.title;
    form.calendar.value = e.calendar;
    form.start.value = toLocalInput(new Date(e.start));
    form.end.value   = toLocalInput(new Date(e.end));
    dialog.showModal();
  }

  form.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const id = form.id.value || `e_${Date.now()}`;
    const start = new Date(form.start.value);
    const end   = new Date(form.end.value);
    if(end <= start){ alert('終了は開始より後にしてください'); return; }
    const payload = {
      id, title: (form.title.value || '(無題)').trim(),
      start: start.toISOString(), end: end.toISOString(),
      calendar: form.calendar.value
    };
    const idx = events.findIndex(x=>x.id===id);
    if(idx>=0) events[idx]=payload; else events.push(payload);
    save(); dialog.close(); render();
  });

  // ====== Toolbar ======
  document.getElementById('newEventBtn').addEventListener('click', openNew);
  document.getElementById('clearBtn').addEventListener('click', ()=>{
    if(confirm('このデモで保存した予定を全て削除します。よろしいですか？')){
      events = []; save(); render();
    }
  });
  document.getElementById('prevBtn').addEventListener('click', ()=>{ currentMonday.setDate(currentMonday.getDate()-7); render(); });
  document.getElementById('nextBtn').addEventListener('click', ()=>{ currentMonday.setDate(currentMonday.getDate()+7); render(); });
  document.getElementById('todayBtn').addEventListener('click', ()=>{ currentMonday = startOfWeek(new Date()); render(); });

  // ====== 初回データ（初回のみ投入） ======
  if(!events.length){
    const now = new Date();
    const mon = startOfWeek(now);
    const mk = (dow,h1,m1,h2,m2,title,cal)=>({
      id:`seed_${title}_${dow}`, title, calendar:cal,
      start:new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+dow,h1,m1).toISOString(),
      end:new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+dow,h2,m2).toISOString()
    });
    events = [
      mk(0, 9,0, 11,0, '企画レビュー', 'Work'),
      mk(1, 13,0, 14,30, 'Mochitecture: アーカイブ整備', 'Mochitecture'),
      mk(2, 19,0, 20,30, 'ランニング', 'Personal'),
      mk(4, 10,0, 12,0, '調査: UIパターン', 'Research'),
      mk(4, 13,0, 15,0, '顧客打合せ', 'Work'),
      mk(6, 9,30, 10,30, '家族', 'Personal'),
    ];
    save();
  }

  // 起動
  renderLegend();
  render();
})();
