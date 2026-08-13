import { Hono } from "hono";
import { isResponse, readSession, requireUser } from "./auth";
import { ensureAdminCreds } from "./admin-creds";
import {
  mapConfig,
  publicBanner,
  publicCategory,
  publicConfig,
  publicProduct,
} from "./serialize";
import type { BannerRow, CategoryRow, Env, MediaRow, PriceRow, ProductRow } from "./types";

export const publicRoutes = new Hono<{ Bindings: Env }>();

async function loadConfig(db: D1Database, env: Env) {
  await ensureAdminCreds(db, env);
  const rows = await db.prepare("SELECT key, value FROM config").all<{ key: string; value: string }>();
  return mapConfig(rows.results ?? []);
}

async function pricesFor(db: D1Database, productIds: number[]) {
  if (productIds.length === 0) return new Map<number, PriceRow[]>();
  const placeholders = productIds.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT * FROM product_prices WHERE product_id IN (${placeholders}) ORDER BY sort ASC, id ASC`,
    )
    .bind(...productIds)
    .all<PriceRow>();
  const map = new Map<number, PriceRow[]>();
  for (const row of rows.results ?? []) {
    const list = map.get(row.product_id) ?? [];
    list.push(row);
    map.set(row.product_id, list);
  }
  return map;
}

publicRoutes.get("/bootstrap", async (c) => {
  const session = await readSession(c);
  const preview = session?.kind === "admin";
  const cfg = await loadConfig(c.env.DB, c.env);
  const banners = await c.env.DB.prepare("SELECT * FROM banners ORDER BY sort ASC, id ASC").all<BannerRow>();
  const categories = await c.env.DB
    .prepare(
      preview
        ? "SELECT * FROM categories ORDER BY sort ASC, id ASC"
        : "SELECT * FROM categories WHERE visible = 1 ORDER BY sort ASC, id ASC",
    )
    .all<CategoryRow>();
  const products = await c.env.DB
    .prepare(
      preview
        ? "SELECT * FROM products ORDER BY sort ASC, id DESC"
        : "SELECT * FROM products WHERE on_sale = 1 ORDER BY sort ASC, id DESC",
    )
    .all<ProductRow>();
  const priceMap = await pricesFor(
    c.env.DB,
    (products.results ?? []).map((p) => p.id),
  );

  let me: { kind: string; id?: number; username?: string; nickname?: string; avatarUrl?: string | null } | null = null;
  if (session?.kind === "admin") {
    me = { kind: "admin" };
  } else if (session?.kind === "user" && session.user_id) {
    const user = await c.env.DB.prepare(
      "SELECT id, username, nickname, avatar_key FROM users WHERE id = ?",
    )
      .bind(session.user_id)
      .first<{
        id: number;
        username: string;
        nickname: string | null;
        avatar_key: string | null;
      }>();
    if (user) {
      me = {
        kind: "user",
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        avatarUrl: user.avatar_key ? `/media/${encodeURIComponent(user.avatar_key)}` : null,
      };
    }
  }

  return c.json({
    ok: true,
    data: {
      shop: publicConfig(cfg),
      banners: (banners.results ?? []).map(publicBanner),
      categories: (categories.results ?? []).map(publicCategory),
      products: (products.results ?? []).map((p) => publicProduct(p, priceMap.get(p.id) ?? [])),
      me,
      preview,
    },
  });
});

publicRoutes.get("/search", async (c) => {
  const q = (c.req.query("q") || "").trim();
  if (!q) return c.json({ ok: true, data: [] });
  const session = await readSession(c);
  const preview = session?.kind === "admin";
  const like = `%${q.replace(/%/g, "")}%`;
  const products = await c.env.DB
    .prepare(
      preview
        ? "SELECT * FROM products WHERE name LIKE ? ORDER BY sort ASC, id DESC"
        : "SELECT * FROM products WHERE on_sale = 1 AND name LIKE ? ORDER BY sort ASC, id DESC",
    )
    .bind(like)
    .all<ProductRow>();
  const priceMap = await pricesFor(
    c.env.DB,
    (products.results ?? []).map((p) => p.id),
  );
  return c.json({
    ok: true,
    data: (products.results ?? []).map((p) => publicProduct(p, priceMap.get(p.id) ?? [])),
  });
});

publicRoutes.get("/products/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ ok: false, error: "商品不存在" }, 404);
  const session = await readSession(c);
  const preview = session?.kind === "admin";
  const product = await c.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<ProductRow>();
  if (!product || (!preview && product.on_sale !== 1)) {
    return c.json({ ok: false, error: "商品不存在或已下架" }, 404);
  }
  const media = await c.env.DB
    .prepare("SELECT * FROM product_media WHERE product_id = ? ORDER BY sort ASC, id ASC")
    .bind(id)
    .all<MediaRow>();
  const prices = await c.env.DB
    .prepare("SELECT * FROM product_prices WHERE product_id = ? ORDER BY sort ASC, id ASC")
    .bind(id)
    .all<PriceRow>();
  return c.json({
    ok: true,
    data: publicProduct(product, prices.results ?? [], media.results ?? []),
  });
});

publicRoutes.get("/cart", async (c) => {
  const session = await requireUser(c);
  if (isResponse(session)) return session;
  const rows = await c.env.DB
    .prepare(
      `SELECT ci.id, ci.qty, ci.price_id, p.id AS product_id, p.name, p.cover_key, p.on_sale,
              pp.amount_cents, pp.qty AS pack_qty, pp.unit
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN product_prices pp ON pp.id = ci.price_id
       WHERE ci.user_id = ?
       ORDER BY ci.id DESC`,
    )
    .bind(session.user_id)
    .all<{
      id: number;
      qty: number;
      price_id: number;
      product_id: number;
      name: string;
      cover_key: string;
      on_sale: number;
      amount_cents: number;
      pack_qty: number;
      unit: string;
    }>();
  return c.json({
    ok: true,
    data: (rows.results ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      coverUrl: `/media/${encodeURIComponent(row.cover_key)}`,
      onSale: row.on_sale === 1,
      priceId: row.price_id,
      amount: row.amount_cents / 100,
      packQty: row.pack_qty,
      unit: row.unit,
      qty: row.qty,
    })),
  });
});
