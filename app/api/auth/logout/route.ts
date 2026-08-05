import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "../../../password-auth";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(DASHBOARD_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
