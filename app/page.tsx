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

type LaneCounts = Record<number, number[]>;
type LaneSettings = Record<number, number>;
type ActiveLanes = Record<number, number>;

const makeRecord = <T,>(factory: () => T) =>
  Object.fromEntries(positions.map(({ id }) => [id, factory()])) as Record<number, T>;

const emptyLaneCounts = (): LaneCounts => makeRecord(() => [0, 0, 0, 0, 0, 0]);
const defaultLaneSettings = (): LaneSettings => makeRecord(() => 1);
const defaultActiveLanes = (): ActiveLanes => makeRecord(() => 0);

export default function Home() {
  const [laneCounts, setLaneCounts] = useState<LaneCounts>(emptyLaneCounts);
  const [laneSettings, setLaneSettings] = useState<LaneSettings>(defaultLaneSettings);
  const [activeLanes, setActiveLanes] = useState<ActiveLanes>(defaultActiveLanes);
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      const savedV2 = localStorage.getItem("intersection-lane-counts-v2");
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        setLaneCounts({ ...emptyLaneCounts(), ...parsed.laneCounts });
        setLaneSettings({ ...defaultLaneSettings(), ...parsed.laneSettings });
      } else {
        const oldCounts = localStorage.getItem("intersection-counts");
        if (oldCounts) {
          const parsed = JSON.parse(oldCounts) as Record<number, number>;
          setLaneCounts(
            Object.fromEntries(
              positions.map(({ id }) => [id, [parsed[id] ?? 0, 0, 0, 0, 0, 0]]),
            ) as LaneCounts,
          );
        }
      }
    } catch {
      // Start with fresh values if saved browser data is unavailable.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      localStorage.setItem(
        "intersection-lane-counts-v2",
        JSON.stringify({ laneCounts, laneSettings }),
      );
    }
  }, [laneCounts, laneSettings, ready]);

  const directionTotal = (id: number) =>
    laneCounts[id].slice(0, laneSettings[id]).reduce((sum, count) => sum + count, 0);

  const total = useMemo(
    () => positions.reduce((sum, { id }) => sum + directionTotal(id), 0),
    [laneCounts, laneSettings],
  );

  const changeCount = (id: number, amount: number) => {
    const lane = activeLanes[id];
    setLaneCounts((current) => ({
      ...current,
      [id]: current[id].map((count, index) =>
        index === lane ? Math.max(0, count + amount) : count,
      ),
    }));
  };

  const changeLaneCount = (id: number, count: number) => {
    setLaneSettings((current) => ({ ...current, [id]: count }));
    setActiveLanes((current) => ({ ...current, [id]: Math.min(current[id], count - 1) }));
  };

  const resetAll = () => {
    setLaneCounts(emptyLaneCounts());
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

      <div className="lane-guide">
        <span className="guide-icon">i</span>
        번호별 <strong>차선 수</strong>를 정한 뒤, 집계할 차선을 눌러 선택하세요.
      </div>

      <section className="counter-panel" aria-label="방향과 차선별 차량 카운터">
        <div className="intersection" aria-hidden="true">
          <div className="road vertical-road" />
          <div className="road horizontal-road" />
          <div className="center-mark">
            <span>교차로</span>
            <b>TOTAL</b>
            <strong>{total}</strong>
          </div>
        </div>

        {positions.map(({ id, area, direction }) => {
          const activeLane = activeLanes[id];
          const lanes = laneCounts[id];
          return (
            <article className={`counter counter-${area}`} key={id}>
              <div className="counter-heading">
                <span className="number-badge">{id}</span>
                <span className="direction-label">{direction}</span>
                <label className="lane-count-select">
                  <span>차선 수</span>
                  <select
                    value={laneSettings[id]}
                    onChange={(event) => changeLaneCount(id, Number(event.target.value))}
                    aria-label={`${id}번 차선 수`}
                  >
                    {[1, 2, 3, 4, 5, 6].map((count) => (
                      <option value={count} key={count}>{count}개</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="lane-tabs" role="tablist" aria-label={`${id}번 집계 차선 선택`}>
                {lanes.slice(0, laneSettings[id]).map((count, index) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeLane === index}
                    className={activeLane === index ? "active" : ""}
                    onClick={() => setActiveLanes((current) => ({ ...current, [id]: index }))}
                    key={index}
                  >
                    <span>{index + 1}차선</span>
                    <b>{count}</b>
                  </button>
                ))}
              </div>

              <div className="count-row">
                <div className="count-readout">
                  <small>{activeLane + 1}차선</small>
                  <output aria-label={`${id}번 ${activeLane + 1}차선 현재 ${lanes[activeLane]}대`}>
                    {lanes[activeLane].toLocaleString()}
                  </output>
                  {laneSettings[id] > 1 && <em>합계 {directionTotal(id)}</em>}
                </div>
                <div className="controls">
                  <button
                    type="button"
                    className="minus"
                    onClick={() => changeCount(id, -1)}
                    disabled={lanes[activeLane] === 0}
                    aria-label={`${id}번 ${activeLane + 1}차선 차량 1대 빼기`}
                  >−</button>
                  <button
                    type="button"
                    className="plus"
                    onClick={() => changeCount(id, 1)}
                    aria-label={`${id}번 ${activeLane + 1}차선 차량 1대 추가`}
                  >+</button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="footer-bar">
        <p><span>●</span> 차선 설정과 값은 이 기기에 자동 저장됩니다</p>
        {!confirmReset ? (
          <button type="button" className="reset-button" onClick={() => setConfirmReset(true)}>
            전체 초기화
          </button>
        ) : (
          <div className="reset-confirm" role="group" aria-label="전체 초기화 확인">
            <span>모든 차선 값을 지울까요?</span>
            <button type="button" onClick={() => setConfirmReset(false)}>취소</button>
            <button type="button" className="danger" onClick={resetAll}>초기화</button>
          </div>
        )}
      </footer>
    </main>
  );
}
