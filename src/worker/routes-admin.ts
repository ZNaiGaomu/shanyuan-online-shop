import { Hono } from "hono";
import type { Context } from "hono";
import { ensureAdminCreds, updateAdminCreds, verifyAdminLogin } from "./admin-creds";
import { isResponse, requireAdmin } from "./auth";
import { hashPassword } from "./crypto";
import { toCents } from "./serialize";
import type { Env } from "./types";

async function readBody<T extends object>(c: Context): Promise<T> {
  try {
    return await c.req.json<T>();
  } catch {
    return {} as T;
  }
}

export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.use("*", async (c, next) => {
  const session = await requireAdmin(c);
  if (isResponse(session)) return session;
  await next();
});

adminRoutes.put("/config", async (c) => {
  const body = await readBody<Record<string, string>>(c);
  const allowed = new Set([
    "shop_name",
    "shop_logo_key",
    "notice",
    "shop_video_key",
    "contact_name",
    "contact_phone",
    "contact_wechat",
    "contact_qr_key",
    "contact_hours",
    "contact_address",
    "contact_note",
  ]);
  const stmts = Object.entries(body)
    .filter(([key]) => allowed.has(key))
    .map(([key, value]) =>
      c.env.DB.prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(
        key,
        String(value ?? ""),
      ),
    );
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

adminRoutes.post("/banners", async (c) => {
  const body = await readBody<{ imageKey?: string; sort?: number }>(c);
  if (!body.imageKey) return c.json({ ok: false, error: "请上传轮播图" }, 400);
  await c.env.DB
    .prepare("INSERT INTO banners (image_key, sort) VALUES (?, ?)")
    .bind(body.imageKey, Number(body.sort) || 0)
    .run();
  return c.json({ ok: true });
});

adminRoutes.delete("/banners/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM banners WHERE id = ?").bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

adminRoutes.post("/categories", async (c) => {
  const body = await readBody<{ name?: string; iconKey?: string; sort?: number; visible?: boolean }>(c);
  const name = (body.name || "").trim();
  if (!name) return c.json({ ok: false, error: "分类名不能空" }, 400);
  await c.env.DB
    .prepare("INSERT INTO categories (name, icon_key, sort, visible) VALUES (?, ?, ?, ?)")
    .bind(name, body.iconKey || null, Number(body.sort) || 0, body.visible === false ? 0 : 1)
    .run();
  return c.json({ ok: true });
});

adminRoutes.put("/categories/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await readBody<{ name?: string; iconKey?: string; sort?: number; visible?: boolean }>(c);
  const current = await c.env.DB.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first<{
    name: string;
    icon_key: string | null;
    sort: number;
    visible: number;
  }>();
  if (!current) return c.json({ ok: false, error: "分类不存在" }, 404);
  await c.env.DB
    .prepare("UPDATE categories SET name = ?, icon_key = ?, sort = ?, visible = ? WHERE id = ?")
    .bind(
      (body.name ?? current.name).trim(),
      body.iconKey === undefined ? current.icon_key : body.iconKey || null,
      body.sort === undefined ? current.sort : Number(body.sort),
      body.visible === undefined ? current.visible : body.visible ? 1 : 0,
      id,
    )
    .run();
  return c.json({ ok: true });
});

adminRoutes.delete("/categories/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const used = await c.env.DB.prepare("SELECT id FROM products WHERE category_id = ? LIMIT 1").bind(id).first();
  if (used) return c.json({ ok: false, error: "该类下还有商品，先改分类或删商品" }, 400);
  await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

type PriceIn = { amount: number; qty: number; unit?: string };
type MediaIn = { kind: "image" | "video"; objectKey: string };

adminRoutes.post("/products", async (c) => {
  const body = await readBody<{
    name?: string;
    categoryId?: number;
    coverKey?: string;
    intro?: string;
    onSale?: boolean;
    sort?: number;
    prices?: PriceIn[];
    media?: MediaIn[];
  }>(c);
  const error = validateProduct(body);
  if (error) return c.json({ ok: false, error }, 400);
  const result = await c.env.DB
    .prepare(
      "INSERT INTO products (category_id, name, cover_key, intro, on_sale, sort) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      Number(body.categoryId),
      body.name!.trim(),
      body.coverKey,
      body.intro || "",
      body.onSale === false ? 0 : 1,
      Number(body.sort) || 0,
    )
    .run();
  const productId = Number(result.meta.last_row_id);
  await saveChildren(c.env.DB, productId, body.prices!, body.media || []);
  return c.json({ ok: true, data: { id: productId } });
});

adminRoutes.put("/products/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const exists = await c.env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
  if (!exists) return c.json({ ok: false, error: "商品不存在" }, 404);
  const body = await readBody<{
    name?: string;
    categoryId?: number;
    coverKey?: string;
    intro?: string;
    onSale?: boolean;
    sort?: number;
    prices?: PriceIn[];
    media?: MediaIn[];
  }>(c);
  const error = validateProduct(body);
  if (error) return c.json({ ok: false, error }, 400);
  await c.env.DB
    .prepare(
      "UPDATE products SET category_id = ?, name = ?, cover_key = ?, intro = ?, on_sale = ?, sort = ? WHERE id = ?",
    )
    .bind(
      Number(body.categoryId),
      body.name!.trim(),
      body.coverKey,
      body.intro || "",
      body.onSale === false ? 0 : 1,
      Number(body.sort) || 0,
      id,
    )
    .run();
  await c.env.DB.prepare("DELETE FROM product_prices WHERE product_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM product_media WHERE product_id = ?").bind(id).run();
  await saveChildren(c.env.DB, id, body.prices!, body.media || []);
  return c.json({ ok: true });
});

adminRoutes.delete("/products/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM cart_items WHERE product_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM product_prices WHERE product_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM product_media WHERE product_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

adminRoutes.get("/account", async (c) => {
  const creds = await ensureAdminCreds(c.env.DB, c.env);
  if (!creds) return c.json({ ok: false, error: "管理员账号尚未初始化" }, 500);
  return c.json({ ok: true, data: { username: creds.username } });
});

adminRoutes.put("/account", async (c) => {
  const body = await readBody<{
    currentPassword?: string;
    currentSecret?: string;
    username?: string;
    password?: string;
    secret?: string;
  }>(c);
  const current = await ensureAdminCreds(c.env.DB, c.env);
  if (!current) return c.json({ ok: false, error: "管理员账号尚未初始化" }, 500);
  if (
    !(await verifyAdminLogin(
      c.env.DB,
      current.username,
      body.currentPassword || "",
      body.currentSecret || "",
      c.env,
    ))
  ) {
    return c.json({ ok: false, error: "当前密码或密钥不对" }, 400);
  }
  const username = (body.username || current.username).trim();
  if (username.length < 2 || username.length > 20) {
    return c.json({ ok: false, error: "新账号 2–20 位" }, 400);
  }
  if (body.password && body.password.length < 6) {
    return c.json({ ok: false, error: "新密码至少 6 位" }, 400);
  }
  if (body.secret && body.secret.length < 6) {
    return c.json({ ok: false, error: "新密钥至少 6 位" }, 400);
  }
  const ok = await updateAdminCreds(
    c.env.DB,
    {
      username,
      password: body.password,
      secret: body.secret,
    },
    c.env,
  );
  if (!ok) return c.json({ ok: false, error: "管理员账号尚未初始化" }, 500);
  return c.json({ ok: true });
});

adminRoutes.post("/users/:id/reset-password", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await readBody<{ password?: string }>(c);
  const password = body.password || "";
  if (password.length < 6 || password.length > 64) {
    return c.json({ ok: false, error: "新密码至少 6 位" }, 400);
  }
  const user = await c.env.DB.prepare("SELECT id, username FROM users WHERE id = ?").bind(id).first<{
    id: number;
    username: string;
  }>();
  if (!user) return c.json({ ok: false, error: "客户不存在" }, 404);
  const hash = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
  ]);
  return c.json({ ok: true, data: { username: user.username } });
});

adminRoutes.get("/users", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT u.id, u.username, u.nickname, u.created_at,
              COUNT(ci.id) AS cart_count
       FROM users u
       LEFT JOIN cart_items ci ON ci.user_id = u.id
       GROUP BY u.id
       ORDER BY u.id DESC`,
    )
    .all();
  return c.json({ ok: true, data: rows.results ?? [] });
});

adminRoutes.get("/users/:id/cart", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT ci.id, ci.qty, p.name, pp.amount_cents, pp.qty AS pack_qty, pp.unit
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN product_prices pp ON pp.id = ci.price_id
       WHERE ci.user_id = ?
       ORDER BY ci.id DESC`,
    )
    .bind(Number(c.req.param("id")))
    .all<{
      id: number;
      qty: number;
      name: string;
      amount_cents: number;
      pack_qty: number;
      unit: string;
    }>();
  return c.json({
    ok: true,
    data: (rows.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      qty: row.qty,
      amount: row.amount_cents / 100,
      packQty: row.pack_qty,
      unit: row.unit,
    })),
  });
});

function validateProduct(body: {
  name?: string;
  categoryId?: number;
  coverKey?: string;
  prices?: PriceIn[];
}): string | null {
  if (!body.name?.trim()) return "请填写商品名称";
  if (!body.categoryId) return "请选择分类";
  if (!body.coverKey) return "请上传封面";
  if (!body.prices?.length) return "至少一条报价";
  for (const price of body.prices) {
    if (!(Number(price.amount) > 0) || !(Number(price.qty) > 0)) return "报价金额和数量都要大于 0";
  }
  return null;
}

async function saveChildren(db: D1Database, productId: number, prices: PriceIn[], media: MediaIn[]) {
  const stmts = [
    ...prices.map((price, index) =>
      db
        .prepare("INSERT INTO product_prices (product_id, amount_cents, qty, unit, sort) VALUES (?, ?, ?, ?, ?)")
        .bind(productId, toCents(Number(price.amount)), Math.round(Number(price.qty)), price.unit || "个", index),
    ),
    ...media.map((item, index) =>
      db
        .prepare("INSERT INTO product_media (product_id, kind, object_key, sort) VALUES (?, ?, ?, ?)")
        .bind(productId, item.kind, item.objectKey, index),
    ),
  ];
  if (stmts.length) await db.batch(stmts);
}
