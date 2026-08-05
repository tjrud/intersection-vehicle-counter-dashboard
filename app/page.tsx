import DashboardClient from "./DashboardClient";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { passwordAuthConfigured } from "./password-auth";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const user = await getChatGPTUser();
  const params = await searchParams;
  if (!user) {
    const usePasswordLogin = Boolean(process.env.VERCEL) || passwordAuthConfigured();
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand"><span>IC</span><div><b>Intersection Control</b><small>교차로 차량 조사 대시보드</small></div></div>
          <div className="login-copy"><p>TRAFFIC OPERATIONS</p><h1>현장 조사부터 영상 전처리,<br />차량 카운팅까지 한 곳에서.</h1><span>작업 기록 보호를 위해 로그인 후 대시보드를 이용할 수 있습니다.</span></div>
          {usePasswordLogin ? <form className="vercel-login" action="/api/auth/login" method="post"><label><span>이메일</span><input name="email" type="email" autoComplete="username" required /></label><label><span>비밀번호</span><input name="password" type="password" autoComplete="current-password" required /></label>{params.auth_error === "invalid" && <p>이메일 또는 비밀번호가 올바르지 않습니다.</p>}<button type="submit"><b>대시보드 로그인</b><span>→</span></button></form> : <a className="chatgpt-login" href={chatGPTSignInPath("/")}><b>ChatGPT로 로그인</b><span>→</span></a>}
          <small className="login-note">로그인 정보는 사용자 확인과 화면 표시에만 사용됩니다.</small>
        </section>
        <aside className="login-visual" aria-hidden="true"><div className="road-grid" /><div className="login-stat stat-a"><span>15분 집계</span><b>96</b><small>TIME SLOTS</small></div><div className="login-stat stat-b"><span>작업 흐름</span><b>03</b><small>PREP · COUNT · EXPORT</small></div></aside>
      </main>
    );
  }
  const authProvider = user.userId.startsWith("vercel:") ? "password" : "chatgpt";
  return <DashboardClient user={{ displayName: user.displayName, email: user.email }} authProvider={authProvider} />;
}
