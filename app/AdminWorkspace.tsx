"use client";

type AdminSummary = {
  recordSets: number;
  savedSlots: number;
  clickLogs: number;
  vehicleTotal: number;
  storageBytes: number;
};

type Props = {
  displayName: string;
  adminId: string;
  summary: AdminSummary;
  onOpenHome: () => void;
  onOpenLive: () => void;
  onOpenCounter: () => void;
};

const compactBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function AdminWorkspace({ displayName, adminId, summary, onOpenHome, onOpenLive, onOpenCounter }: Props) {
  const modules = [
    { name: "영상 전처리", state: "정상", detail: "로컬 폴더 · FFmpeg 작업 파일" },
    { name: "실시간 영상 계수", state: "정상", detail: "카메라 · 로컬 영상 · 수동 계수" },
    { name: "차량 카운팅", state: "정상", detail: "15분 기록 · 클릭 로그 · 엑셀" },
    { name: "브라우저 저장소", state: "정상", detail: `${compactBytes(summary.storageBytes)} 사용 중` },
  ];

  return (
    <section className="admin-workspace">
      <header className="admin-hero">
        <div><p>ADMINISTRATION</p><h1>관리자 페이지</h1><span>{displayName}님, 대시보드의 운영 상태와 현재 기기 기록을 확인하세요.</span></div>
        <div className="admin-identity"><i>✓</i><div><small>관리자 인증 완료</small><b>{adminId}</b></div></div>
      </header>

      <div className="admin-metrics">
        <article><span>저장 기록</span><b>{summary.recordSets.toLocaleString()}</b><small>현재 기기의 기록 슬롯</small></article>
        <article><span>저장된 시간대</span><b>{summary.savedSlots.toLocaleString()}</b><small>15분 단위 구간</small></article>
        <article><span>누적 차량</span><b>{summary.vehicleTotal.toLocaleString()}</b><small>저장된 계수 합계</small></article>
        <article><span>클릭 로그</span><b>{summary.clickLogs.toLocaleString()}</b><small>현재 기기의 조작 이력</small></article>
      </div>

      <div className="admin-grid">
        <section className="admin-panel admin-system">
          <header><div><b>시스템 상태</b><span>주요 기능의 현재 상태입니다.</span></div><strong><i /> ALL SYSTEMS NORMAL</strong></header>
          <div>{modules.map((module) => <article key={module.name}><i>●</i><div><b>{module.name}</b><span>{module.detail}</span></div><strong>{module.state}</strong></article>)}</div>
        </section>

        <section className="admin-panel admin-access">
          <header><div><b>접근 권한</b><span>현재 로그인 세션</span></div></header>
          <dl><div><dt>권한 등급</dt><dd>최고 관리자</dd></div><div><dt>로그인 방식</dt><dd>관리자 아이디</dd></div><div><dt>관리자 페이지</dt><dd className="allowed">접근 허용</dd></div><div><dt>일반 사용자 화면</dt><dd className="allowed">접근 허용</dd></div></dl>
          <p>관리자 자격 증명은 서버 환경에서만 확인되며 화면이나 브라우저 저장소에 비밀번호가 노출되지 않습니다.</p>
        </section>

        <section className="admin-panel admin-actions">
          <header><div><b>운영 바로가기</b><span>관리자 권한으로 모든 작업 화면을 열 수 있습니다.</span></div></header>
          <div><button type="button" onClick={onOpenHome}><i>⌂</i><span><b>HOME</b><small>전체 현황으로 이동</small></span><strong>→</strong></button><button type="button" onClick={onOpenLive}><i>◉</i><span><b>실시간 영상 계수</b><small>영상 및 카메라 확인</small></span><strong>→</strong></button><button type="button" onClick={onOpenCounter}><i>＋</i><span><b>차량 카운팅</b><small>기록과 클릭 로그 관리</small></span><strong>→</strong></button></div>
        </section>

        <section className="admin-panel admin-storage">
          <header><div><b>데이터 범위</b><span>현재 저장 구조 안내</span></div></header>
          <div className="storage-ring" style={{ "--storage-progress": `${Math.min(100, summary.storageBytes / 50000)}%` } as React.CSSProperties}><b>{compactBytes(summary.storageBytes)}</b><span>LOCAL DATA</span></div>
          <p>조사 기록은 각 사용자의 브라우저에 저장됩니다. 따라서 이 화면의 통계는 현재 관리자 기기의 기록만 집계합니다.</p>
        </section>
      </div>
    </section>
  );
}
