import React, { useState, useEffect } from 'react';
import { storage } from './storage';
import { requestNotificationPermission, scheduleMorningBriefing, scheduleTaskReminder, scheduleLoanerReminder } from './notifications';
import styles from './App.module.css';

const KEYS = { tasks: 'tasks', bookings: 'bookings', history: 'history', settings: 'settings', fleet: 'fleet', custNotes: 'custNotes' };
const DEFAULT_FLEET = [
  { id: 1, name: 'קורולה קרוס', plate: '112-23-344' },
  { id: 2, name: 'קורולה קרוס', plate: '445-56-677' },
  { id: 3, name: 'יאריס', plate: '778-89-900' }
];
const SAMPLE_TASKS = [
  { id: 1, name: 'דוד אברהם', plate: '234-56-789', phone: '054-1234567', status: 'manager', priority: 'high', note: 'מחכה לאישור תיקון מנוע — 3,200₪', remind: '', done: false, created: Date.now() - 3600000 },
  { id: 2, name: 'רחל כהן', plate: '987-65-432', phone: '052-9876543', status: 'me', priority: 'high', note: 'להחזיר עם הצעת מחיר לתיבת הילוכים', remind: '', done: false, created: Date.now() - 7200000 },
  { id: 3, name: 'משה לוי', plate: '111-22-333', phone: '050-1112222', status: 'parts', priority: 'med', note: 'ממתין לחלק — מסנן שמן UX250h', remind: '', done: false, created: Date.now() - 10800000 }
];

function load(key, fallback) {
  const r = storage.get(key);
  if (r) { try { return JSON.parse(r.value); } catch { return fallback; } }
  return fallback;
}
function save(key, val) { storage.set(key, JSON.stringify(val)); }

function fmtTime(iso) { return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); }

function fmtDT(iso) { return new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function isPast(iso) { return new Date(iso) < new Date(); }
function isToday(iso) { return new Date(iso).toDateString() === new Date().toDateString(); }
function isTomorrow(iso) { const t = new Date(); t.setDate(t.getDate() + 1); return new Date(iso).toDateString() === t.toDateString(); }
function dayKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dayLabel(k) {
  const d = new Date(k + 'T12:00:00'), n = new Date(), t = new Date(); t.setDate(t.getDate() + 1);
  const iT = d.toDateString() === n.toDateString(), iTo = d.toDateString() === t.toDateString();
  const lbl = d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  return { label: iT ? 'היום — ' + lbl : iTo ? 'מחר — ' + lbl : lbl, isToday: iT };
}
function sLabel(s) { return { me: 'ממתין לי', manager: 'ממתין למנהל', parts: 'ממתין למחסן' }[s] || s; }

export default function App() {
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState(() => load(KEYS.tasks, SAMPLE_TASKS));
  const [bookings, setBookings] = useState(() => { const d = new Date(); const b = (o, h, m) => { const x = new Date(d); x.setDate(x.getDate() + o); x.setHours(h, m, 0, 0); return x.toISOString(); }; return load(KEYS.bookings, [{ id: 1, carId: 1, customer: 'דוד אברהם', phone: '054-1234567', plate: '234-56-789', pickup: b(0, 9, 0), returnEst: b(2, 17, 0), kmOut: '45200', note: '', status: 'active' }, { id: 2, carId: 3, customer: 'משה לוי', phone: '050-1112222', plate: '111-22-333', pickup: b(0, 14, 0), returnEst: b(1, 9, 0), kmOut: '31000', note: 'בדוק דלק', status: 'active' }, { id: 3, carId: 2, customer: 'שירה גולן', phone: '053-4455667', plate: '555-44-333', pickup: b(2, 10, 30), returnEst: b(4, 10, 0), kmOut: '', note: '', status: 'pending' }]); });
  const [history, setHistory] = useState(() => load(KEYS.history, []));
  const [settings, setSettings] = useState(() => load(KEYS.settings, { morningHour: 8 }));
  const [fleet, setFleet] = useState(() => load(KEYS.fleet, DEFAULT_FLEET));
  const [custNotes, setCustNotes] = useState(() => load(KEYS.custNotes, []));

  const [taskFilter, setTaskFilter] = useState('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [histSearch, setHistSearch] = useState('');
  const [carView, setCarView] = useState('tl');
  const [clock, setClock] = useState(new Date());
  const [notifPerm, setNotifPerm] = useState(false);

  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState({});

  useEffect(() => { save(KEYS.tasks, tasks); }, [tasks]);
  useEffect(() => { save(KEYS.bookings, bookings); }, [bookings]);
  useEffect(() => { save(KEYS.history, history); }, [history]);
  useEffect(() => { save(KEYS.settings, settings); }, [settings]);
  useEffect(() => { save(KEYS.fleet, fleet); }, [fleet]);
  useEffect(() => { save(KEYS.custNotes, custNotes); }, [custNotes]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (Notification.permission === 'granted') setNotifPerm(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        const openTasks = tasks.filter(t => !t.done);
        const activeCars = bookings.filter(b => b.status === 'active').length;
        scheduleMorningBriefing(settings.morningHour || 8, openTasks.length, activeCars);
      });
    }
  }, []);

  const handleRequestNotif = async () => {
    const ok = await requestNotificationPermission();
    setNotifPerm(ok);
    if (ok) {
      navigator.serviceWorker.ready.then(() => {
        tasks.filter(t => t.remind && !isPast(t.remind)).forEach(t => scheduleTaskReminder(t));
        bookings.filter(b => b.status !== 'returned').forEach(b => {
          const car = fleet.find(c => c.id === b.carId);
          if (car) scheduleLoanerReminder(b, car.name, car.plate);
        });
        scheduleMorningBriefing(settings.morningHour || 8, tasks.filter(t => !t.done).length, bookings.filter(b => b.status === 'active').length);
      });
    }
  };

  const openTasks = tasks.filter(t => !t.done);
  const urgentCount = openTasks.filter(t => t.status === 'me').length;
  const busyCars = bookings.filter(b => b.status === 'active').length;
  const todayRem = openTasks.filter(t => t.remind && isToday(t.remind)).length;

  const getCustNote = name => custNotes.find(c => c.name.trim() === name.trim());
  const carName = id => fleet.find(c => c.id === id)?.name || '';
  const carPlate = id => fleet.find(c => c.id === id)?.plate || '';

  function saveTask(data) {
    if (data.id) {
      setTasks(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t));
    } else {
      const t = { id: Date.now(), created: Date.now(), done: false, ...data };
      setTasks(prev => [t, ...prev]);
      if (t.remind && notifPerm) scheduleTaskReminder(t);
    }
  }

  function doneTask(id, closingNote) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    setHistory(prev => [{ id: Date.now(), name: t.name, plate: t.plate, note: t.note, closingNote, status: t.status, completedAt: new Date().toLocaleString('he-IL') }, ...prev]);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function snooze(id, hours) {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const base = t.remind ? new Date(t.remind) : new Date();
      base.setHours(base.getHours() + hours);
      const updated = { ...t, remind: base.toISOString().slice(0, 16) };
      if (notifPerm) scheduleTaskReminder(updated);
      return updated;
    }));
  }

  function saveBooking(data) {
    if (data.id) {
      setBookings(prev => prev.map(b => b.id === data.id ? { ...b, ...data } : b));
    } else {
      const b = { id: Date.now(), status: new Date(data.pickup) <= new Date() ? 'active' : 'pending', ...data };
      setBookings(prev => [...prev, b]);
      if (notifPerm) { const car = fleet.find(c => c.id === b.carId); if (car) scheduleLoanerReminder(b, car.name, car.plate); }
    }
  }

  function returnCar(id, kmIn, condition, note) {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'returned', kmIn, returnCond: condition, returnNote: note, actualReturn: new Date().toISOString() } : b));
  }

  function checkConflict(carId, pickup, ret, exId) {
    const p = new Date(pickup), r = new Date(ret);
    return bookings.filter(b => b.id !== exId && b.carId === carId && b.status !== 'returned').some(b => p < new Date(b.returnEst) && r > new Date(b.pickup));
  }

  function buildExport() {
    const d = new Date();
    const open = tasks.filter(t => !t.done);
    const urgent = open.filter(t => t.status === 'me');
    const waiting = open.filter(t => t.status !== 'me');
    const todayBk = bookings.filter(b => b.status !== 'returned' && isToday(b.pickup));
    const tomBk = bookings.filter(b => b.status !== 'returned' && isTomorrow(b.returnEst));
    let txt = `סיכום יומי — ${d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (urgent.length) { txt += `🔴 דחוף — ממתין לי (${urgent.length}):\n`; urgent.forEach(t => { txt += `• ${t.name}${t.plate ? ' (' + t.plate + ')' : ''} — ${t.note || ''}\n`; }); }
    if (waiting.length) { txt += `\n⏳ ממתין לאחרים (${waiting.length}):\n`; waiting.forEach(t => { txt += `• ${t.name} — ${t.note || ''} [${sLabel(t.status)}]\n`; }); }
    if (todayBk.length) { txt += `\n🚗 חליפיים יוצאים היום:\n`; todayBk.forEach(b => { txt += `• ${b.customer} | ${carName(b.carId)} ${carPlate(b.carId)} | ${fmtTime(b.pickup)}\n`; }); }
    if (tomBk.length) { txt += `\n🔔 חליפיים חוזרים מחר:\n`; tomBk.forEach(b => { txt += `• ${b.customer} | ${carPlate(b.carId)}\n`; }); }
    if (!urgent.length && !waiting.length) txt += `✅ אין משימות פתוחות\n`;
    return txt;
  }

  async function genAI() {
    const sit = modalData.aiSit?.trim(), ans = modalData.aiAns?.trim();
    if (!sit || !ans) return;
    const types = { rejection: 'דחיית בקשת אחריות', delay: 'עיכוב בחלק/תיקון', price: 'הצגת מחיר גבוה', ready: 'רכב מוכן לאיסוף', followup: 'מעקב/חזרה ללקוח', other: 'כללי' };
    setModalData(p => ({ ...p, aiLoading: true, aiResult: '' }));
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: `אתה יועץ שירות בכיר בסוכנות לקסוס בישראל. נסח תשובות ללקוחות בעברית: מקצועי, ברור, אמפתי. ללא התנצלות מיותרת. הסבר הסיבה, הצע חלופה אם יש. רק הניסוח עצמו, ללא הקדמות. סוג: ${types[modalData.aiType || 'rejection']}.`, messages: [{ role: 'user', content: `סיטואציה: ${sit}\n\nמידע/תשובה: ${ans}\n\nנסח מה לומר ללקוח.` }] })
      });
      const data = await res.json();
      setModalData(p => ({ ...p, aiLoading: false, aiResult: data.content?.[0]?.text || 'שגיאה' }));
    } catch { setModalData(p => ({ ...p, aiLoading: false, aiResult: 'שגיאה בחיבור לשרת' })); }
  }

  const now = clock;
  const odTasks = openTasks.filter(t => t.remind && isPast(t.remind));
  const odRet = bookings.filter(b => b.status === 'active' && isPast(b.returnEst));
  const tomRet = bookings.filter(b => b.status === 'active' && isTomorrow(b.returnEst));

  const filteredTasks = openTasks
    .filter(t => taskFilter === 'all' || t.status === taskFilter)
    .filter(t => !taskSearch || (t.name + t.plate + t.phone + t.note).toLowerCase().includes(taskSearch.toLowerCase()))
    .sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.priority] || 1) - ({ high: 0, med: 1, low: 2 }[b.priority] || 1));

  const activeBookings = bookings.filter(b => b.status !== 'returned');
  const tlEvents = [];
  activeBookings.forEach(b => {
    const od = new Date(b.returnEst) < new Date() && b.status === 'active';
    tlEvents.push({ type: 'pickup', date: b.pickup, b });
    tlEvents.push({ type: od ? 'overdue' : 'return', date: b.returnEst, b });
  });
  tlEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
  const byDay = {};
  tlEvents.forEach(e => { const k = dayKey(e.date); if (!byDay[k]) byDay[k] = []; byDay[k].push(e); });

  const filteredHist = history.filter(h => !histSearch || (h.name + h.plate + h.note + h.closingNote).toLowerCase().includes(histSearch.toLowerCase())).slice(0, 50);

  const s = styles;

  return (
    <div className={s.app}>
      {/* TOPBAR */}
      <div className={s.topbar}>
        <div className={s.topbarLeft}>
          <span className={s.topbarIcon}>🚗</span>
          <div>
            <div className={s.topbarTitle}>מזכיר שירות לקסוס</div>
            <div className={s.topbarDate}>{now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
        </div>
        <div className={s.topbarRight}>
          <button className={s.iconBtn} onClick={() => { setModalData({ exportText: buildExport() }); setModal('export'); }} title="ייצוא">📤</button>
          <button className={s.iconBtn} onClick={() => setTab('settings')} title="הגדרות">⚙️</button>
          <span className={s.clock}>{now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* BANNERS */}
      <div className={s.banners}>
        {!notifPerm && (
          <div className={s.bannerInfo} onClick={handleRequestNotif} style={{ cursor: 'pointer' }}>
            <span className={s.bannerT}>🔔 אפשר התראות לקבל תזכורות גם כשהמסך נעול</span>
            <span style={{ fontSize: 11 }}>לחץ לאישור</span>
          </div>
        )}
        {odTasks.length > 0 && <div className={s.bannerDanger}><div className={s.bannerT}>⚠️ {odTasks.length} תזכורות פג תוקף</div>{odTasks.map(t => t.name).join(' · ')}</div>}
        {odRet.length > 0 && <div className={s.bannerDanger}><div className={s.bannerT}>🚗 חליפי באיחור בהחזרה</div>{odRet.map(b => `${b.customer} (${carPlate(b.carId)})`).join(' · ')}</div>}
        {tomRet.length > 0 && <div className={s.bannerWarn}><div className={s.bannerT}>🔔 חליפי חוזר מחר — {tomRet.map(b => carPlate(b.carId)).join(', ')}</div>וודא שהרכב פנוי לפני שמגיע הלקוח</div>}
      </div>

      {/* SUMMARY */}
      <div className={s.summary}>
        <div className={s.sumTitle}>☀️ סיכום יום — {now.toLocaleDateString('he-IL', { weekday: 'long' })}</div>
        <div className={s.statsGrid}>
          <div className={`${s.stat} ${s.statRed}`}><div className={s.statN}>{urgentCount}</div><div className={s.statL}>דחוף — ממתין לי</div></div>
          <div className={s.stat}><div className={s.statN}>{openTasks.length}</div><div className={s.statL}>משימות פתוחות</div></div>
          <div className={s.stat}><div className={s.statN}>{busyCars}</div><div className={s.statL}>חליפי תפוס</div></div>
          <div className={s.stat}><div className={s.statN}>{todayRem}</div><div className={s.statL}>תזכורות היום</div></div>
        </div>
      </div>

      {/* TABS */}
      <div className={s.tabs}>
        {[['tasks', '✅', 'משימות'], ['cars', '🚗', 'חליפי'], ['ai', '💬', 'ניסוח'], ['hist', '🕐', 'היסטוריה'], ['settings', '⚙️', 'הגדרות']].map(([id, icon, label]) => (
          <button key={id} className={`${s.tab} ${tab === id ? s.tabActive : ''}`} onClick={() => setTab(id)}>
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>

      {/* TASKS TAB */}
      {tab === 'tasks' && (
        <div className={s.sec}>
          <div className={s.searchWrap}>
            <input className={s.searchInput} placeholder="חיפוש לקוח / רכב..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)} />
          </div>
          <button className={s.addBtn} onClick={() => { setModalData({ priority: 'high', status: 'me' }); setModal('task'); }}>+ משימה חדשה</button>
          <div className={s.chips}>
            {[['all', 'הכל'], ['me', 'ממתין לי'], ['manager', 'מנהל'], ['parts', 'מחסן']].map(([v, l]) => (
              <button key={v} className={`${s.chip} ${taskFilter === v ? s.chipOn : ''}`} onClick={() => setTaskFilter(v)}>{l}</button>
            ))}
          </div>
          {filteredTasks.length === 0 ? <div className={s.empty}>😊<br />אין משימות פתוחות</div> : filteredTasks.map(t => {
            const od = t.remind && isPast(t.remind);
            const cn = getCustNote(t.name);
            const priClass = t.priority === 'high' ? s.cardHigh : t.priority === 'low' ? s.cardLow : s.cardMed;
            return (
              <div key={t.id} className={`${s.card} ${priClass}`}>
                <div className={s.cardRow}>
                  <div>
                    <div className={s.cardName}>{t.name}</div>
                    <div className={s.cardMeta}>
                      {t.plate && <span>🚗 {t.plate}</span>}
                      {t.phone && <span>📞 {t.phone}</span>}
                    </div>
                  </div>
                  <span className={`${s.badge} ${s['badge_' + t.status]}`}>{sLabel(t.status)}</span>
                </div>
                {cn && <div className={s.custNote}>⚠️ {cn.note}</div>}
                {t.note && <div className={s.cardNote}>{t.note}</div>}
                {t.remind && <div className={`${s.remTag} ${od ? s.remTagOd : ''}`}>🔔 {fmtDT(t.remind)}{od ? ' — עבר' : ''}</div>}
                <div className={s.acts}>
                  {t.phone && <button className={`${s.tb} ${s.tbBlue}`} onClick={() => window.open(`tel:${t.phone}`)}>📞 חייג</button>}
                  <button className={`${s.tb} ${s.tbGreen}`} onClick={() => { setModalData({ doneId: t.id, doneNote: '' }); setModal('done'); }}>✓ סיים</button>
                  <button className={s.tb} onClick={() => { setModalData({ ...t, isEdit: true, priority: t.priority || 'high' }); setModal('task'); }}>✏️</button>
                  <button className={`${s.tb} ${s.tbOrange}`} onClick={() => { const def = new Date(); def.setHours(def.getHours() + 1, 0, 0, 0); setModalData({ remindTaskId: t.id, remindTaskName: t.name, remindTaskNote: t.note, remindTime: def.toISOString().slice(0, 16) }); setModal('remind'); }} title="הגדר תזכורת">🔔</button>
                  <button className={`${s.tb} ${s.tbRed}`} onClick={() => { if (window.confirm('למחוק?')) setTasks(prev => prev.filter(x => x.id !== t.id)); }}>🗑️</button>
                </div>
                {t.remind && (
                  <div className={s.snooze}>
                    {[[1, "+1ש'"], [2, "+2ש'"], [24, '+יום']].map(([h, l]) => (
                      <button key={h} className={s.snzBtn} onClick={() => snooze(t.id, h)}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CARS TAB */}
      {tab === 'cars' && (
        <div className={s.sec}>
          <div className={s.viewToggle}>
            <button className={`${s.vtBtn} ${carView === 'tl' ? s.vtBtnOn : ''}`} onClick={() => setCarView('tl')}>📅 לוח זמנים</button>
            <button className={`${s.vtBtn} ${carView === 'fl' ? s.vtBtnOn : ''}`} onClick={() => setCarView('fl')}>📋 צי רכבים</button>
          </div>
          <button className={s.addBtn} onClick={() => { setModalData({}); setModal('booking'); }}>+ הזמנת חליפי חדשה</button>

          {carView === 'tl' && (
            Object.keys(byDay).length === 0
              ? <div className={s.empty}>📅<br />אין הזמנות פעילות</div>
              : Object.keys(byDay).sort().map(k => {
                const { label, isToday: iT } = dayLabel(k);
                return (
                  <div key={k} className={s.tlDay}>
                    <div className={`${s.tlDayLabel} ${iT ? s.tlDayLabelToday : ''}`}>{label}</div>
                    {byDay[k].map((e, i) => {
                      const b = e.b;
                      const typeLabel = e.type === 'pickup' ? 'איסוף' : e.type === 'overdue' ? 'חזרה — באיחור!' : 'החזרה משוערת';
                      const dotClass = e.type === 'pickup' ? s.dotPickup : e.type === 'overdue' ? s.dotOverdue : s.dotReturn;
                      const cardClass = e.type === 'pickup' ? s.tlcPickup : e.type === 'overdue' ? s.tlcOverdue : s.tlcReturn;
                      const typeClass = e.type === 'pickup' ? s.tlTypePickup : e.type === 'overdue' ? s.tlTypeOverdue : s.tlTypeReturn;
                      return (
                        <div key={i} className={s.tlItem}>
                          <div className={s.tlTime}>{fmtTime(e.date)}</div>
                          <div className={s.tlLine}><div className={`${s.tlDot} ${dotClass}`} /><div className={s.tlBar} /></div>
                          <div className={`${s.tlCard} ${cardClass}`}>
                            <div className={`${s.tlType} ${typeClass}`}>{typeLabel}</div>
                            <div className={s.tlName}>{b.customer}</div>
                            <div className={s.tlSub}>{carName(b.carId)} · {carPlate(b.carId)}{b.plate ? ` | רכב: ${b.plate}` : ''}</div>
                            {b.note && <div className={s.tlSub}>📝 {b.note}</div>}
                            <div className={s.acts} style={{ marginTop: 6 }}>
                              {e.type === 'pickup' ? <>
                                <button className={`${s.tb} ${s.tbBlue}`} onClick={() => { setModalData({ ...b, isEdit: true }); setModal('booking'); }}>✏️ ערוך</button>
                                {b.phone && <button className={s.tb} onClick={() => window.open(`tel:${b.phone}`)}>📞</button>}
                                <button className={`${s.tb} ${s.tbRed}`} onClick={() => setBookings(prev => prev.filter(x => x.id !== b.id))}>🗑️</button>
                              </> : (
                                <button className={`${s.tb} ${s.tbGreen}`} onClick={() => { setModalData({ retId: b.id }); setModal('return'); }}>✓ קיבלתי בחזרה</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
          )}

          {carView === 'fl' && fleet.map(car => {
            const cb = activeBookings.filter(b => b.carId === car.id).sort((a, b) => new Date(a.pickup) - new Date(b.pickup));
            const cur = cb.find(b => b.status === 'active');
            const badgeTxt = !cur && !cb.length ? 'פנוי' : cur ? (isPast(cur.returnEst) ? 'באיחור' : 'תפוס') : 'פנוי כעת';
            const badgeClass = badgeTxt === 'פנוי' || badgeTxt === 'פנוי כעת' ? s.avFree : badgeTxt === 'באיחור' ? s.avWarn : s.avBusy;
            return (
              <div key={car.id} className={s.fleetCard}>
                <div className={s.fleetHdr}>
                  <div><div className={s.fleetName}>{car.name}</div><div className={s.fleetPlate}>{car.plate}</div></div>
                  <span className={`${s.avBadge} ${badgeClass}`}>{badgeTxt}</span>
                </div>
                {cb.length > 0 && (
                  <div className={s.fleetBk}>
                    {cb.map(b => (
                      <div key={b.id} className={s.bkRow}>
                        <div><div className={s.bkName}>{b.customer}</div><div className={s.bkDates}>{fmtDT(b.pickup)} ← {fmtDT(b.returnEst)}</div></div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {b.status === 'active' && <button className={`${s.tb} ${s.tbGreen}`} style={{ padding: '3px 6px' }} onClick={() => { setModalData({ retId: b.id }); setModal('return'); }}>החזיר</button>}
                          <button className={s.tb} style={{ padding: '3px 6px' }} onClick={() => { setModalData({ ...b, isEdit: true }); setModal('booking'); }}>✏️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button className={s.addBtn} style={{ marginBottom: 0, marginTop: 8 }} onClick={() => { setModalData({}); setModal('booking'); }}>+ הזמן</button>
              </div>
            );
          })}
        </div>
      )}

      {/* AI TAB */}
      {tab === 'ai' && (
        <div className={s.sec}>
          <div className={s.aiCard}>
            <label className={s.fieldLabel}>סוג ניסוח</label>
            <select className={s.fieldInput} value={modalData.aiType || 'rejection'} onChange={e => setModalData(p => ({ ...p, aiType: e.target.value }))} style={{ marginBottom: 8 }}>
              <option value="rejection">דחיית בקשת אחריות</option>
              <option value="delay">עיכוב בחלק / תיקון</option>
              <option value="price">הצגת מחיר גבוה</option>
              <option value="ready">רכב מוכן לאיסוף</option>
              <option value="followup">מעקב / חזרה ללקוח</option>
              <option value="other">אחר</option>
            </select>
            <label className={s.fieldLabel}>פרטי הסיטואציה</label>
            <textarea className={s.fieldInput} rows={3} placeholder="שם לקוח, רכב, בקשה..." value={modalData.aiSit || ''} onChange={e => setModalData(p => ({ ...p, aiSit: e.target.value }))} style={{ resize: 'none', lineHeight: 1.5 }} />
            <label className={s.fieldLabel} style={{ marginTop: 8 }}>תשובה / מידע שיש לך</label>
            <textarea className={s.fieldInput} rows={2} placeholder="תשובת המנהל / המידע הרלוונטי" value={modalData.aiAns || ''} onChange={e => setModalData(p => ({ ...p, aiAns: e.target.value }))} style={{ resize: 'none', lineHeight: 1.5 }} />
            <button className={s.addBtn} style={{ marginTop: 8, marginBottom: 0 }} onClick={genAI}>✨ נסח לי</button>
            {modalData.aiLoading && <div className={s.aiLoading}>מנסח...</div>}
            {modalData.aiResult && (
              <>
                <div className={s.aiResult}>{modalData.aiResult}</div>
                <button className={s.copyBtn} onClick={() => { navigator.clipboard.writeText(modalData.aiResult).catch(() => {}); }}>📋 העתק</button>
              </>
            )}
          </div>
          <div className={s.aiHint}>ניסוח מותאם לשפת שירות לקסוס</div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'hist' && (
        <div className={s.sec}>
          <div className={s.searchWrap}>
            <input className={s.searchInput} placeholder="חיפוש בהיסטוריה..." value={histSearch} onChange={e => setHistSearch(e.target.value)} />
          </div>
          {filteredHist.length === 0 ? <div className={s.empty}>אין היסטוריה עדיין</div> : filteredHist.map(h => (
            <div key={h.id} className={s.histItem}>
              <div className={s.histHdr}>
                <div className={s.histName}>{h.name}{h.plate ? ` — ${h.plate}` : ''}</div>
                <div className={s.histDate}>{h.completedAt}</div>
              </div>
              {h.note && <div className={s.histNote}>{h.note}</div>}
              {h.closingNote && <div className={s.histClosing}>✓ {h.closingNote}</div>}
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && (
        <div className={s.sec}>
          {!notifPerm && (
            <div className={s.setCard} style={{ marginBottom: 14 }}>
              <div className={s.setRow}>
                <div><div className={s.setLabel2}>התראות Push</div><div className={s.setSub}>תזכורות גם כשהמסך נעול</div></div>
                <button className={`${s.tb} ${s.tbBlue}`} onClick={handleRequestNotif}>אפשר</button>
              </div>
            </div>
          )}
          <div className={s.setSection}>
            <div className={s.setLabel}>תזכורת בוקר</div>
            <div className={s.setCard}>
              <div className={s.setRow}>
                <div><div className={s.setLabel2}>שעת תזכורת</div><div className={s.setSub}>סיכום יומי אוטומטי</div></div>
                <input type="time" className={s.setInput} value={`${String(settings.morningHour || 8).padStart(2, '0')}:00`}
                  onChange={e => { const h = parseInt(e.target.value.split(':')[0]); setSettings(p => ({ ...p, morningHour: h })); }} />
              </div>
            </div>
          </div>
          <div className={s.setSection}>
            <div className={s.setLabel}>צי רכבים חליפיים</div>
            <div className={s.setCard}>
              {fleet.map(car => (
                <div key={car.id} className={s.setRow}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input className={s.setInput} defaultValue={car.name} onBlur={e => setFleet(prev => prev.map(c => c.id === car.id ? { ...c, name: e.target.value } : c))} style={{ width: 110 }} />
                    <input className={s.setInput} defaultValue={car.plate} onBlur={e => setFleet(prev => prev.map(c => c.id === car.id ? { ...c, plate: e.target.value } : c))} style={{ width: 110 }} />
                  </div>
                  <button className={`${s.tb} ${s.tbRed}`} onClick={() => { if (window.confirm('להסיר?')) setFleet(prev => prev.filter(c => c.id !== car.id)); }}>🗑️</button>
                </div>
              ))}
            </div>
            <button className={s.addBtn} onClick={() => { const n = prompt('שם הרכב:'); const p = n && prompt('מספר לוחית:'); if (n && p) setFleet(prev => [...prev, { id: Date.now(), name: n, plate: p }]); }}>+ הוסף רכב לצי</button>
          </div>
          <div className={s.setSection}>
            <div className={s.setLabel}>הערות לקוחות חוזרים</div>
            <div className={s.setCard}>
              {custNotes.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)', padding: '8px 0' }}>אין הערות עדיין</div>}
              {custNotes.map(c => (
                <div key={c.id} className={s.setRow}>
                  <div><div className={s.setLabel2}>{c.name}</div><div className={s.setSub}>{c.note}</div></div>
                  <button className={`${s.tb} ${s.tbRed}`} onClick={() => setCustNotes(prev => prev.filter(x => x.id !== c.id))}>🗑️</button>
                </div>
              ))}
            </div>
            <button className={s.addBtn} onClick={() => { setModalData({ cnName: '', cnNote: '' }); setModal('custNote'); }}>+ הוסף הערה על לקוח</button>
          </div>
          <div className={s.setSection}>
            <div className={s.setLabel}>אזור סכנה</div>
            <div className={s.setCard}>
              <div className={s.setRow}>
                <div><div className={s.setLabel2}>מחק הכל</div><div className={s.setSub}>מחיקת כל הנתונים</div></div>
                <button className={`${s.tb} ${s.tbRed}`} onClick={() => { if (window.confirm('למחוק הכל? לא ניתן לשחזר.')) { setTasks([]); setBookings([]); setHistory([]); setCustNotes([]); } }}>מחק</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {modal === 'export' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <h3 className={s.modalTitle}>ייצוא סיכום יומי</h3>
          <pre className={s.exportBox}>{modalData.exportText}</pre>
          <div className={s.macts}>
            <button className={s.bcn} onClick={() => setModal(null)}>סגור</button>
            <button className={s.bsv} onClick={() => navigator.clipboard.writeText(modalData.exportText).catch(() => {})}>📋 העתק לשיתוף</button>
          </div>
        </ModalOverlay>
      )}

      {modal === 'task' && (
        <TaskModal
          data={modalData} s={s}
          onChange={d => setModalData(p => ({ ...p, ...d }))}
          onSave={() => { saveTask(modalData); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'done' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <h3 className={s.modalTitle}>סיום משימה</h3>
          <div className={s.field}>
            <label className={s.fieldLabel}>הערת סיום (אופציונלי)</label>
            <textarea className={s.fieldInput} rows={2} placeholder="מה נעשה? מה הוסכם?" value={modalData.doneNote || ''} onChange={e => setModalData(p => ({ ...p, doneNote: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div className={s.macts}>
            <button className={s.bcn} onClick={() => setModal(null)}>ביטול</button>
            <button className={s.bsv} onClick={() => { doneTask(modalData.doneId, modalData.doneNote || ''); setModal(null); }}>סיים משימה</button>
          </div>
        </ModalOverlay>
      )}

      {modal === 'remind' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <h3 className={s.modalTitle}>🔔 הגדר תזכורת</h3>
          <div className={s.remindTaskPreview}>
            <div className={s.remindTaskName}>{modalData.remindTaskName}</div>
            {modalData.remindTaskNote && <div className={s.remindTaskNote}>{modalData.remindTaskNote}</div>}
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>מתי לתזכר אותך?</label>
            <input
              className={s.fieldInput}
              type="datetime-local"
              value={modalData.remindTime || ''}
              onChange={e => setModalData(p => ({ ...p, remindTime: e.target.value }))}
            />
          </div>
          <div className={s.remindQuickBtns}>
            {[
              ['עוד שעה', 1],
              ['עוד 2 שעות', 2],
              ['מחר בבוקר', null],
            ].map(([label, hours]) => (
              <button key={label} className={s.remindQuickBtn} onClick={() => {
                const d = new Date();
                if (hours) {
                  d.setHours(d.getHours() + hours, 0, 0, 0);
                } else {
                  d.setDate(d.getDate() + 1);
                  d.setHours(8, 0, 0, 0);
                }
                setModalData(p => ({ ...p, remindTime: d.toISOString().slice(0, 16) }));
              }}>{label}</button>
            ))}
          </div>
          <div className={s.macts}>
            <button className={s.bcn} onClick={() => setModal(null)}>ביטול</button>
            <button className={s.bsv} onClick={() => {
              if (!modalData.remindTime) return;
              if (isPast(modalData.remindTime)) { alert('התאריך שנבחר כבר עבר'); return; }
              setTasks(prev => prev.map(t => {
                if (t.id !== modalData.remindTaskId) return t;
                const updated = { ...t, remind: modalData.remindTime };
                if (notifPerm) scheduleTaskReminder(updated);
                return updated;
              }));
              setModal(null);
            }}>שמור תזכורת</button>
          </div>
        </ModalOverlay>
      )}

      {modal === 'booking' && (
        <BookingModal
          data={modalData} s={s} fleet={fleet}
          onChange={d => setModalData(p => ({ ...p, ...d }))}
          checkConflict={checkConflict}
          onSave={() => { saveBooking(modalData); setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'return' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <h3 className={s.modalTitle}>החזרת רכב</h3>
          <div className={s.field}><label className={s.fieldLabel}>ק"מ בחזרה</label><input className={s.fieldInput} type="number" placeholder="45500" dir="ltr" value={modalData.kmIn || ''} onChange={e => setModalData(p => ({ ...p, kmIn: e.target.value }))} /></div>
          <div className={s.field}><label className={s.fieldLabel}>מצב הרכב</label>
            <select className={s.fieldInput} value={modalData.retCond || 'ok'} onChange={e => setModalData(p => ({ ...p, retCond: e.target.value }))}>
              <option value="ok">תקין</option><option value="damage">נזק / שריטה</option><option value="fuel">דלק חסר</option>
            </select>
          </div>
          <div className={s.field}><label className={s.fieldLabel}>הערה</label><input className={s.fieldInput} placeholder="אופציונלי" value={modalData.retNote || ''} onChange={e => setModalData(p => ({ ...p, retNote: e.target.value }))} /></div>
          <div className={s.macts}>
            <button className={s.bcn} onClick={() => setModal(null)}>ביטול</button>
            <button className={s.bsv} onClick={() => { returnCar(modalData.retId, modalData.kmIn, modalData.retCond || 'ok', modalData.retNote || ''); setModal(null); }}>אשר החזרה</button>
          </div>
        </ModalOverlay>
      )}

      {modal === 'custNote' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <h3 className={s.modalTitle}>הערה על לקוח חוזר</h3>
          <div className={s.field}><label className={s.fieldLabel}>שם לקוח</label><input className={s.fieldInput} placeholder="שם מלא" value={modalData.cnName || ''} onChange={e => setModalData(p => ({ ...p, cnName: e.target.value }))} /></div>
          <div className={s.field}><label className={s.fieldLabel}>הערה</label><textarea className={s.fieldInput} rows={3} placeholder="לדוגמה: תמיד מאחר בהחזרת חליפי..." value={modalData.cnNote || ''} onChange={e => setModalData(p => ({ ...p, cnNote: e.target.value }))} style={{ resize: 'none' }} /></div>
          <div className={s.macts}>
            <button className={s.bcn} onClick={() => setModal(null)}>ביטול</button>
            <button className={s.bsv} onClick={() => { if (modalData.cnName && modalData.cnNote) { setCustNotes(prev => [...prev, { id: Date.now(), name: modalData.cnName, note: modalData.cnNote }]); setModal(null); } }}>שמור</button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function ModalOverlay({ children, onClose }) {
  return (
    <div style={{ minHeight: 480, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-primary, #fff)', borderRadius: '12px 12px 0 0', padding: '16px 15px', width: '100%', maxWidth: 390, maxHeight: '88vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function TaskModal({ data, s, onChange, onSave, onClose }) {
  const now = new Date(); now.setHours(now.getHours() + 1, 0, 0, 0);
  const defaultRemind = data.remind || now.toISOString().slice(0, 16);
  return (
    <ModalOverlay onClose={onClose}>
      <h3 className={s.modalTitle}>{data.isEdit ? 'עריכת משימה' : 'משימה חדשה'}</h3>
      <div className={s.field}><label className={s.fieldLabel}>שם לקוח *</label><input className={s.fieldInput} placeholder="שם מלא" value={data.name || ''} onChange={e => onChange({ name: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>מספר רכב</label><input className={s.fieldInput} placeholder="123-45-678" value={data.plate || ''} onChange={e => onChange({ plate: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>טלפון</label><input className={s.fieldInput} type="tel" placeholder="050-0000000" dir="ltr" value={data.phone || ''} onChange={e => onChange({ phone: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>סטטוס</label>
        <select className={s.fieldInput} value={data.status || 'me'} onChange={e => onChange({ status: e.target.value })}>
          <option value="me">ממתין לי</option><option value="manager">ממתין למנהל</option><option value="parts">ממתין למחסן</option>
        </select>
      </div>
      <div className={s.field}><label className={s.fieldLabel}>עדיפות</label>
        <div className={s.priRow}>
          {[['high', 'דחוף', s.priHigh], ['med', 'רגיל', s.priMed], ['low', 'נמוכה', s.priLow]].map(([v, l, cls]) => (
            <button key={v} className={`${s.priOpt} ${data.priority === v ? cls : ''}`} onClick={() => onChange({ priority: v })}>{l}</button>
          ))}
        </div>
      </div>
      <div className={s.field}><label className={s.fieldLabel}>הערה</label><textarea className={s.fieldInput} rows={2} placeholder="מה צריך לעשות?" value={data.note || ''} onChange={e => onChange({ note: e.target.value })} style={{ resize: 'none' }} /></div>
      <div className={s.field}><label className={s.fieldLabel}>תזכורת</label><input className={s.fieldInput} type="datetime-local" value={data.remind || defaultRemind} onChange={e => onChange({ remind: e.target.value })} /></div>
      <div className={s.macts}>
        <button className={s.bcn} onClick={onClose}>ביטול</button>
        <button className={s.bsv} onClick={() => { if (data.name?.trim()) onSave(); }}>שמור</button>
      </div>
    </ModalOverlay>
  );
}

function BookingModal({ data, s, fleet, onChange, checkConflict, onSave, onClose }) {
  const [conflict, setConflict] = useState(false);
  const now = new Date(); now.setMinutes(0, 0, 0);
  const ret = new Date(now); ret.setDate(ret.getDate() + 2);
  return (
    <ModalOverlay onClose={onClose}>
      <h3 className={s.modalTitle}>{data.isEdit ? 'עריכת הזמנה' : 'הזמנת חליפי חדשה'}</h3>
      {conflict && <div className={s.confBanner}>קונפליקט — הרכב תפוס בתאריכים אלה. בחר רכב אחר.</div>}
      <div className={s.field}><label className={s.fieldLabel}>לקוח *</label><input className={s.fieldInput} placeholder="שם מלא" value={data.customer || ''} onChange={e => onChange({ customer: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>טלפון</label><input className={s.fieldInput} type="tel" placeholder="050-0000000" dir="ltr" value={data.phone || ''} onChange={e => onChange({ phone: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>רכב לקוח</label><input className={s.fieldInput} placeholder="מספר רכב" value={data.plate || ''} onChange={e => onChange({ plate: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>רכב חליפי</label>
        <select className={s.fieldInput} value={data.carId || fleet[0]?.id || 1} onChange={e => onChange({ carId: parseInt(e.target.value) })}>
          {fleet.map(c => <option key={c.id} value={c.id}>{c.name} — {c.plate}</option>)}
        </select>
      </div>
      <div className={s.field}><label className={s.fieldLabel}>תאריך ושעת איסוף *</label><input className={s.fieldInput} type="datetime-local" value={data.pickup || now.toISOString().slice(0, 16)} onChange={e => onChange({ pickup: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>תאריך ושעת החזרה משוערת *</label><input className={s.fieldInput} type="datetime-local" value={data.returnEst || ret.toISOString().slice(0, 16)} onChange={e => onChange({ returnEst: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>ק"מ יציאה</label><input className={s.fieldInput} type="number" placeholder="45000" dir="ltr" value={data.kmOut || ''} onChange={e => onChange({ kmOut: e.target.value })} /></div>
      <div className={s.field}><label className={s.fieldLabel}>הערה</label><input className={s.fieldInput} placeholder="אופציונלי" value={data.note || ''} onChange={e => onChange({ note: e.target.value })} /></div>
      <div className={s.macts}>
        <button className={s.bcn} onClick={onClose}>ביטול</button>
        <button className={s.bsv} onClick={() => {
          if (!data.customer?.trim() || !data.pickup || !data.returnEst) return;
          const carId = data.carId || fleet[0]?.id;
          if (checkConflict(carId, data.pickup, data.returnEst, data.id)) { setConflict(true); return; }
          setConflict(false); onSave();
        }}>שמור</button>
      </div>
    </ModalOverlay>
  );
}
