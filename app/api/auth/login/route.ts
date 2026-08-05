import { NextResponse } from "next/server";
import { createPasswordSession, DASHBOARD_SESSION_COOKIE, validPasswordCredentials } from "../../../password-auth";

export async function POST(request: Request) {
  const data = await request.formData();
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const url = new URL("/", request.url);
  if (!await validPasswordCredentials(email, password)) {
    url.searchParams.set("auth_error", "invalid");
    return NextResponse.redirect(url, 303);
  }
  const session = createPasswordSession(email);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(DASHBOARD_SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  return response;
}
