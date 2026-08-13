import { Hono } from "hono";
import type { Context } from "hono";
import { clearSession, createSession, isResponse, requireUser } from "./auth";
import { verifyAdminLogin } from "./admin-creds";
import { hashPassword, randomToken, verifyPassword } from "./crypto";
import type { Env } from "./types";

async function readBody<T extends object>(c: Context): Promise<T> {
  try {
    return await c.req.json<T>();
  } catch {
    return {} as T;
  }
}

export const userRoutes = new Hono<{ Bindings: Env }>();

export const USER_RE = /^[一-龥A-Za-z0-9_]{2,20}$/;

userRoutes.post("/register", async (c) => {
  const body = await readBody<{ username?: string; password?: string }>(c);
  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!USER_RE.test(username)) {
    return c.json({ ok: false, error: "用户名 2–20 位，中文、字母、数字或下划线" }, 400);
  }
  if (password.length < 6 || password.length > 64) {
    return c.json({ ok: false, error: "密码至少 6 位" }, 400);
  }
  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (exists) return c.json({ ok: false, error: "用户名已被占用" }, 400);
  const hash = await hashPassword(password);
  const result = await c.env.DB
    .prepare("INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)")
    .bind(username, hash, username)
    .run();
  const token = randomToken();
  await createSession(c, token, "user", Number(result.meta.last_row_id));
  return c.json({ ok: true });
});

userRoutes.post("/login", async (c) => {
  const body = await readBody<{ username?: string; password?: string }>(c);
  const username = (body.username || "").trim();
  const password = body.password || "";
  const user = await c.env.DB
    .prepare("SELECT id, password_hash FROM users WHERE username = ?")
    .bind(username)
    .first<{ id: number; password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ ok: false, error: "用户名或密码不对" }, 401);
  }
  await createSession(c, randomToken(), "user", user.id);
  return c.json({ ok: true });
});

userRoutes.post("/admin-login", async (c) => {
  const body = await readBody<{ username?: string; password?: string; secret?: string }>(c);
  const username = body.username || "";
  const password = body.password || "";
  const secret = body.secret || "";
  if (!(await verifyAdminLogin(c.env.DB, username, password, secret, c.env))) {
    return c.json({ ok: false, error: "账号、密码或密钥不对" }, 401);
  }
  await createSession(c, randomToken(), "admin", null);
  return c.json({ ok: true });
});

userRoutes.post("/logout", async (c) => {
  await clearSession(c);
  return c.json({ ok: true });
});

userRoutes.post("/push-token", async (c) => {
  const session = await requireUser(c);
  if (isResponse(session)) return session;
  const body = await readBody<{ token?: string; platform?: string }>(c);
  const token = (body.token || "").trim();
  if (token.length < 20 || token.length > 4096) return c.json({ ok: false, error: "通知令牌无效" }, 400);
  await c.env.DB
    .prepare(
      `INSERT INTO push_devices (token, user_id, platform, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at`,
    )
    .bind(token, session.user_id, body.platform === "ios" ? "ios" : "android")
    .run();
  return c.json({ ok: true });
});

userRoutes.delete("/push-token", async (c) => {
  const session = await requireUser(c);
  if (isResponse(session)) return session;
  const body = await readBody<{ token?: string }>(c);
  const token = (body.token || "").trim();
  if (token) {
    await c.env.DB.prepare("DELETE FROM push_devices WHERE token = ? AND user_id = ?").bind(token, session.user_id).run();
  }
  return c.json({ ok: true });
});

userRoutes.post("/profile", async (c) => {
  const session = await requireUser(c);
  if (isResponse(session)) return session;
  const body = await readBody<{
    username?: string;
    avatarKey?: string;
    password?: string;
    oldPassword?: string;
  }>(c);
  const user = await c.env.DB
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(session.user_id)
    .first<{
      username: string;
      avatar_key: string | null;
      password_hash: string;
    }>();
  if (!user) return c.json({ ok: false, error: "用户不存在" }, 404);

  const username = (body.username ?? user.username).trim();
  if (!USER_RE.test(username)) {
    return c.json({ ok: false, error: "用户名 2–20 位，中文、字母、数字或下划线" }, 400);
  }
  if (username !== user.username) {
    const taken = await c.env.DB.prepare("SELECT id FROM users WHERE username = ? AND id != ?").bind(username, session.user_id).first();
    if (taken) return c.json({ ok: false, error: "用户名已被占用" }, 400);
  }
  const avatarKey = body.avatarKey === undefined ? user.avatar_key : body.avatarKey || null;
  let hash = user.password_hash;
  if (body.password) {
    if (!body.oldPassword) return c.json({ ok: false, error: "改密码请先填写旧密码" }, 400);
    if (!(await verifyPassword(body.oldPassword, user.password_hash))) {
      return c.json({ ok: false, error: "旧密码不对" }, 400);
    }
    if (body.password.length < 6) return c.json({ ok: false, error: "新密码至少 6 位" }, 400);
    hash = await hashPassword(body.password);
  }
  await c.env.DB
    .prepare("UPDATE users SET username = ?, nickname = ?, avatar_key = ?, password_hash = ? WHERE id = ?")
    .bind(username, username, avatarKey, hash, session.user_id)
    .run();
  return c.json({ ok: true });
});

userRoutes.post("/cart", async (c) => {
  const session = await requireUser(c);
  if (isResponse(session)) return session;
  const body = await readBody<{ productId?: number; priceId?: number; qty?: number }>(c);
  const productId = Number(body.productId);
  const priceId = Number(body.priceId);
  const qty = Math.max(1, Math.min(999, Number(body.qty) || 1));
  const price = await c.env.DB
    .prepare("SELECT id FROM product_prices WHERE id = ? AND product_id = ?")
    .bind(priceId, productId)
    .first();
  const product = await c.env.DB
    .prepare("SELECT id, on_sale FROM products WHERE id = ?")
    .bind(productId)
    .first<{ on_sale: number }>();
  if (!price || !product || product.on_sale !== 1) {
    return c.json({ ok: false, error: "商品或报价不存在" }, 400);
  }
  await c.env.DB
    .prepare(
      `INSERT INTO cart_items (user_id, product_id, price_id, qty)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, product_id, price_id) DO UPDATE SET qty = qty + excluded.qty`,
    )
    .bind(session.user_id, productId, priceId, qty)
    .run();
  return c.json({ ok: true });
});

userRoutes.patch("/cart/:id", async (c) => {
  const session = await requireUser(c);
  if (isResponse(session)) return session;
  const id = Number(c.req.param("id"));
  const body = await readBody<{ qty?: number }>(c);
  const qty = Math.max(1, Math.min(999, Number(body.qty) || 1));
  const result = await c.env.DB
    .prepare("UPDATE cart_items SET qty = ? WHERE id = ? AND user_id = ?")
    .bind(qty, id, session.user_id)
    .run();
  if (!result.meta.changes) return c.json({ ok: false, error: "购物车项不存在" }, 404);
  return c.json({ ok: true });
});

userRoutes.delete("/cart/:id", async (c) => {
  const session = await requireUser(c);
  if (isResponse(session)) return session;
  await c.env.DB
    .prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?")
    .bind(Number(c.req.param("id")), session.user_id)
    .run();
  return c.json({ ok: true });
});
