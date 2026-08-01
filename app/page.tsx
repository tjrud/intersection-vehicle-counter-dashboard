"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

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
type ExcelState = { kind: "idle" | "working" | "success" | "error"; message: string };

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
const excelColumns = ["H", "P", "X"] as const;

const parseXml = (text: string) => {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("엑셀 내부 문서를 읽을 수 없습니다.");
  return document;
};

const numericCellValue = (cell: Element | null) => {
  if (!cell) return null;
  const value = Number(cell.querySelector("v")?.textContent);
  return Number.isFinite(value) ? value : null;
};

const setNumericCell = (document: XMLDocument, row: Element, column: string, rowNumber: number, value: number) => {
  const address = `${column}${rowNumber}`;
  let cell = Array.from(row.children).find((item) => item.tagName.endsWith("c") && item.getAttribute("r") === address);
  if (!cell) {
    cell = document.createElementNS(row.namespaceURI, "c");
    cell.setAttribute("r", address);
    const columnNumber = column.charCodeAt(0) - 64;
    const nextCell = Array.from(row.children).find((item) => {
      const reference = item.getAttribute("r") ?? "";
      return reference.charCodeAt(0) - 64 > columnNumber;
    });
    row.insertBefore(cell, nextCell ?? null);
  }
  cell.removeAttribute("t");
  Array.from(cell.children).forEach((child) => {
    if (child.tagName.endsWith("f") || child.tagName.endsWith("v") || child.tagName.endsWith("is")) child.remove();
  });
  const valueNode = document.createElementNS(row.namespaceURI, "v");
  valueNode.textContent = String(Math.max(0, Math.trunc(value)));
  cell.appendChild(valueNode);
};

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
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelState, setExcelState] = useState<ExcelState>({ kind: "idle", message: "" });
  const audioContextRef = useRef<AudioContext | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const nextSoundAtRef = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("intersection-timed-records-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에 저장된 현장 기록을 최초 한 번 복원합니다.
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

  useEffect(() => () => {
    audioContextRef.current?.close();
    audioContextRef.current = null;
    compressorRef.current = null;
  }, []);

  const positions = mode === "full" ? fullMode : photoMode;
  const ids = mode === "full" ? Array.from({ length: 12 }, (_, i) => i + 1) : [2, 3, 4, 6, 7, 8];
  const key = draftKey(date, slot);
  const counts = drafts[key] ?? records[date]?.[slot] ?? emptyCounts();
  const total = useMemo(() => positions.reduce((sum, { id }) => sum + counts[id], 0), [counts, positions]);
  const savedCurrent = Boolean(records[date]?.[slot]);

  const setCurrentCounts = (next: Counts) => setDrafts((current) => ({ ...current, [key]: next }));
  const playSound = (force = false, direction: 1 | -1 = 1) => {
    if (!soundOn && !force) return;
    let context = audioContextRef.current;
    if (!context || context.state === "closed") {
      context = new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = context;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 16;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.09;
      compressor.connect(context.destination);
      compressorRef.current = compressor;
    }
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(compressorRef.current ?? context.destination);
    const now = Math.max(context.currentTime + 0.003, nextSoundAtRef.current);
    nextSoundAtRef.current = now + 0.024;
    const pitch = direction === -1 ? 0.7 : 1;
    if (soundName === "click") {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(760 * pitch, now);
      oscillator.frequency.exponentialRampToValueAtTime(420 * pitch, now + 0.045);
      gain.gain.setValueAtTime(0.55 * (volume / 100), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      oscillator.start(now); oscillator.stop(now + 0.06);
    } else if (soundName === "clack") {
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(190 * pitch, now);
      oscillator.frequency.exponentialRampToValueAtTime(95 * pitch, now + 0.065);
      gain.gain.setValueAtTime(0.42 * (volume / 100), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      oscillator.start(now); oscillator.stop(now + 0.085);
    } else {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440 * pitch, now);
      gain.gain.setValueAtTime(0.36 * (volume / 100), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      oscillator.start(now); oscillator.stop(now + 0.13);
    }
  };

  const changeCount = (id: number, amount: number) => {
    playSound(false, amount < 0 ? -1 : 1);
    setDrafts((current) => {
      const base = current[key] ?? records[date]?.[slot] ?? emptyCounts();
      return { ...current, [key]: { ...base, [id]: Math.max(0, base[id] + amount) } };
    });
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

  const tableText = (separator = "\t", savedOnly = false, hourlySpacing = false) => {
    const header = ["시간", ...ids.map((id) => `${id}번`), "합계"];
    const sourceSlots = savedOnly ? slots.filter(({ key: rowSlot }) => Boolean(records[date]?.[rowSlot])) : slots;
    const rows: Array<Array<string | number>> = [];
    sourceSlots.forEach(({ key: rowSlot, label }, index) => {
      const previousSlot = sourceSlots[index - 1];
      if (hourlySpacing && previousSlot && Math.floor(Number(previousSlot.key) / 4) !== Math.floor(Number(rowSlot) / 4)) {
        rows.push(Array(header.length).fill(""));
      }
      const row = records[date]?.[rowSlot] ?? emptyCounts();
      const values = ids.map((id) => row[id] ?? 0);
      rows.push([label, ...values, values.reduce((sum, value) => sum + value, 0)]);
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
    const csv = `\uFEFF${tableText(",", true, true)}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `차량카운트_${mode === "full" ? "12개" : "6개"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fillExcelTemplate = async () => {
    const savedSlots = Object.entries(records[date] ?? {});
    if (!excelFile) {
      setExcelState({ kind: "error", message: "먼저 수정할 .xlsx 파일을 선택해 주세요." });
      return;
    }
    if (!savedSlots.length) {
      setExcelState({ kind: "error", message: "엑셀에 입력할 저장 기록이 없습니다." });
      return;
    }

    setExcelState({ kind: "working", message: "엑셀 파일에 기록을 입력하고 있습니다…" });
    try {
      const zip = await JSZip.loadAsync(await excelFile.arrayBuffer());
      const workbookText = await zip.file("xl/workbook.xml")?.async("text");
      const relationsText = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
      if (!workbookText || !relationsText) throw new Error("올바른 .xlsx 파일이 아닙니다.");

      const workbookDocument = parseXml(workbookText);
      const relationsDocument = parseXml(relationsText);
      const relations = new Map(
        Array.from(relationsDocument.querySelectorAll("Relationship")).map((relation) => [
          relation.getAttribute("Id") ?? "",
          relation.getAttribute("Target") ?? "",
        ]),
      );
      const worksheetPaths = Array.from(workbookDocument.querySelectorAll("sheet")).map((sheet) => {
        const relationshipId = sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? "";
        const target = relations.get(relationshipId) ?? "";
        return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
      });

      let filledCells = 0;
      let matchedTemplate = false;
      for (const worksheetPath of worksheetPaths) {
        const worksheetFile = zip.file(worksheetPath);
        if (!worksheetFile) continue;
        const worksheetDocument = parseXml(await worksheetFile.async("text"));
        const rows = new Map<number, Element>();
        worksheetDocument.querySelectorAll("row").forEach((row) => rows.set(Number(row.getAttribute("r")), row));

        const headers = Array.from(rows.entries()).filter(([, row]) => {
          const values = ["E", "M", "U"].map((column) => numericCellValue(row.querySelector(`c[r="${column}${row.getAttribute("r")}"]`)));
          return values.every((value) => value !== null && value >= 1 && value <= 12) && values[1] === values[0]! + 1 && values[2] === values[1]! + 1;
        });
        if (headers.length < 4) continue;
        matchedTemplate = true;

        headers.forEach(([headerRow, header]) => {
          const movementIds = ["E", "M", "U"].map((column) => numericCellValue(header.querySelector(`c[r="${column}${headerRow}"]`)) as number);
          const blockIndex = Math.floor((headerRow - headers[0][0]) / 112);
          const blockStartSlot = blockIndex * 16;
          savedSlots.forEach(([savedSlot, savedCounts]) => {
            const slotNumber = Number(savedSlot);
            if (slotNumber < blockStartSlot || slotNumber >= blockStartSlot + 16) return;
            const localSlot = slotNumber - blockStartSlot;
            const targetRowNumber = headerRow + 3 + Math.floor(localSlot / 4) * 6 + (localSlot % 4);
            const targetRow = rows.get(targetRowNumber);
            if (!targetRow) throw new Error(`${slots[slotNumber].label} 입력 행을 찾지 못했습니다.`);
            movementIds.forEach((movementId, index) => {
              setNumericCell(worksheetDocument, targetRow, excelColumns[index], targetRowNumber, savedCounts[movementId] ?? 0);
              filledCells += 1;
            });
          });
        });

        zip.file(worksheetPath, new XMLSerializer().serializeToString(worksheetDocument));
      }

      if (!matchedTemplate || filledCells === 0) throw new Error("동연사거리 양식의 번호·시간 배치를 찾지 못했습니다.");
      const calcProperties = workbookDocument.querySelector("calcPr");
      if (calcProperties) {
        calcProperties.setAttribute("calcMode", "auto");
        calcProperties.setAttribute("fullCalcOnLoad", "1");
        calcProperties.setAttribute("forceFullCalc", "1");
      }
      zip.file("xl/workbook.xml", new XMLSerializer().serializeToString(workbookDocument));

      const output = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(output);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${excelFile.name.replace(/\.xlsx$/i, "")}_자동입력.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setExcelState({ kind: "success", message: `${savedSlots.length}개 시간대의 번호별 기록을 입력했습니다.` });
    } catch (error) {
      setExcelState({ kind: "error", message: error instanceof Error ? error.message : "엑셀 파일 처리에 실패했습니다." });
    }
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
            <div className="excel-import">
              <div><b>동연사거리 엑셀 자동 입력</b><p>저장된 번호별 차량 수를 같은 15분 시간대의 소계 칸에 넣습니다. 원본 서식과 다른 값은 그대로 유지됩니다.</p></div>
              <label className="excel-file"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setExcelFile(event.target.files?.[0] ?? null); setExcelState({ kind: "idle", message: "" }); }} /><span>{excelFile ? excelFile.name : "엑셀 파일 선택"}</span></label>
              <button type="button" className="excel-fill" disabled={excelState.kind === "working"} onClick={fillExcelTemplate}>{excelState.kind === "working" ? "입력 중…" : "기록 입력 후 다운로드"}</button>
              {excelState.message && <p className={`excel-message ${excelState.kind}`} role="status">{excelState.message}</p>}
            </div>
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
