import { hashPassword, verifyPassword } from "./crypto";
import { mapConfig } from "./serialize";

const SEED_MARK = "env-v1";

export type AdminEnv = {
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
};

export type AdminCreds = {
  username: string;
  passwordHash: string;
  secretHash: string;
};

async function readCreds(db: D1Database): Promise<AdminCreds | null> {
  const rows = await db
    .prepare(
      "SELECT key, value FROM config WHERE key IN ('admin_username', 'admin_password_hash', 'admin_secret_hash')",
    )
    .all<{ key: string; value: string }>();
  const cfg = mapConfig(rows.results ?? []);
  if (!cfg.admin_username || !cfg.admin_password_hash || !cfg.admin_secret_hash) return null;
  return {
    username: cfg.admin_username,
    passwordHash: cfg.admin_password_hash,
    secretHash: cfg.admin_secret_hash,
  };
}

async function writeCreds(db: D1Database, creds: AdminCreds): Promise<void> {
  await db.batch([
    db
      .prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind("admin_username", creds.username),
    db
      .prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind("admin_password_hash", creds.passwordHash),
    db
      .prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind("admin_secret_hash", creds.secretHash),
    db
      .prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind("admin_seed_mark", SEED_MARK),
  ]);
}

export async function ensureAdminCreds(db: D1Database, env?: AdminEnv): Promise<AdminCreds | null> {
  const existing = await readCreds(db);
  if (existing) return existing;

  const username = (env?.ADMIN_USERNAME || "").trim();
  const password = env?.ADMIN_PASSWORD || "";
  const secret = env?.ADMIN_SECRET || "";
  if (username.length < 2 || password.length < 6 || secret.length < 6) return null;

  const seeded: AdminCreds = {
    username,
    passwordHash: await hashPassword(password),
    secretHash: await hashPassword(secret),
  };
  await writeCreds(db, seeded);
  return seeded;
}

export async function verifyAdminLogin(
  db: D1Database,
  username: string,
  password: string,
  secret: string,
  env?: AdminEnv,
): Promise<boolean> {
  const creds = await ensureAdminCreds(db, env);
  if (!creds || username !== creds.username) return false;
  const passOk = await verifyPassword(password, creds.passwordHash);
  const secretOk = await verifyPassword(secret, creds.secretHash);
  return passOk && secretOk;
}

export async function updateAdminCreds(
  db: D1Database,
  input: { username: string; password?: string; secret?: string },
  env?: AdminEnv,
): Promise<boolean> {
  const current = await ensureAdminCreds(db, env);
  if (!current) return false;
  const next: AdminCreds = {
    username: input.username.trim(),
    passwordHash: input.password ? await hashPassword(input.password) : current.passwordHash,
    secretHash: input.secret ? await hashPassword(input.secret) : current.secretHash,
  };
  await writeCreds(db, next);
  return true;
}
