import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const DASHBOARD_SESSION_COOKIE = "intersection-dashboard-session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

const signature = (value: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update(value).digest("base64url");

export function passwordAuthConfigured() {
  return Boolean(process.env.DASHBOARD_EMAIL && process.env.DASHBOARD_PASSWORD && process.env.AUTH_SECRET);
}

export function createPasswordSession(email: string) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const encodedEmail = Buffer.from(email).toString("base64url");
  const payload = `${encodedEmail}.${expires}`;
  return { value: `${payload}.${signature(payload)}`, maxAge: SESSION_SECONDS };
}

export async function getPasswordUser() {
  if (!passwordAuthConfigured()) return null;
  const token = (await cookies()).get(DASHBOARD_SESSION_COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedEmail, expiresText, suppliedSignature] = parts;
  const payload = `${encodedEmail}.${expiresText}`;
  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  if (Number(expiresText) <= Math.floor(Date.now() / 1000)) return null;
  const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
  if (email.toLowerCase() !== process.env.DASHBOARD_EMAIL?.toLowerCase()) return null;
  return {
    userId: `vercel:${email}`,
    displayName: process.env.DASHBOARD_NAME?.trim() || email.split("@")[0],
    email,
    fullName: process.env.DASHBOARD_NAME?.trim() || null,
  };
}

export function validPasswordCredentials(email: string, password: string) {
  if (!passwordAuthConfigured()) return false;
  const expectedEmail = Buffer.from(process.env.DASHBOARD_EMAIL!.toLowerCase());
  const suppliedEmail = Buffer.from(email.toLowerCase());
  const expectedPassword = Buffer.from(process.env.DASHBOARD_PASSWORD!);
  const suppliedPassword = Buffer.from(password);
  return suppliedEmail.length === expectedEmail.length && suppliedPassword.length === expectedPassword.length
    && timingSafeEqual(suppliedEmail, expectedEmail) && timingSafeEqual(suppliedPassword, expectedPassword);
}
