"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { createEmptyLibrary, migrateToLibrary } from "./record-storage.mjs";

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
const boxMode = [
  { id: 3, area: "n1" }, { id: 2, area: "n2" }, { id: 1, area: "n3" },
  { id: 4, area: "w1" }, { id: 5, area: "w2" }, { id: 6, area: "w3" },
  { id: 12, area: "e1" }, { id: 11, area: "e2" }, { id: 10, area: "e3" },
  { id: 7, area: "s1" }, { id: 8, area: "s2" }, { id: 9, area: "s3" },
] as const;
const gyuhoMode = [
  { id: 6, area: "n1" }, { id: 5, area: "n2" }, { id: 4, area: "n3" },
  { id: 7, area: "w1" }, { id: 8, area: "w2" }, { id: 9, area: "w3" },
  { id: 3, area: "e1" }, { id: 2, area: "e2" }, { id: 1, area: "e3" },
  { id: 10, area: "s1" }, { id: 11, area: "s2" }, { id: 12, area: "s3" },
] as const;

type Mode = "full" | "photo" | "box" | "gyuho";
type Movement = "left" | "straight" | "right";
type VehicleCategory = "passenger" | "busSmall" | "busLarge" | "truckSmall" | "truckLarge" | "trailer";
type Theme = "light" | "dark" | "green";
type InputStyle = "card" | "buttons";
type SoundName = "click" | "clack" | "soft";
type CounterSound = SoundName | "default";
type CounterSounds = Record<Mode, Record<number, CounterSound>>;
type Counts = Record<string, number>;
type Records = Record<string, Counts>;
type Drafts = Record<string, Counts>;
type RecordSet = { id: string; name: string; records: Records; drafts: Drafts; slot: string };
type RecordLibrary = Record<Mode, RecordSet[]>;
type ActiveRecordIds = Record<Mode, string>;
type ExcelState = { kind: "idle" | "working" | "success" | "error"; message: string };

const emptyCounts = (): Counts =>
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 0])) as Counts;
const pad = (value: number) => String(value).padStart(2, "0");
const slots = Array.from({ length: 96 }, (_, index) => {
  const start = index * 15;
  const end = start + 15;
  return {
    key: pad(index),
    label: `${pad(Math.floor(start / 60))}:${pad(start % 60)} ~ ${pad(Math.floor(end / 60) % 24)}:${pad(end % 60)}`,
  };
});
const excelColumns = ["H", "P", "X"] as const;
const vehicleCategories: Array<{ key: VehicleCategory; group: string; label: string }> = [
  { key: "passenger", group: "소형", label: "승용" },
  { key: "busSmall", group: "버스", label: "소형" },
  { key: "busLarge", group: "버스", label: "대형" },
  { key: "truckSmall", group: "화물", label: "소형" },
  { key: "truckLarge", group: "화물", label: "중·대형" },
  { key: "trailer", group: "화물", label: "트레일러" },
];
const vehicleKeys = vehicleCategories.map(({ key }) => key);
const vehicleCountKey = (id: number, category: VehicleCategory) => `${id}:${category}`;
const vehicleLabel = (category: VehicleCategory) => {
  const item = vehicleCategories.find(({ key }) => key === category)!;
  return item.key === "passenger" ? item.label : `${item.group} ${item.label}`;
};
const soundNames: SoundName[] = ["click", "clack", "soft"];
const counterIdsByMode: Record<Mode, number[]> = {
  full: Array.from({ length: 12 }, (_, index) => index + 1),
  photo: [2, 3, 4, 6, 7, 8],
  box: Array.from({ length: 12 }, (_, index) => index + 1),
  gyuho: Array.from({ length: 12 }, (_, index) => index + 1),
};
const emptyCounterSounds = (): CounterSounds => ({
  full: Object.fromEntries(counterIdsByMode.full.map((id) => [id, "default"])) as Record<number, CounterSound>,
  photo: Object.fromEntries(counterIdsByMode.photo.map((id) => [id, "default"])) as Record<number, CounterSound>,
  box: Object.fromEntries(counterIdsByMode.box.map((id) => [id, "default"])) as Record<number, CounterSound>,
  gyuho: Object.fromEntries(counterIdsByMode.gyuho.map((id) => [id, "default"])) as Record<number, CounterSound>,
});
const normalizeCounterSounds = (value: unknown): CounterSounds => {
  const normalized = emptyCounterSounds();
  if (!value || typeof value !== "object") return normalized;
  for (const modeName of ["full", "photo", "box", "gyuho"] as Mode[]) {
    const source = (value as Partial<Record<Mode, Record<number, unknown>>>)[modeName];
    if (!source || typeof source !== "object") continue;
    counterIdsByMode[modeName].forEach((id) => {
      const selected = source[id];
      if (["default", ...soundNames].includes(selected as CounterSound)) normalized[modeName][id] = selected as CounterSound;
    });
  }
  return normalized;
};
const soundLabel = (name: SoundName) => name === "click" ? "클릭" : name === "clack" ? "딸칵" : "부드러운 톤";
const movementOf = (id: number): Movement => id % 3 === 1 ? "left" : id % 3 === 2 ? "straight" : "right";
const movementName = (movement: Movement) => movement === "left" ? "좌회전" : movement === "straight" ? "직진" : "우회전";
const modeName = (mode: Mode) => mode === "full" ? "모드 1 · 12개" : mode === "photo" ? "모드 2 · 6개" : mode === "box" ? "모드 3 · 12개" : "규호 모드 · 차량 분류";
const modeFileName = (mode: Mode) => mode === "full" ? "모드1_12개" : mode === "photo" ? "모드2_6개" : mode === "box" ? "모드3_12개" : "규호모드_차량분류";

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
  const [library, setLibrary] = useState<RecordLibrary>(() => createEmptyLibrary().library as RecordLibrary);
  const [activeRecordIds, setActiveRecordIds] = useState<ActiveRecordIds>(() => createEmptyLibrary().activeRecordIds as ActiveRecordIds);
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copyState, setCopyState] = useState("표 복사");
  const [theme, setTheme] = useState<Theme>("light");
  const [inputStyle, setInputStyle] = useState<InputStyle>("card");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCategory>("passenger");
  const [soundOn, setSoundOn] = useState(false);
  const [soundName, setSoundName] = useState<SoundName>("click");
  const [counterSounds, setCounterSounds] = useState<CounterSounds>(emptyCounterSounds);
  const [soundConfigMode, setSoundConfigMode] = useState<Mode>("full");
  const [volume, setVolume] = useState(60);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelState, setExcelState] = useState<ExcelState>({ kind: "idle", message: "" });
  const [editingRecordName, setEditingRecordName] = useState(false);
  const [recordNameDraft, setRecordNameDraft] = useState("");
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const nextSoundAtRef = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("intersection-timed-records-v3") ?? localStorage.getItem("intersection-timed-records-v2") ?? localStorage.getItem("intersection-timed-records-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        const migrated = migrateToLibrary(parsed);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에 저장된 현장 기록을 최초 한 번 복원합니다.
        setLibrary(migrated.library as RecordLibrary);
        setActiveRecordIds(migrated.activeRecordIds as ActiveRecordIds);
        setMode(parsed.mode === "photo" ? "photo" : parsed.mode === "box" ? "box" : parsed.mode === "gyuho" ? "gyuho" : "full");
        setTheme(["light", "dark", "green"].includes(parsed.theme) ? parsed.theme : "light");
        setInputStyle(parsed.inputStyle === "buttons" ? "buttons" : "card");
        setSelectedVehicle(vehicleKeys.includes(parsed.selectedVehicle) ? parsed.selectedVehicle : "passenger");
        setSoundOn(Boolean(parsed.soundOn));
        setSoundName(["click", "clack", "soft"].includes(parsed.soundName) ? parsed.soundName : "click");
        setCounterSounds(normalizeCounterSounds(parsed.counterSounds));
        setVolume(typeof parsed.volume === "number" ? Math.min(100, Math.max(0, parsed.volume)) : 60);
      }
    } catch {
      // Start with a clean record when browser storage cannot be read.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("intersection-timed-records-v3", JSON.stringify({ library, activeRecordIds, mode, theme, inputStyle, selectedVehicle, soundOn, soundName, counterSounds, volume }));
  }, [library, activeRecordIds, mode, theme, inputStyle, selectedVehicle, soundOn, soundName, counterSounds, volume, ready]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => () => {
    audioContextRef.current?.close();
    audioContextRef.current = null;
    compressorRef.current = null;
  }, []);

  const positions = mode === "full" ? fullMode : mode === "photo" ? photoMode : mode === "box" ? boxMode : gyuhoMode;
  const ids = mode === "photo" ? [2, 3, 4, 6, 7, 8] : Array.from({ length: 12 }, (_, i) => i + 1);
  const isBoxMode = mode === "box";
  const isGyuhoMode = mode === "gyuho";
  const usesCardControls = isBoxMode || isGyuhoMode || inputStyle === "card";
  const modeRecordSets = library[mode];
  const activeRecordId = activeRecordIds[mode];
  const activeRecordSet = modeRecordSets.find((recordSet) => recordSet.id === activeRecordId) ?? modeRecordSets[0];
  const { records, drafts, slot } = activeRecordSet;
  const safeRecordName = activeRecordSet.name.replace(/[\\/:*?"<>|]/g, "_");
  const counts = drafts[slot] ?? records[slot] ?? emptyCounts();
  const total = useMemo(() => isGyuhoMode
    ? positions.reduce((sum, { id }) => sum + vehicleKeys.reduce((vehicleSum, category) => vehicleSum + (counts[vehicleCountKey(id, category)] ?? 0), 0), 0)
    : positions.reduce((sum, { id }) => sum + (counts[id] ?? 0), 0), [counts, isGyuhoMode, positions]);
  const selectedVehicleTotal = useMemo(() => positions.reduce((sum, { id }) => sum + (counts[vehicleCountKey(id, selectedVehicle)] ?? 0), 0), [counts, positions, selectedVehicle]);
  const tableColumns = isGyuhoMode
    ? ids.flatMap((id) => vehicleCategories.map(({ key, group, label }) => ({ key: vehicleCountKey(id, key), label: `${id}번 ${key === "passenger" ? label : `${group} ${label}`}` })))
    : ids.map((id) => ({ key: String(id), label: `${id}번` }));
  const savedCurrent = Boolean(records[slot]);

  const updateActiveRecordSet = (update: (recordSet: RecordSet) => RecordSet) => {
    setLibrary((current) => ({
      ...current,
      [mode]: current[mode].map((recordSet) => recordSet.id === activeRecordId ? update(recordSet) : recordSet),
    }));
  };
  const setCurrentCounts = (next: Counts) => updateActiveRecordSet((recordSet) => ({ ...recordSet, drafts: { ...recordSet.drafts, [slot]: next } }));
  const selectSlot = (nextSlot: string) => updateActiveRecordSet((recordSet) => ({ ...recordSet, slot: nextSlot }));
  const selectRecordSet = (recordSetId: string) => {
    setActiveRecordIds((current) => ({ ...current, [mode]: recordSetId }));
    setEditingRecordName(false);
    setConfirmDeleteRecord(false);
    setExcelFile(null);
    setExcelState({ kind: "idle", message: "" });
  };
  const createRecordSet = () => {
    const nextNumber = modeRecordSets.length + 1;
    const id = `${mode}-${crypto.randomUUID()}`;
    const nextRecordSet: RecordSet = { id, name: `기록 ${nextNumber}`, records: {}, drafts: {}, slot: "00" };
    setLibrary((current) => ({ ...current, [mode]: [...current[mode], nextRecordSet] }));
    setActiveRecordIds((current) => ({ ...current, [mode]: id }));
    setEditingRecordName(false);
    setConfirmDeleteRecord(false);
    setExcelFile(null);
    setExcelState({ kind: "idle", message: "" });
  };
  const selectMode = (nextMode: Mode) => {
    setMode(nextMode);
    setEditingRecordName(false);
    setConfirmDeleteRecord(false);
    setExcelFile(null);
    setExcelState({ kind: "idle", message: "" });
  };
  const startRenamingRecord = () => {
    setRecordNameDraft(activeRecordSet.name);
    setEditingRecordName(true);
    setConfirmDeleteRecord(false);
  };
  const saveRecordName = () => {
    const nextName = recordNameDraft.trim();
    if (!nextName) return;
    updateActiveRecordSet((recordSet) => ({ ...recordSet, name: nextName }));
    setEditingRecordName(false);
  };
  const requestDeleteRecord = () => {
    setEditingRecordName(false);
    setConfirmDeleteRecord(true);
  };
  const deleteRecordSet = () => {
    if (modeRecordSets.length === 1) {
      const replacementId = `${mode}-${crypto.randomUUID()}`;
      const replacement: RecordSet = { id: replacementId, name: "기록 1", records: {}, drafts: {}, slot: "00" };
      setLibrary((current) => ({ ...current, [mode]: [replacement] }));
      setActiveRecordIds((current) => ({ ...current, [mode]: replacementId }));
    } else {
      const currentIndex = modeRecordSets.findIndex((recordSet) => recordSet.id === activeRecordId);
      const nextRecordSet = modeRecordSets[currentIndex > 0 ? currentIndex - 1 : 1];
      setLibrary((current) => ({ ...current, [mode]: current[mode].filter((recordSet) => recordSet.id !== activeRecordId) }));
      setActiveRecordIds((current) => ({ ...current, [mode]: nextRecordSet.id }));
    }
    setConfirmDeleteRecord(false);
    setExcelFile(null);
    setExcelState({ kind: "idle", message: "" });
  };
  const playSound = (force = false, direction: 1 | -1 = 1, selectedSound: SoundName = soundName) => {
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
    if (selectedSound === "click") {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(760 * pitch, now);
      oscillator.frequency.exponentialRampToValueAtTime(420 * pitch, now + 0.045);
      gain.gain.setValueAtTime(0.55 * (volume / 100), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      oscillator.start(now); oscillator.stop(now + 0.06);
    } else if (selectedSound === "clack") {
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
    const countKey = isGyuhoMode ? vehicleCountKey(id, selectedVehicle) : String(id);
    if (amount < 0 && (counts[countKey] ?? 0) === 0) return;
    const configuredSound = counterSounds[mode][id] ?? "default";
    playSound(false, amount < 0 ? -1 : 1, configuredSound === "default" ? soundName : configuredSound);
    updateActiveRecordSet((recordSet) => {
      const base = recordSet.drafts[slot] ?? recordSet.records[slot] ?? emptyCounts();
      return { ...recordSet, drafts: { ...recordSet.drafts, [slot]: { ...base, [countKey]: Math.max(0, (base[countKey] ?? 0) + amount) } } };
    });
  };

  const saveAndNext = () => {
    updateActiveRecordSet((recordSet) => {
      const next = { ...recordSet.drafts };
      delete next[slot];
      return {
        ...recordSet,
        records: { ...recordSet.records, [slot]: counts },
        drafts: next,
        slot: pad((Number(slot) + 1) % 96),
      };
    });
  };

  const resetDraft = () => {
    setCurrentCounts(emptyCounts());
    setConfirmReset(false);
  };

  const tableText = (separator = "\t", savedOnly = false, hourlySpacing = false) => {
    const header = ["시간", ...tableColumns.map(({ label }) => label), "합계"];
    const sourceSlots = savedOnly ? slots.filter(({ key: rowSlot }) => Boolean(records[rowSlot])) : slots;
    const rows: Array<Array<string | number>> = [];
    sourceSlots.forEach(({ key: rowSlot, label }, index) => {
      const previousSlot = sourceSlots[index - 1];
      if (hourlySpacing && previousSlot && Math.floor(Number(previousSlot.key) / 4) !== Math.floor(Number(rowSlot) / 4)) {
        rows.push(Array(header.length).fill(""));
      }
      const row = records[rowSlot] ?? emptyCounts();
      const values = tableColumns.map(({ key }) => row[key] ?? 0);
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
    link.download = `차량카운트_${modeFileName(mode)}_${safeRecordName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fillExcelTemplate = async () => {
    const savedSlots = Object.entries(records);
    if (isGyuhoMode) {
      setExcelState({ kind: "error", message: "규호 모드의 차량 분류 기록은 표 복사 또는 CSV 다운로드를 이용해 주세요." });
      return;
    }
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

        worksheetDocument.querySelectorAll("c").forEach((cell) => {
          const hasFormula = Array.from(cell.children).some((child) => child.tagName.endsWith("f"));
          if (!hasFormula) return;
          Array.from(cell.children).forEach((child) => {
            if (child.tagName.endsWith("v")) child.remove();
          });
        });

        zip.file(worksheetPath, new XMLSerializer().serializeToString(worksheetDocument));
      }

      if (!matchedTemplate || filledCells === 0) throw new Error("동연사거리 양식의 번호·시간 배치를 찾지 못했습니다.");
      const calcProperties = workbookDocument.querySelector("calcPr");
      if (calcProperties) {
        calcProperties.setAttribute("calcId", "0");
        calcProperties.setAttribute("calcMode", "auto");
        calcProperties.setAttribute("calcCompleted", "0");
        calcProperties.setAttribute("calcOnSave", "1");
        calcProperties.setAttribute("fullCalcOnLoad", "1");
        calcProperties.setAttribute("forceFullCalc", "1");
      }
      zip.file("xl/workbook.xml", new XMLSerializer().serializeToString(workbookDocument));

      relationsDocument.querySelectorAll("Relationship").forEach((relationship) => {
        if ((relationship.getAttribute("Type") ?? "").endsWith("/calcChain")) relationship.remove();
      });
      zip.file("xl/_rels/workbook.xml.rels", new XMLSerializer().serializeToString(relationsDocument));
      zip.remove("xl/calcChain.xml");

      const contentTypesFile = zip.file("[Content_Types].xml");
      if (contentTypesFile) {
        const contentTypesDocument = parseXml(await contentTypesFile.async("text"));
        contentTypesDocument.querySelectorAll("Override").forEach((override) => {
          if (override.getAttribute("PartName") === "/xl/calcChain.xml") override.remove();
        });
        zip.file("[Content_Types].xml", new XMLSerializer().serializeToString(contentTypesDocument));
      }

      const output = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(output);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${excelFile.name.replace(/\.xlsx$/i, "")}_${modeFileName(mode)}_${safeRecordName}_자동입력.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setExcelState({ kind: "success", message: `${savedSlots.length}개 시간대를 입력했습니다. 파일을 열면 합계 수식이 자동 계산됩니다.` });
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

      <section className="record-toolbar" aria-label="기록 슬롯과 시간 선택">
        <div className="time-field record-set-field"><label htmlFor="record-set">기록 슬롯 · {modeName(mode)}</label><div className="record-set-controls"><select id="record-set" value={activeRecordId} onChange={(event) => selectRecordSet(event.target.value)}>{modeRecordSets.map((recordSet) => <option key={recordSet.id} value={recordSet.id}>{recordSet.name} · {Object.keys(recordSet.records).length}/96 저장</option>)}</select><button type="button" className="rename-record" onClick={startRenamingRecord}>이름 변경</button><button type="button" className="delete-record" onClick={requestDeleteRecord}>기록 삭제</button><button type="button" className="new-record" onClick={createRecordSet}>+ 새 기록</button></div>{editingRecordName && <form className="record-rename" onSubmit={(event) => { event.preventDefault(); saveRecordName(); }}><input autoFocus maxLength={40} value={recordNameDraft} onChange={(event) => setRecordNameDraft(event.target.value)} aria-label="기록 이름" /><button type="submit" disabled={!recordNameDraft.trim()}>저장</button><button type="button" onClick={() => setEditingRecordName(false)}>취소</button></form>}{confirmDeleteRecord && <div className="record-delete-confirm" role="alert"><span><b>{activeRecordSet.name}</b>과 저장된 모든 값을 삭제할까요? 복구할 수 없습니다.</span><button type="button" onClick={() => setConfirmDeleteRecord(false)}>취소</button><button type="button" className="confirm-delete" onClick={deleteRecordSet}>삭제</button></div>}</div>
        <div className="time-field wide"><label htmlFor="record-slot">기록 시간</label><select id="record-slot" value={slot} onChange={(e) => selectSlot(e.target.value)}>{slots.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
        <span className={`save-status ${savedCurrent ? "saved" : "draft"}`}>{savedCurrent ? "저장된 구간" : "작성 중"}</span>
        <button type="button" className="sheet-open" onClick={() => setShowSheet(true)}>저장 기록 보기</button>
        <button type="button" className="settings-open" onClick={() => { setSoundConfigMode(mode); setShowSettings(true); }}>설정</button>
      </section>

      <nav className="mode-switch" aria-label="카운터 모드 선택">
        <button type="button" className={mode === "full" ? "active" : ""} aria-pressed={mode === "full"} onClick={() => selectMode("full")}><b>모드 1 · 12개</b><span>기본 배치</span></button>
        <button type="button" className={mode === "photo" ? "active" : ""} aria-pressed={mode === "photo"} onClick={() => selectMode("photo")}><b>모드 2 · 6개</b><span>2·3·4·6·7·8</span></button>
        <button type="button" className={mode === "box" ? "active" : ""} aria-pressed={mode === "box"} onClick={() => selectMode("box")}><b>모드 3 · 12개</b><span>카드 클릭 방식</span></button>
        <button type="button" className={mode === "gyuho" ? "active" : ""} aria-pressed={mode === "gyuho"} onClick={() => selectMode("gyuho")}><b>규호 모드</b><span>12방향 · 차량 분류</span></button>
      </nav>

      {isBoxMode && <div className="movement-legend" aria-label="이동 유형 색상 안내"><span className="legend-left">좌회전</span><span className="legend-straight">직진</span><span className="legend-right">우회전</span><small>카드 좌클릭 +1 · 우클릭 −1</small></div>}
      {isGyuhoMode && <section className="vehicle-selector" aria-label="차량 분류 선택"><header><div><b>차량 분류 선택</b><span>현재 <strong>{vehicleLabel(selectedVehicle)}</strong> {selectedVehicleTotal.toLocaleString()}대 집계</span></div><small>분류를 먼저 선택하고 방향 카드를 좌클릭 +1 · 우클릭 −1</small></header><div className="vehicle-options">{vehicleCategories.map(({ key, group, label }) => <button type="button" key={key} className={selectedVehicle === key ? "selected" : ""} aria-pressed={selectedVehicle === key} onClick={() => setSelectedVehicle(key)}><small>{group}</small><b>{label}</b></button>)}</div></section>}

      <section className={`counter-panel ${mode === "photo" ? "photo-layout" : "full-layout"} ${isBoxMode ? "box-mode-layout" : ""} ${isGyuhoMode ? "gyuho-layout" : ""}`} aria-label="번호별 차량 카운터">
        <div className="intersection" aria-hidden="true"><div className="road vertical-road" /><div className="road horizontal-road" /><div className="center-mark"><span>{slots[Number(slot)].label}</span><b>TOTAL</b><strong>{total}</strong></div></div>
        {positions.map(({ id, area }) => { const movement = movementOf(id); const countValue = isGyuhoMode ? counts[vehicleCountKey(id, selectedVehicle)] ?? 0 : counts[id] ?? 0; return (
          <article className={`counter counter-${area} ${usesCardControls ? "click-counter" : ""} ${isBoxMode ? `box-counter movement-${movement}` : ""} ${isGyuhoMode ? "gyuho-counter" : ""}`} key={`${mode}-${id}`} role={usesCardControls ? "button" : undefined} tabIndex={usesCardControls ? 0 : undefined} aria-label={usesCardControls ? `${id}번${isBoxMode ? ` ${movementName(movement)}` : isGyuhoMode ? ` ${vehicleLabel(selectedVehicle)}` : ""}, 좌클릭 추가, 우클릭 빼기, 현재 ${countValue}대` : undefined} onClick={usesCardControls ? () => changeCount(id, 1) : undefined} onContextMenu={usesCardControls ? (event) => { event.preventDefault(); changeCount(id, -1); } : undefined} onKeyDown={usesCardControls ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); changeCount(id, 1); } } : undefined}><span className="number-badge">{id}</span><output aria-label={`${id}번 현재 ${countValue}대`}>{countValue.toLocaleString()}</output>{usesCardControls ? <span className="counter-action-hint">{isBoxMode ? movementName(movement) : isGyuhoMode ? `${vehicleLabel(selectedVehicle)} · 좌 +1 · 우 −1` : "좌 +1 · 우 −1"}</span> : <div className="controls"><button type="button" className="minus" onClick={() => changeCount(id, -1)} disabled={countValue === 0} aria-label={`${id}번 1대 빼기`}>−</button><button type="button" className="plus" onClick={() => changeCount(id, 1)} aria-label={`${id}번 1대 추가`}>+</button></div>}</article>
        ); })}
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
            <header><div><h2>{activeRecordSet.name} 저장 기록</h2><p>{modeName(mode)} · {Object.keys(records).length}/96 구간 저장 · 자정 이후에도 계속 이어집니다</p></div><div className="sheet-actions"><button type="button" onClick={copyTable}>{copyState}</button><button type="button" onClick={downloadCsv}>CSV 다운로드</button><button type="button" className="close-modal" onClick={() => setShowSheet(false)} aria-label="닫기">×</button></div></header>
            {!isGyuhoMode ? <div className="excel-import">
              <div><b>엑셀 자동 입력</b><p>저장된 번호별 차량 수를 같은 15분 시간대의 소계 칸에 넣습니다. 원본 서식과 다른 값은 그대로 유지됩니다.</p></div>
              <label className="excel-file"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setExcelFile(event.target.files?.[0] ?? null); setExcelState({ kind: "idle", message: "" }); }} /><span>{excelFile ? excelFile.name : "엑셀 파일 선택"}</span></label>
              <button type="button" className="excel-fill" disabled={excelState.kind === "working"} onClick={fillExcelTemplate}>{excelState.kind === "working" ? "입력 중…" : "기록 입력 후 다운로드"}</button>
              {excelState.message && <p className={`excel-message ${excelState.kind}`} role="status">{excelState.message}</p>}
            </div> : <div className="gyuho-export-note"><b>차량 분류 기록 내보내기</b><p>규호 모드는 방향별 6개 차량 분류를 표 복사 또는 CSV 다운로드로 내보냅니다.</p></div>}
            <div className="table-wrap"><table><thead><tr><th>시간</th>{tableColumns.map(({ key, label }) => <th key={key}>{label}</th>)}<th>합계</th></tr></thead><tbody>{slots.map(({ key: rowSlot, label }) => { const row = records[rowSlot]; const values = tableColumns.map(({ key }) => row?.[key] ?? 0); const sum = values.reduce((a, b) => a + b, 0); return <tr className={row ? "has-data" : ""} key={rowSlot}><th>{label}</th>{values.map((value, index) => <td key={tableColumns[index].key}>{value}</td>)}<td className="row-total">{sum}</td></tr>; })}</tbody></table></div>
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
              <fieldset><legend>모드 1·2 조작 방식</legend><div className="input-style-options"><button type="button" className={inputStyle === "card" ? "selected" : ""} onClick={() => setInputStyle("card")}><b>카드 클릭</b><small>좌클릭 +1 · 우클릭 −1</small></button><button type="button" className={inputStyle === "buttons" ? "selected" : ""} onClick={() => setInputStyle("buttons")}><b>− / + 버튼</b><small>모바일에서 편리한 방식</small></button></div><p className="input-style-note">모드 3과 규호 모드는 항상 카드 클릭 방식으로 작동합니다.</p></fieldset>
              <fieldset><legend>버튼 소리</legend><label className="sound-toggle"><span><b>소리 사용</b><small>− / + 버튼을 누를 때 재생</small></span><input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} /><i /></label>
                <div className="sound-options">{soundNames.map((name) => <button type="button" key={name} disabled={!soundOn} className={soundName === name ? "selected" : ""} onClick={() => setSoundName(name)}>{soundLabel(name)}</button>)}</div>
                <label className={`volume-control ${!soundOn ? "disabled" : ""}`}><span><b>볼륨</b><output>{volume}%</output></span><input type="range" min="0" max="100" step="5" value={volume} disabled={!soundOn} onChange={(e) => setVolume(Number(e.target.value))} aria-label="버튼 소리 볼륨" /></label>
                <button type="button" className="sound-preview" disabled={!soundOn} onClick={() => playSound(true)}>소리 미리 듣기</button>
                <div className={`counter-sound-settings ${!soundOn ? "disabled" : ""}`}><div className="counter-sound-heading"><b>번호별 소리</b><small>기본 소리와 다르게 들릴 번호만 변경하세요</small></div><div className="sound-mode-switch">{(["full", "photo", "box", "gyuho"] as Mode[]).map((soundMode) => <button type="button" key={soundMode} disabled={!soundOn} className={soundConfigMode === soundMode ? "selected" : ""} onClick={() => setSoundConfigMode(soundMode)}>{modeName(soundMode)}</button>)}</div><div className="counter-sound-grid">{counterIdsByMode[soundConfigMode].map((id) => <label key={`${soundConfigMode}-${id}`}><b>{id}번</b><select disabled={!soundOn} value={counterSounds[soundConfigMode][id]} onChange={(event) => { const nextSound = event.target.value as CounterSound; setCounterSounds((current) => ({ ...current, [soundConfigMode]: { ...current[soundConfigMode], [id]: nextSound } })); playSound(true, 1, nextSound === "default" ? soundName : nextSound); }} aria-label={`${modeName(soundConfigMode)} ${id}번 소리`}><option value="default">기본 · {soundLabel(soundName)}</option>{soundNames.map((name) => <option key={name} value={name}>{soundLabel(name)}</option>)}</select></label>)}</div></div>
              </fieldset>
            </div>
            <footer><button type="button" onClick={() => setShowSettings(false)}>완료</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
