import { Hono } from "hono";
import { adminRoutes } from "./routes-admin";
import { publicRoutes } from "./routes-public";
import { uploadRoutes } from "./routes-upload";
import { userRoutes } from "./routes-user";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "";
  if (/R2|bucket|binding|storage/i.test(message)) {
    return c.json({ ok: false, error: "图片存储未就绪：请确认已开通 R2 并绑定 shanyuan-shop-media" }, 500);
  }
  return c.json({ ok: false, error: "服务器出错了，请稍后再试" }, 500);
});

app.route("/api", publicRoutes);
app.route("/api/auth", userRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/upload", uploadRoutes);

app.get("/media/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  if (!c.env.MEDIA) return c.notFound();
  const object = await c.env.MEDIA.get(key);
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/media/")) {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
