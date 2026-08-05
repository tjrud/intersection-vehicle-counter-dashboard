import DashboardClient from "./DashboardClient";
import LoginVisual from "./LoginVisual";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { passwordAuthConfigured } from "./password-auth";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ auth_error?: string; auth_view?: string }> }) {
  const user = await getChatGPTUser();
  const params = await searchParams;
  if (!user) {
    const usePasswordLogin = Boolean(process.env.VERCEL) || passwordAuthConfigured();
    const authView = params.auth_view === "signup" ? "signup" : params.auth_view === "reset" ? "reset" : "login";
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-brand"><span>IC</span><div><b>DASHBOARD</b><small>INTERSECTION CONTROL</small></div></div>
          <div className="login-copy"><p>TRAFFIC OPERATIONS</p><h1>현장 조사부터 영상 전처리,<br />차량 카운팅까지 한 곳에서.</h1><span>교차로 조사의 모든 흐름을 정확하고 간결하게 관리하세요.</span></div>
          {usePasswordLogin ? <div className="auth-panel"><nav aria-label="계정 메뉴"><a className={authView === "login" ? "active" : ""} href="/">로그인</a><a className={authView === "signup" ? "active" : ""} href="/?auth_view=signup">회원가입</a></nav>{authView === "signup" ? <form className="vercel-login" action="/api/auth/signup" method="post"><label><span>이름</span><input name="name" autoComplete="name" minLength={2} required /></label><label><span>이메일</span><input name="email" type="email" autoComplete="username" required /></label><label><span>비밀번호</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label><span>비밀번호 확인</span><input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>{params.auth_error === "signup" && <p>입력 내용을 확인해 주세요. 비밀번호는 8자 이상이며 서로 같아야 합니다.</p>}<button type="submit"><b>계정 만들기</b><span>→</span></button><small>계정은 현재 브라우저에 안전하게 저장됩니다.</small></form> : authView === "reset" ? <form className="vercel-login" action="/api/auth/reset" method="post"><div className="auth-form-heading"><b>비밀번호 재설정</b><span>가입했던 브라우저와 이메일을 확인합니다.</span></div><label><span>가입 이메일</span><input name="email" type="email" autoComplete="username" required /></label><label><span>새 비밀번호</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label><span>새 비밀번호 확인</span><input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>{params.auth_error === "reset" && <p>이 브라우저에 저장된 계정과 이메일을 확인해 주세요.</p>}<button type="submit"><b>비밀번호 변경</b><span>→</span></button><a className="back-login" href="/">로그인으로 돌아가기</a></form> : <form className="vercel-login" action="/api/auth/login" method="post"><label><span>이메일</span><input name="email" type="email" autoComplete="username" required /></label><label><span>비밀번호</span><input name="password" type="password" autoComplete="current-password" required /></label>{params.auth_error === "invalid" && <p>이메일 또는 비밀번호가 올바르지 않습니다.</p>}<div className="password-help"><label><input type="checkbox" name="remember" /> 로그인 유지</label><a href="/?auth_view=reset">비밀번호를 잊으셨나요?</a></div><button type="submit"><b>대시보드 로그인</b><span>→</span></button></form>}</div> : <a className="chatgpt-login" href={chatGPTSignInPath("/")}><b>ChatGPT로 로그인</b><span>→</span></a>}
          <small className="login-note">로그인 정보와 조사 기록은 외부에 공개되지 않습니다.</small>
        </section>
        <LoginVisual />
      </main>
    );
  }
  const authProvider = user.userId.startsWith("vercel:") ? "password" : "chatgpt";
  return <DashboardClient user={{ displayName: user.displayName, email: user.email }} authProvider={authProvider} />;
}
