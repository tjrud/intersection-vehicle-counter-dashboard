"use client";

import { useEffect, useMemo, useState } from "react";

const fullMode = [
  { id: 9, area: "n1" }, { id: 8, area: "n2" }, { id: 7, area: "n3" },
  { id: 10, area: "w1" }, { id: 11, area: "w2" }, { id: 12, area: "w3" },
  { id: 6, area: "e1" }, { id: 5, area: "e2" }, { id: 4, area: "e3" },
  { id: 1, area: "s1" }, { id: 2, area: "s2" }, { id: 3, area: "s3" },
] as const;
const photoMode = [
  { id: 3, area: "p3" }, { id: 2, area: "p2" }, { id: 4, area: "p4" },
  { id: 6, area: "p6" }, { id: 7, area: "p7" }, { id: 8, area: "p8" },
] as const;

type Mode = "full" | "photo";
type Theme = "light" | "dark" | "green";
type SoundName = "click" | "clack" | "soft";
type Counts = Record<number, number>;
type DayRecords = Record<string, Counts>;
type Records = Record<string, DayRecords>;
type Drafts = Record<string, Counts>;

const emptyCounts = (): Counts =>
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 0])) as Counts;
const pad = (value: number) => String(value).padStart(2, "0");
const localDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const slots = Array.from({ length: 96 }, (_, index) => {
  const start = index * 15;
  const end = start + 15;
  return {
    key: pad(index),
    label: `${pad(Math.floor(start / 60))}:${pad(start % 60)} ~ ${pad(Math.floor(end / 60) % 24)}:${pad(end % 60)}`,
  };
});
const currentSlot = () => pad(Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 15));
const draftKey = (date: string, slot: string) => `${date}|${slot}`;

export default function Home() {
  const [mode, setMode] = useState<Mode>("full");
  const [date, setDate] = useState(localDate);
  const [slot, setSlot] = useState(currentSlot);
  const [records, setRecords] = useState<Records>({});
  const [drafts, setDrafts] = useState<Drafts>({});
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copyState, setCopyState] = useState("표 복사");
  const [theme, setTheme] = useState<Theme>("light");
  const [soundOn, setSoundOn] = useState(false);
  const [soundName, setSoundName] = useState<SoundName>("click");
  const [volume, setVolume] = useState(60);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("intersection-timed-records-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        setRecords(parsed.records ?? {});
        setDrafts(parsed.drafts ?? {});
        setMode(parsed.mode === "photo" ? "photo" : "full");
        setDate(parsed.date ?? localDate());
        setSlot(parsed.slot ?? currentSlot());
        setTheme(["light", "dark", "green"].includes(parsed.theme) ? parsed.theme : "light");
        setSoundOn(Boolean(parsed.soundOn));
        setSoundName(["click", "clack", "soft"].includes(parsed.soundName) ? parsed.soundName : "click");
        setVolume(typeof parsed.volume === "number" ? Math.min(100, Math.max(0, parsed.volume)) : 60);
      }
    } catch {
      // Start with a clean record when browser storage cannot be read.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("intersection-timed-records-v1", JSON.stringify({ records, drafts, mode, date, slot, theme, soundOn, soundName, volume }));
  }, [records, drafts, mode, date, slot, theme, soundOn, soundName, volume, ready]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const positions = mode === "full" ? fullMode : photoMode;
  const ids = mode === "full" ? Array.from({ length: 12 }, (_, i) => i + 1) : [2, 3, 4, 6, 7, 8];
  const key = draftKey(date, slot);
  const counts = drafts[key] ?? records[date]?.[slot] ?? emptyCounts();
  const total = useMemo(() => positions.reduce((sum, { id }) => sum + counts[id], 0), [counts, positions]);
  const savedCurrent = Boolean(records[date]?.[slot]);

  const setCurrentCounts = (next: Counts) => setDrafts((current) => ({ ...current, [key]: next }));
  const playSound = (force = false) => {
    if (!soundOn && !force) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    const now = context.currentTime;
    if (soundName === "click") {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(760, now);
      oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.045);
      gain.gain.setValueAtTime(0.11 * (volume / 100), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      oscillator.start(now); oscillator.stop(now + 0.06);
    } else if (soundName === "clack") {
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(190, now);
      oscillator.frequency.exponentialRampToValueAtTime(95, now + 0.065);
      gain.gain.setValueAtTime(0.075 * (volume / 100), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      oscillator.start(now); oscillator.stop(now + 0.085);
    } else {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.065 * (volume / 100), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      oscillator.start(now); oscillator.stop(now + 0.13);
    }
    window.setTimeout(() => context.close(), 180);
  };

  const changeCount = (id: number, amount: number) => {
    playSound();
    setCurrentCounts({ ...counts, [id]: Math.max(0, counts[id] + amount) });
  };

  const saveAndNext = () => {
    setRecords((current) => ({ ...current, [date]: { ...(current[date] ?? {}), [slot]: counts } }));
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    const nextIndex = Number(slot) + 1;
    if (nextIndex < 96) setSlot(pad(nextIndex));
    else {
      const nextDate = new Date(`${date}T12:00:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      setDate(localDate(nextDate));
      setSlot("00");
    }
  };

  const resetDraft = () => {
    setCurrentCounts(emptyCounts());
    setConfirmReset(false);
  };

  const tableText = (separator = "\t", savedOnly = false) => {
    const header = ["시간", ...ids.map((id) => `${id}번`), "합계"];
    const sourceSlots = savedOnly ? slots.filter(({ key: rowSlot }) => Boolean(records[date]?.[rowSlot])) : slots;
    const rows = sourceSlots.map(({ key: rowSlot, label }) => {
      const row = records[date]?.[rowSlot] ?? emptyCounts();
      const values = ids.map((id) => row[id] ?? 0);
      return [label, ...values, values.reduce((sum, value) => sum + value, 0)];
    });
    return [header, ...rows].map((row) => row.join(separator)).join("\n");
  };

  const copyTable = async () => {
    try {
      await navigator.clipboard.writeText(tableText());
      setCopyState("복사 완료");
      window.setTimeout(() => setCopyState("표 복사"), 1600);
    } catch {
      setCopyState("복사 실패");
    }
  };

  const downloadCsv = () => {
    const csv = `\uFEFF${tableText(",", true)}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `차량카운트_${mode === "full" ? "12개" : "6개"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow"><span className="live-dot" />현장 집계 중</p><h1>교차로 차량 카운터</h1></div>
        <div className="total-card" aria-live="polite"><span>현재 구간 합계</span><strong>{total.toLocaleString()}</strong><small>대</small></div>
      </header>

      <section className="record-toolbar" aria-label="기록 시간 선택">
        <div className="time-field wide"><label htmlFor="record-slot">기록 시간</label><select id="record-slot" value={slot} onChange={(e) => setSlot(e.target.value)}>{slots.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
        <span className={`save-status ${savedCurrent ? "saved" : "draft"}`}>{savedCurrent ? "저장된 구간" : "작성 중"}</span>
        <button type="button" className="sheet-open" onClick={() => setShowSheet(true)}>저장 기록 보기</button>
        <button type="button" className="settings-open" onClick={() => setShowSettings(true)}>설정</button>
      </section>

      <nav className="mode-switch" aria-label="카운터 모드 선택">
        <button type="button" className={mode === "full" ? "active" : ""} aria-pressed={mode === "full"} onClick={() => setMode("full")}><b>12개 모드</b><span>1–12 전체</span></button>
        <button type="button" className={mode === "photo" ? "active" : ""} aria-pressed={mode === "photo"} onClick={() => setMode("photo")}><b>6개 모드</b><span>2·3·4·6·7·8</span></button>
      </nav>

      <section className={`counter-panel ${mode === "photo" ? "photo-layout" : "full-layout"}`} aria-label="번호별 차량 카운터">
        <div className="intersection" aria-hidden="true"><div className="road vertical-road" /><div className="road horizontal-road" /><div className="center-mark"><span>{slots[Number(slot)].label}</span><b>TOTAL</b><strong>{total}</strong></div></div>
        {positions.map(({ id, area }) => (
          <article className={`counter counter-${area}`} key={`${mode}-${id}`}><span className="number-badge">{id}</span><output aria-label={`${id}번 현재 ${counts[id]}대`}>{counts[id].toLocaleString()}</output><div className="controls"><button type="button" className="minus" onClick={() => changeCount(id, -1)} disabled={counts[id] === 0} aria-label={`${id}번 1대 빼기`}>−</button><button type="button" className="plus" onClick={() => changeCount(id, 1)} aria-label={`${id}번 1대 추가`}>+</button></div></article>
        ))}
      </section>

      <footer className="footer-bar">
        <p><span>●</span> 작성 중인 값도 이 기기에 자동 보관됩니다</p>
        <div className="footer-actions">
          {!confirmReset ? <button type="button" className="reset-button" onClick={() => setConfirmReset(true)}>현재 값 지우기</button> : <div className="reset-confirm"><span>현재 값을 지울까요?</span><button type="button" onClick={() => setConfirmReset(false)}>취소</button><button type="button" className="danger" onClick={resetDraft}>지우기</button></div>}
          <button type="button" className="save-next" onClick={saveAndNext}><span>{slots[Number(slot)].label} 저장</span><b>저장 후 다음 시간 →</b></button>
        </div>
      </footer>

      {showSheet && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setShowSheet(false)}>
          <section className="sheet-modal" role="dialog" aria-modal="true" aria-label="저장 기록 표">
            <header><div><h2>저장 기록</h2><p>00:00부터 15분 단위</p></div><div className="sheet-actions"><button type="button" onClick={copyTable}>{copyState}</button><button type="button" onClick={downloadCsv}>CSV 다운로드</button><button type="button" className="close-modal" onClick={() => setShowSheet(false)} aria-label="닫기">×</button></div></header>
            <div className="table-wrap"><table><thead><tr><th>시간</th>{ids.map((id) => <th key={id}>{id}번</th>)}<th>합계</th></tr></thead><tbody>{slots.map(({ key: rowSlot, label }) => { const row = records[date]?.[rowSlot]; const values = ids.map((id) => row?.[id] ?? 0); const sum = values.reduce((a, b) => a + b, 0); return <tr className={row ? "has-data" : ""} key={rowSlot}><th>{label}</th>{values.map((value, index) => <td key={ids[index]}>{value}</td>)}<td className="row-total">{sum}</td></tr>; })}</tbody></table></div>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setShowSettings(false)}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-label="설정">
            <header><div><h2>설정</h2><p>화면과 버튼 소리를 조절합니다</p></div><button type="button" className="settings-close" onClick={() => setShowSettings(false)} aria-label="닫기">×</button></header>
            <div className="settings-body">
              <fieldset><legend>테마 색</legend><div className="theme-options">
                <button type="button" className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}><i className="swatch light" /><span><b>흰색</b><small>밝고 선명하게</small></span></button>
                <button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}><i className="swatch dark" /><span><b>검정색</b><small>어두운 환경</small></span></button>
                <button type="button" className={theme === "green" ? "selected" : ""} onClick={() => setTheme("green")}><i className="swatch green" /><span><b>은은한 그린</b><small>눈이 편안한 색감</small></span></button>
              </div></fieldset>
              <fieldset><legend>버튼 소리</legend><label className="sound-toggle"><span><b>소리 사용</b><small>− / + 버튼을 누를 때 재생</small></span><input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} /><i /></label>
                <div className="sound-options">{(["click", "clack", "soft"] as SoundName[]).map((name) => <button type="button" key={name} disabled={!soundOn} className={soundName === name ? "selected" : ""} onClick={() => setSoundName(name)}>{name === "click" ? "클릭" : name === "clack" ? "딸칵" : "부드러운 톤"}</button>)}</div>
                <label className={`volume-control ${!soundOn ? "disabled" : ""}`}><span><b>볼륨</b><output>{volume}%</output></span><input type="range" min="0" max="100" step="5" value={volume} disabled={!soundOn} onChange={(e) => setVolume(Number(e.target.value))} aria-label="버튼 소리 볼륨" /></label>
                <button type="button" className="sound-preview" disabled={!soundOn} onClick={() => playSound(true)}>소리 미리 듣기</button>
              </fieldset>
            </div>
            <footer><button type="button" onClick={() => setShowSettings(false)}>완료</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
