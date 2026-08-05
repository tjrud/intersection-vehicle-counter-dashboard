import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const DASHBOARD_SESSION_COOKIE = "intersection-dashboard-session";
export const DASHBOARD_ACCOUNT_COOKIE = "intersection-dashboard-account";
export const AUTH_COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const ACCOUNT_SECONDS = 60 * 60 * 24 * 365;
type LocalAccount = { name: string; email: string; salt: string; passwordHash: string };

const signature = (value: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update(value).digest("base64url");
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
const passwordHash = (password: string, salt: string) => scryptSync(password, salt, 32).toString("base64url");

export function passwordAuthConfigured() { return Boolean(process.env.AUTH_SECRET); }

export function createPasswordSession(email: string) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${Buffer.from(email).toString("base64url")}.${expires}`;
  return { value: `${payload}.${signature(payload)}`, maxAge: SESSION_SECONDS };
}

export function createLocalAccount(name: string, email: string, password: string) {
  const salt = randomBytes(16).toString("base64url");
  const account: LocalAccount = { name: name.trim(), email: email.trim().toLowerCase(), salt, passwordHash: passwordHash(password, salt) };
  const payload = Buffer.from(JSON.stringify(account)).toString("base64url");
  return { value: `${payload}.${signature(payload)}`, maxAge: ACCOUNT_SECONDS, account };
}

async function getLocalAccount(): Promise<LocalAccount | null> {
  if (!passwordAuthConfigured()) return null;
  const token = (await cookies()).get(DASHBOARD_ACCOUNT_COOKIE)?.value;
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  if (!safeEqual(token.slice(separator + 1), signature(payload))) return null;
  try {
    const account = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LocalAccount;
    return account.name && account.email && account.salt && account.passwordHash ? account : null;
  } catch { return null; }
}

export async function getPasswordUser() {
  if (!passwordAuthConfigured()) return null;
  const token = (await cookies()).get(DASHBOARD_SESSION_COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedEmail, expiresText, suppliedSignature] = parts;
  const payload = `${encodedEmail}.${expiresText}`;
  if (!safeEqual(suppliedSignature, signature(payload)) || Number(expiresText) <= Math.floor(Date.now() / 1000)) return null;
  const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
  const localAccount = await getLocalAccount();
  if (localAccount?.email === email.toLowerCase()) return { userId: `vercel:${email}`, displayName: localAccount.name, email, fullName: localAccount.name };
  if (email.toLowerCase() !== process.env.DASHBOARD_EMAIL?.toLowerCase()) return null;
  const displayName = process.env.DASHBOARD_NAME?.trim() || email.split("@")[0];
  return { userId: `vercel:${email}`, displayName, email, fullName: displayName };
}

export async function validPasswordCredentials(email: string, password: string) {
  if (!passwordAuthConfigured()) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const localAccount = await getLocalAccount();
  if (localAccount?.email === normalizedEmail) return safeEqual(passwordHash(password, localAccount.salt), localAccount.passwordHash);
  return normalizedEmail === process.env.DASHBOARD_EMAIL?.toLowerCase() && safeEqual(password, process.env.DASHBOARD_PASSWORD ?? "");
}

export async function canResetLocalAccount(email: string) {
  const account = await getLocalAccount();
  return account?.email === email.trim().toLowerCase() ? account : null;
}
