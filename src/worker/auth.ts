import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env, Session } from "./types";

const COOKIE = "sy_session";
const SESSION_MS = 180 * 24 * 60 * 60 * 1000;

function expiryUtc() {
  return new Date(Date.now() + SESSION_MS).toISOString().slice(0, 19).replace("T", " ");
}

function cookieOpts(c: Context<{ Bindings: Env }>) {
  const secure = new URL(c.req.url).protocol === "https:";
  return {
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    secure,
    maxAge: Math.floor(SESSION_MS / 1000),
    expires: new Date(Date.now() + SESSION_MS),
  };
}

export async function readSession(c: Context<{ Bindings: Env }>): Promise<Session | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare(
    "SELECT token, kind, user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
  )
    .bind(token)
    .first<Session>();
  return row ?? null;
}

export async function requireUser(c: Context<{ Bindings: Env }>): Promise<Session | Response> {
  const session = await readSession(c);
  if (!session || session.kind !== "user" || !session.user_id) {
    return c.json({ ok: false, error: "请先登录" }, 401);
  }
  return session;
}

export async function requireAdmin(c: Context<{ Bindings: Env }>): Promise<Session | Response> {
  const session = await readSession(c);
  if (!session || session.kind !== "admin") {
    return c.json({ ok: false, error: "需要管理员登录" }, 401);
  }
  return session;
}

export async function createSession(
  c: Context<{ Bindings: Env }>,
  token: string,
  kind: Session["kind"],
  userId: number | null,
): Promise<void> {
  await c.env.DB.prepare(
    "INSERT INTO sessions (token, kind, user_id, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(token, kind, userId, expiryUtc())
    .run();
  setCookie(c, COOKIE, token, cookieOpts(c));
}

export async function touchSession(c: Context<{ Bindings: Env }>): Promise<void> {
  const token = getCookie(c, COOKIE);
  if (!token) return;
  const row = await c.env.DB
    .prepare("SELECT token FROM sessions WHERE token = ? AND expires_at > datetime('now')")
    .bind(token)
    .first();
  if (!row) return;
  await c.env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE token = ?").bind(expiryUtc(), token).run();
  setCookie(c, COOKIE, token, cookieOpts(c));
}

export async function clearSession(c: Context<{ Bindings: Env }>): Promise<void> {
  const token = getCookie(c, COOKIE);
  if (token) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
  deleteCookie(c, COOKIE, { path: "/" });
}

export function isResponse(value: Session | Response): value is Response {
  return value instanceof Response;
}
