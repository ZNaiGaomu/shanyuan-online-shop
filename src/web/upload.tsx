import { useState, type ChangeEvent } from "react";
import { api } from "./api";

export async function prepareImage(file: File, maxEdge = 1600): Promise<File> {
  if (file.type.startsWith("video/")) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("这张图浏览器读不了。请另存为 jpg 或 png 再传（苹果 HEIC 常需要先转换）。");
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) return file;
  const name = (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

export async function uploadMedia(file: File, kind: "image" | "video", maxEdge = 1600) {
  const prepared = kind === "image" ? await prepareImage(file, maxEdge) : file;
  const res = await api.upload(prepared, kind);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export function FilePick({
  label,
  kind = "image",
  maxEdge = 1600,
  onDone,
}: {
  label: string;
  kind?: "image" | "video";
  maxEdge?: number;
  onDone: (data: { key: string; url: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      onDone(await uploadMedia(file, kind, maxEdge));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={`uploader ${busy ? "busy" : ""}`}>
      {busy ? "正在处理并上传…" : label}
      <input
        type="file"
        disabled={busy}
        accept={kind === "video" ? "video/mp4,video/webm,video/quicktime,video/*" : "image/jpeg,image/png,image/webp,image/*"}
        onChange={(e) => void onChange(e)}
      />
      {err && <div className="hint">{err}</div>}
    </label>
  );
}
