"use client";

import { useEffect, useMemo, useState } from "react";

const positions = [
  { id: 9, area: "n1", direction: "남동 방향" },
  { id: 8, area: "n2", direction: "남쪽 방향" },
  { id: 7, area: "n3", direction: "남서 방향" },
  { id: 10, area: "w1", direction: "동북 방향" },
  { id: 11, area: "w2", direction: "동쪽 방향" },
  { id: 12, area: "w3", direction: "동남 방향" },
  { id: 6, area: "e1", direction: "서남 방향" },
  { id: 5, area: "e2", direction: "서쪽 방향" },
  { id: 4, area: "e3", direction: "서북 방향" },
  { id: 1, area: "s1", direction: "북동 방향" },
  { id: 2, area: "s2", direction: "북쪽 방향" },
  { id: 3, area: "s3", direction: "북서 방향" },
] as const;

type Counts = Record<number, number>;

const emptyCounts = (): Counts =>
  Object.fromEntries(positions.map(({ id }) => [id, 0])) as Counts;

export default function Home() {
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("intersection-counts");
      if (saved) setCounts({ ...emptyCounts(), ...JSON.parse(saved) });
    } catch {
      // Use fresh values when saved browser data cannot be read.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("intersection-counts", JSON.stringify(counts));
  }, [counts, ready]);

  const total = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts],
  );

  const changeCount = (id: number, amount: number) => {
    setCounts((current) => ({
      ...current,
      [id]: Math.max(0, current[id] + amount),
    }));
  };

  const resetAll = () => {
    setCounts(emptyCounts());
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
          <span>전체 통과</span>
          <strong>{total.toLocaleString()}</strong>
          <small>대</small>
        </div>
      </header>

      <section className="counter-panel" aria-label="방향별 차량 카운터">
        <div className="intersection" aria-hidden="true">
          <div className="road vertical-road" />
          <div className="road horizontal-road" />
          <div className="center-mark">
            <span>교차로</span>
            <b>TOTAL</b>
            <strong>{total}</strong>
          </div>
        </div>

        {positions.map(({ id, area, direction }) => (
          <article className={`counter counter-${area}`} key={id}>
            <div className="counter-heading">
              <span className="number-badge">{id}</span>
              <span className="direction-label">{direction}</span>
            </div>
            <output aria-label={`${id}번 현재 ${counts[id]}대`}>
              {counts[id].toLocaleString()}
            </output>
            <div className="controls">
              <button
                type="button"
                className="minus"
                onClick={() => changeCount(id, -1)}
                disabled={counts[id] === 0}
                aria-label={`${id}번 차량 1대 빼기`}
              >
                −
              </button>
              <button
                type="button"
                className="plus"
                onClick={() => changeCount(id, 1)}
                aria-label={`${id}번 차량 1대 추가`}
              >
                +
              </button>
            </div>
          </article>
        ))}
      </section>

      <footer className="footer-bar">
        <p><span>●</span> 값은 이 기기에 자동 저장됩니다</p>
        {!confirmReset ? (
          <button type="button" className="reset-button" onClick={() => setConfirmReset(true)}>
            전체 초기화
          </button>
        ) : (
          <div className="reset-confirm" role="group" aria-label="전체 초기화 확인">
            <span>정말 지울까요?</span>
            <button type="button" onClick={() => setConfirmReset(false)}>취소</button>
            <button type="button" className="danger" onClick={resetAll}>초기화</button>
          </div>
        )}
      </footer>
    </main>
  );
}
