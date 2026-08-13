import type { Env } from "./types";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function b64url(data: ArrayBuffer | string) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToPkcs8(pem: string) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

async function accessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${b64url(sig)}`,
  });
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("firebase token");
  return json.access_token;
}

function readServiceAccount(env: Env): ServiceAccount | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    return sa;
  } catch {
    return null;
  }
}

export async function notifyProductOnSale(env: Env, productId: number, name: string) {
  await sendPush(env, {
    title: "善愿上新",
    body: name,
    data: { productId: String(productId), url: `/shop/p/${productId}` },
  });
}

export async function notifyActivity(env: Env, text: string) {
  await sendPush(env, {
    title: "善愿活动",
    body: text.slice(0, 80),
    data: { url: "/shop" },
  });
}

async function sendPush(env: Env, payload: { title: string; body: string; data: Record<string, string> }) {
  try {
    const sa = readServiceAccount(env);
    if (!sa) return;
    const rows = await env.DB.prepare("SELECT token FROM push_devices").all<{ token: string }>();
    const tokens = (rows.results ?? []).map((row) => row.token).filter(Boolean);
    if (!tokens.length) return;
    const bearer = await accessToken(sa);
    const stale: string[] = [];
    for (const token of tokens.slice(0, 400)) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: payload.title, body: payload.body },
            data: payload.data,
            android: { priority: "HIGH" },
          },
        }),
      });
      if (res.status === 404 || res.status === 400) stale.push(token);
    }
    if (stale.length) {
      await env.DB.batch(stale.map((token) => env.DB.prepare("DELETE FROM push_devices WHERE token = ?").bind(token)));
    }
  } catch (err) {
    console.error(err);
  }
}
