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

const emptyCounts = (): Counts =>
  Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, 0])) as Counts;

export default function Home() {
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [mode, setMode] = useState<Mode>("full");
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("intersection-mode-counts-v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCounts({ ...emptyCounts(), ...parsed.counts });
        setMode(parsed.mode === "photo" ? "photo" : "full");
      } else {
        const laneData = localStorage.getItem("intersection-lane-counts-v2");
        const oldData = localStorage.getItem("intersection-counts");
        if (laneData) {
          const parsed = JSON.parse(laneData);
          const migrated = emptyCounts();
          for (let id = 1; id <= 12; id += 1) {
            const values: number[] = parsed.laneCounts?.[id] ?? [];
            const visible = parsed.laneSettings?.[id] ?? 1;
            migrated[id] = values.slice(0, visible).reduce((sum, value) => sum + value, 0);
          }
          setCounts(migrated);
        } else if (oldData) {
          setCounts({ ...emptyCounts(), ...JSON.parse(oldData) });
        }
      }
    } catch {
      // Start fresh if saved browser data cannot be read.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      localStorage.setItem("intersection-mode-counts-v3", JSON.stringify({ counts, mode }));
    }
  }, [counts, mode, ready]);

  const positions = mode === "full" ? fullMode : photoMode;
  const total = useMemo(
    () => positions.reduce((sum, { id }) => sum + counts[id], 0),
    [counts, positions],
  );

  const changeCount = (id: number, amount: number) => {
    setCounts((current) => ({ ...current, [id]: Math.max(0, current[id] + amount) }));
  };

  const resetVisible = () => {
    const visibleIds = new Set<number>(positions.map(({ id }) => id));
    setCounts((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, value]) => [id, visibleIds.has(Number(id)) ? 0 : value]),
      ) as Counts,
    );
    setConfirmReset(false);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow"><span className="live-dot" />현장 집계 중</p>
          <h1>교차로 차량 카운터</h1>
        </div>
        <div className="total-card" aria-live="polite">
          <span>현재 모드 합계</span>
          <strong>{total.toLocaleString()}</strong>
          <small>대</small>
        </div>
      </header>

      <nav className="mode-switch" aria-label="카운터 모드 선택">
        <button
          type="button"
          className={mode === "full" ? "active" : ""}
          aria-pressed={mode === "full"}
          onClick={() => setMode("full")}
        >
          <b>12개 모드</b>
          <span>1–12 전체</span>
        </button>
        <button
          type="button"
          className={mode === "photo" ? "active" : ""}
          aria-pressed={mode === "photo"}
          onClick={() => setMode("photo")}
        >
          <b>6개 모드</b>
          <span>2·3·4·6·7·8</span>
        </button>
      </nav>

      <section className={`counter-panel ${mode === "photo" ? "photo-layout" : "full-layout"}`} aria-label="번호별 차량 카운터">
        <div className="intersection" aria-hidden="true">
          <div className="road vertical-road" />
          <div className="road horizontal-road" />
          <div className="center-mark">
            <span>교차로</span>
            <b>TOTAL</b>
            <strong>{total}</strong>
          </div>
        </div>

        {positions.map(({ id, area }) => (
          <article className={`counter counter-${area}`} key={`${mode}-${id}`}>
            <span className="number-badge">{id}</span>
            <output aria-label={`${id}번 현재 ${counts[id]}대`}>{counts[id].toLocaleString()}</output>
            <div className="controls">
              <button type="button" className="minus" onClick={() => changeCount(id, -1)} disabled={counts[id] === 0} aria-label={`${id}번 1대 빼기`}>−</button>
              <button type="button" className="plus" onClick={() => changeCount(id, 1)} aria-label={`${id}번 1대 추가`}>+</button>
            </div>
          </article>
        ))}
      </section>

      <footer className="footer-bar">
        <p><span>●</span> 모드와 값은 이 기기에 자동 저장됩니다</p>
        {!confirmReset ? (
          <button type="button" className="reset-button" onClick={() => setConfirmReset(true)}>현재 모드 초기화</button>
        ) : (
          <div className="reset-confirm" role="group" aria-label="현재 모드 초기화 확인">
            <span>현재 모드 값을 지울까요?</span>
            <button type="button" onClick={() => setConfirmReset(false)}>취소</button>
            <button type="button" className="danger" onClick={resetVisible}>초기화</button>
          </div>
        )}
      </footer>
    </main>
  );
}
