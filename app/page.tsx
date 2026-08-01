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
  const [copyState, setCopyState] = useState("표 복사");

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
      }
    } catch {
      // Start with a clean record when browser storage cannot be read.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("intersection-timed-records-v1", JSON.stringify({ records, drafts, mode, date, slot }));
  }, [records, drafts, mode, date, slot, ready]);

  const positions = mode === "full" ? fullMode : photoMode;
  const ids = mode === "full" ? Array.from({ length: 12 }, (_, i) => i + 1) : [2, 3, 4, 6, 7, 8];
  const key = draftKey(date, slot);
  const counts = drafts[key] ?? records[date]?.[slot] ?? emptyCounts();
  const total = useMemo(() => positions.reduce((sum, { id }) => sum + counts[id], 0), [counts, positions]);
  const savedCurrent = Boolean(records[date]?.[slot]);

  const setCurrentCounts = (next: Counts) => setDrafts((current) => ({ ...current, [key]: next }));
  const changeCount = (id: number, amount: number) => setCurrentCounts({ ...counts, [id]: Math.max(0, counts[id] + amount) });

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

  const tableText = (separator = "\t") => {
    const header = ["시간", ...ids.map((id) => `${id}번`), "합계"];
    const rows = slots.map(({ key: rowSlot, label }) => {
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
    const csv = `\uFEFF${tableText(",")}`;
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
    </main>
  );
}
