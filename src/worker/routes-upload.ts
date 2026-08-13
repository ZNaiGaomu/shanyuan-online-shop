import { Hono } from "hono";
import { isResponse, requireAdmin, requireUser, readSession } from "./auth";
import type { Env } from "./types";

export const uploadRoutes = new Hono<{ Bindings: Env }>();

const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_VIDEO = 80 * 1024 * 1024;

uploadRoutes.post("/", async (c) => {
  const session = await readSession(c);
  if (!session) return c.json({ ok: false, error: "请先登录再上传" }, 401);

  if (!c.env.MEDIA) {
    return c.json({ ok: false, error: "图片存储未绑定，请确认 R2 桶 shanyuan-shop-media" }, 500);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ ok: false, error: "文件没传上来，请换一张小一点的图或改用 jpg" }, 400);
  }

  const file = form.get("file");
  const kind = String(form.get("kind") || "image");
  if (!(file instanceof File)) return c.json({ ok: false, error: "没有文件" }, 400);

  const isVideo = kind === "video";
  if (isVideo && session.kind !== "admin") {
    return c.json({ ok: false, error: "只有管理员能上传视频" }, 403);
  }
  if (session.kind === "user") {
    const userGate = await requireUser(c);
    if (isResponse(userGate)) return userGate;
  } else {
    const adminGate = await requireAdmin(c);
    if (isResponse(adminGate)) return adminGate;
  }

  const sniffed = sniffType(file, isVideo);
  if (!sniffed.ok) return c.json({ ok: false, error: sniffed.error }, 400);
  if (file.size <= 0) return c.json({ ok: false, error: "空文件" }, 400);
  if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) {
    return c.json({ ok: false, error: isVideo ? "视频不能超过 80MB" : "图片不能超过 12MB，请压缩后再传" }, 400);
  }

  const ext = extOf(file.name, sniffed.type);
  const key = `${session.kind}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  try {
    await c.env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: sniffed.type },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "未知错误";
    return c.json({ ok: false, error: `写入存储失败：${detail}` }, 500);
  }
  return c.json({ ok: true, data: { key, url: `/media/${encodeURIComponent(key)}` } });
});

function sniffType(file: File, isVideo: boolean): { ok: true; type: string } | { ok: false; error: string } {
  const name = (file.name || "").toLowerCase();
  let type = (file.type || "").toLowerCase();
  if (!type || type === "application/octet-stream") {
    if (/\.(jpe?g)$/.test(name)) type = "image/jpeg";
    else if (name.endsWith(".png")) type = "image/png";
    else if (name.endsWith(".webp")) type = "image/webp";
    else if (name.endsWith(".gif")) type = "image/gif";
    else if (name.endsWith(".bmp")) type = "image/bmp";
    else if (/\.(heic|heif)$/.test(name)) type = "image/heic";
    else if (name.endsWith(".mp4")) type = "video/mp4";
    else if (name.endsWith(".webm")) type = "video/webm";
    else if (name.endsWith(".mov")) type = "video/quicktime";
  }
  if (isVideo) {
    if (type.startsWith("video/")) return { ok: true, type: type === "video/quicktime" ? "video/quicktime" : type };
    return { ok: false, error: "视频请用 mp4 / webm / mov" };
  }
  if (type === "image/svg+xml") return { ok: false, error: "不支持 svg" };
  if (type.startsWith("image/")) return { ok: true, type };
  return { ok: false, error: "图片请用 jpg / png / webp（苹果 HEIC 请先在浏览器里能预览，或改成 jpg）" };
}

function extOf(name: string, type: string): string {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName) && fromName !== "svg") return fromName;
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/bmp") return "bmp";
  if (type === "video/webm") return "webm";
  if (type === "video/quicktime") return "mov";
  if (type.startsWith("video/")) return "mp4";
  return "jpg";
}
