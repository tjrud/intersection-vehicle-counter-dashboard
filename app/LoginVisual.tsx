"use client";

import Image from "next/image";

export default function LoginVisual() {
  function moveGlow(event: React.PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--glow-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--glow-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <aside className="login-visual login-visual-photo" onPointerMove={moveGlow}>
      <Image src="/intersection-dashboard-hero.png" alt="교차로 차량 조사 대시보드 소개" fill priority sizes="54vw" />
      <span className="login-pointer-glow" aria-hidden="true" />
      <div className="intersection-scanner" aria-hidden="true"><i /><i /><i /></div>
      <span className="scan-line" aria-hidden="true" />
      <div className="hero-traffic-layer" aria-hidden="true">
        <i className="hero-car hero-car-east"><span /></i>
        <i className="hero-car hero-car-west"><span /></i>
        <i className="hero-car hero-car-north"><span /></i>
        <i className="hero-car hero-car-south"><span /></i>
        <em className="telemetry-node telemetry-a">VEH · 04 <b>TRACKED</b></em>
        <em className="telemetry-node telemetry-b">FLOW · 92% <b>LIVE</b></em>
      </div>
    </aside>
  );
}
