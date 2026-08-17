"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Connection = "idle" | "checking" | "ready" | "error";
type JobStatus = "idle" | "queued" | "running" | "stopping" | "completed" | "stopped" | "failed";
type SummaryRow = { time: string; inbound: number; outbound: number; total: number };
type LocalJob = {
  id?: string;
  status: JobStatus;
  progress: number;
  message?: string;
  logs?: string[];
  summary?: SummaryRow[];
  summaryPath?: string;
  eventsPath?: string;
};

const DEFAULT_AGENT_URL = "http://127.0.0.1:8765";

export default function AiAnalysisWorkspace() {
  const [agentUrl, setAgentUrl] = useState(DEFAULT_AGENT_URL);
  const [token, setToken] = useState("");
  const [connection, setConnection] = useState<Connection>("idle");
  const [connectionMessage, setConnectionMessage] = useState("로컬 실행기를 먼저 실행해 주세요.");
  const [sourceDir, setSourceDir] = useState("");
  const [outputDir, setOutputDir] = useState("results");
  const [model, setModel] = useState("yolo26l.pt");
  const [device, setDevice] = useState("0");
  const [confidence, setConfidence] = useState("0.22");
  const [testMode, setTestMode] = useState(false);
  const [saveEventImages, setSaveEventImages] = useState(true);
  const [saveReviewVideo, setSaveReviewVideo] = useState(false);
  const [job, setJob] = useState<LocalJob>({ status: "idle", progress: 0 });
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setAgentUrl(localStorage.getItem("ic-local-agent-url") || DEFAULT_AGENT_URL);
        setToken(localStorage.getItem("ic-local-agent-token") || "");
        setSourceDir(localStorage.getItem("ic-ai-source-dir") || "");
        setOutputDir(localStorage.getItem("ic-ai-output-dir") || "results");
      } catch {
        // 브라우저 저장소를 사용할 수 없는 환경에서는 기본값을 사용합니다.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${agentUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-IC-Token": token.trim(), ...(init.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || body.message || `로컬 실행기 오류 (${response.status})`);
    return body;
  }, [agentUrl, token]);

  const connect = async () => {
    setConnection("checking");
    setActionError("");
    try {
      const health = await request("/health");
      const current = await request("/jobs/current");
      setConnection("ready");
      setConnectionMessage(`${health.app || "IC Local AI"} ${health.version || ""} · ${health.device || "로컬 장치"}`);
      if (current?.job) setJob(current.job);
      localStorage.setItem("ic-local-agent-url", agentUrl);
      localStorage.setItem("ic-local-agent-token", token);
    } catch (error) {
      setConnection("error");
      setConnectionMessage(error instanceof Error ? error.message : "로컬 실행기에 연결할 수 없습니다.");
    }
  };

  useEffect(() => {
    if (!job.id || !["queued", "running", "stopping"].includes(job.status) || connection !== "ready") return;
    const timer = window.setInterval(async () => {
      try {
        const next = await request(`/jobs/${job.id}`);
        setJob(next.job ?? next);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "진행 상태를 불러오지 못했습니다.");
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job.id, job.status, connection, request]);

  const startAnalysis = async () => {
    setActionError("");
    if (!sourceDir.trim()) {
      setActionError("전처리 영상이 들어 있는 로컬 폴더 경로를 입력해 주세요.");
      return;
    }
    try {
      localStorage.setItem("ic-ai-source-dir", sourceDir);
      localStorage.setItem("ic-ai-output-dir", outputDir);
      const result = await request("/jobs", {
        method: "POST",
        body: JSON.stringify({
          sourceDir: sourceDir.trim(), outputDir: outputDir.trim() || "results", model, device,
          confidence: Number(confidence), testMode, saveEventImages, saveReviewVideo,
        }),
      });
      setJob(result.job ?? result);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "분석을 시작하지 못했습니다.");
    }
  };

  const stopAnalysis = async () => {
    if (!job.id) return;
    setActionError("");
    try {
      const result = await request(`/jobs/${job.id}/stop`, { method: "POST" });
      setJob(result.job ?? result);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "분석 중지 요청에 실패했습니다.");
    }
  };

  const openResults = async () => {
    try {
      await request("/open-results", { method: "POST", body: JSON.stringify({ outputDir }) });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "결과 폴더를 열지 못했습니다.");
    }
  };

  const progress = Math.max(0, Math.min(100, Number(job.progress || 0)));
  const isRunning = ["queued", "running", "stopping"].includes(job.status);
  const statusLabel: Record<JobStatus, string> = {
    idle: "대기", queued: "준비 중", running: "분석 중", stopping: "중지 중",
    completed: "완료", stopped: "중지됨", failed: "오류",
  };
  const totals = useMemo(() => (job.summary || []).reduce((sum, row) => ({
    inbound: sum.inbound + Number(row.inbound || 0), outbound: sum.outbound + Number(row.outbound || 0), total: sum.total + Number(row.total || 0),
  }), { inbound: 0, outbound: 0, total: 0 }), [job.summary]);

  return <section className="ai-workspace">
    <header className="ai-heading">
      <div><p>LOCAL VISION ANALYSIS</p><h1>AI 차량 분석</h1><span>영상은 외부로 전송하지 않고 이 컴퓨터의 GPU에서 처리됩니다.</span></div>
      <div className={`agent-status ${connection}`}><i /><div><small>로컬 실행기</small><b>{connection === "ready" ? "연결됨" : connection === "checking" ? "확인 중" : "연결 필요"}</b></div></div>
    </header>

    <div className="ai-layout">
      <div className="ai-main-column">
        <section className="ai-card agent-connect-card">
          <header><div><small>STEP 01</small><b>로컬 실행기 연결</b><span>{connectionMessage}</span></div><button type="button" onClick={connect} disabled={connection === "checking"}>{connection === "ready" ? "다시 확인" : "연결 확인"}</button></header>
          <div className="agent-fields"><label><span>실행기 주소</span><input value={agentUrl} onChange={(event) => setAgentUrl(event.target.value)} spellCheck={false} /></label><label><span>연결 토큰</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="실행기 창에 표시된 토큰" /></label></div>
        </section>

        <section className="ai-card analysis-config-card">
          <header><div><small>STEP 02</small><b>분석 설정</b><span>전처리된 영상 폴더와 분석 방식을 선택하세요.</span></div></header>
          <div className="path-fields"><label><span>전처리 영상 폴더</span><input value={sourceDir} onChange={(event) => setSourceDir(event.target.value)} placeholder="예: D:\health_center\encoded" disabled={isRunning} /></label><label><span>결과 저장 폴더</span><input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} placeholder="results 또는 절대 경로" disabled={isRunning} /></label></div>
          <div className="analysis-options"><label><span>YOLO 모델</span><select value={model} onChange={(event) => setModel(event.target.value)} disabled={isRunning}><option value="yolo26l.pt">YOLO26-L · 정확도 우선</option><option value="yolo26s.pt">YOLO26-S · 균형</option><option value="yolo26n.pt">YOLO26-N · 속도 우선</option></select></label><label><span>처리 장치</span><select value={device} onChange={(event) => setDevice(event.target.value)} disabled={isRunning}><option value="0">NVIDIA GPU</option><option value="cpu">CPU</option></select></label><label><span>검출 신뢰도</span><input type="number" min="0.05" max="0.95" step="0.01" value={confidence} onChange={(event) => setConfidence(event.target.value)} disabled={isRunning} /></label></div>
          <div className="analysis-toggles"><label><input type="checkbox" checked={testMode} onChange={(event) => setTestMode(event.target.checked)} disabled={isRunning} /><span><b>5분 시험 분석</b><small>전체 실행 전 방향과 정확도를 빠르게 확인</small></span></label><label><input type="checkbox" checked={saveEventImages} onChange={(event) => setSaveEventImages(event.target.checked)} disabled={isRunning} /><span><b>통과 이미지 저장</b><small>집계된 차량의 근거 이미지 보관</small></span></label><label><input type="checkbox" checked={saveReviewVideo} onChange={(event) => setSaveReviewVideo(event.target.checked)} disabled={isRunning} /><span><b>검수 영상 저장</b><small>표시선과 추적 결과가 포함된 영상 생성</small></span></label></div>
        </section>

        <section className="ai-card analysis-run-card">
          <header><div><small>STEP 03</small><b>분석 실행</b><span>{job.message || (connection === "ready" ? "설정을 확인한 뒤 분석을 시작하세요." : "로컬 실행기 연결 후 사용할 수 있습니다.")}</span></div><strong className={`job-pill ${job.status}`}>{statusLabel[job.status]}</strong></header>
          <div className="analysis-progress"><div><i style={{ width: `${progress}%` }} /></div><b>{progress.toFixed(progress < 10 ? 1 : 0)}%</b></div>
          <div className="analysis-actions"><button type="button" className="start-analysis" onClick={startAnalysis} disabled={connection !== "ready" || isRunning}>▶ {testMode ? "5분 시험 분석 시작" : "전체 분석 시작"}</button><button type="button" className="stop-analysis" onClick={stopAnalysis} disabled={!isRunning}>분석 중지</button><button type="button" onClick={openResults} disabled={connection !== "ready"}>결과 폴더 열기</button></div>
          {actionError && <p className="ai-action-error">{actionError}</p>}
          <div className="analysis-log" aria-live="polite">{job.logs?.length ? job.logs.slice(-8).map((line, index) => <p key={`${index}-${line}`}><time>{String(index + 1).padStart(2, "0")}</time><span>{line}</span></p>) : <p className="empty"><span>분석을 시작하면 모델 준비, 영상 처리, 차량 집계 로그가 표시됩니다.</span></p>}</div>
        </section>
      </div>

      <aside className="ai-side-column">
        <section className="ai-result-card"><header><small>15분 집계 결과</small><b>{job.summary?.length ? `${job.summary.length}개 구간` : "분석 대기"}</b></header><div className="ai-result-totals"><article><span>유입</span><b>{totals.inbound.toLocaleString()}</b><small>IN</small></article><article><span>유출</span><b>{totals.outbound.toLocaleString()}</b><small>OUT</small></article><article><span>합계</span><b>{totals.total.toLocaleString()}</b><small>TOTAL</small></article></div><div className="ai-summary-list">{job.summary?.length ? job.summary.slice(-8).reverse().map((row) => <div key={row.time}><time>{row.time}</time><span>{row.inbound}</span><span>{row.outbound}</span><b>{row.total}</b></div>) : <p>완료된 구간이 여기에 순서대로 표시됩니다.</p>}</div></section>

        <section className="local-guide-card"><header><small>처음 사용하는 컴퓨터</small><b>로컬 실행 방법</b></header><ol><li><i>1</i><div><b>프로그램 받기</b><span>GitHub에서 ZIP을 내려받아 원하는 폴더에 압축을 풉니다.</span></div></li><li><i>2</i><div><b>최초 1회 설치</b><span><code>설치.bat</code>을 실행해 AI 환경을 준비합니다.</span></div></li><li><i>3</i><div><b>로컬 실행기 시작</b><span><code>대시보드연결.bat</code>을 실행하고 표시된 토큰을 위에 입력합니다.</span></div></li><li><i>4</i><div><b>영상 폴더 입력</b><span>이 컴퓨터에 저장된 전처리 영상 폴더 경로로 분석합니다.</span></div></li></ol><a href="https://github.com/tjrud/2way_vehicle_detector/archive/refs/heads/main.zip">로컬 AI 프로그램 다운로드 <span>↓</span></a><a className="guide-repo" href="https://github.com/tjrud/2way_vehicle_detector" target="_blank" rel="noreferrer">GitHub에서 사용 설명 보기 →</a><p>Windows · Python 3.10 이상 · NVIDIA GPU 권장</p></section>
      </aside>
    </div>
  </section>;
}
