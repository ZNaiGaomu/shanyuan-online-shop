import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "./api";
import { enterShopAsAdmin, useStore } from "./store";
import { syncNativeChrome } from "./native";

export function GatePage() {
  const { boot, loading } = useStore();
  const name = boot?.shop.shopName || "善愿日用品店（零售/批发）";
  const address = boot?.shop.contact.address || "商丘市宁陵县雷华上府北门商铺最西边第二家";
  useEffect(() => {
    void syncNativeChrome(true);
  }, []);
  if (!loading && boot?.me?.kind === "admin") return <Navigate to="/admin" replace />;
  if (!loading && boot?.me?.kind === "user") return <Navigate to="/shop" replace />;
  return (
    <div className="gate">
      <div className="gate-seal">善</div>
      <h1>{name}</h1>
      <p>零售 / 批发</p>
      <p className="gate-addr">{address}</p>
      <div className="gate-actions">
        <Link className="admin" to="/login/admin">
          管理员登录
        </Link>
        <Link className="user" to="/login/user">
          用户登录
        </Link>
        <Link className="guest" to="/shop">
          游客进入
        </Link>
      </div>
    </div>
  );
}

export function UserLoginPage() {
  return <AuthForm mode="user" />;
}

export function AdminLoginPage() {
  return <AuthForm mode="admin" />;
}

function AuthForm({ mode }: { mode: "user" | "admin" }) {
  const nav = useNavigate();
  const { refresh, setEditMode } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [reg, setReg] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void syncNativeChrome(false);
  }, []);

  async function submit() {
    setBusy(true);
    setErr("");
    const res =
      mode === "admin"
        ? await api.adminLogin(username, password, secret)
        : reg
          ? await api.register(username, password)
          : await api.login(username, password);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    await refresh();
    if (mode === "admin") {
      enterShopAsAdmin(true);
      setEditMode(true);
      nav("/admin");
    } else {
      nav("/shop");
    }
  }

  return (
    <div className="app-shell">
      <div className="page">
        <button className="btn btn-ghost" onClick={() => nav("/")}>
          返回入口
        </button>
        <h2 style={{ fontFamily: '"Noto Serif SC", serif', margin: "24px 0 8px" }}>
          {mode === "admin" ? "管理员登录" : reg ? "注册账号" : "用户登录"}
        </h2>
        <p className="muted">
          {mode === "admin" ? "账号、密码、密钥三件都要对。" : "用户名 + 密码即可，不必绑邮箱。"}
        </p>
        <div className="form" style={{ marginTop: 18 }}>
          <input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input
            placeholder="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "admin" && (
            <input
              placeholder="独立密钥"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          )}
          <div className="hint">{err}</div>
          <button className="btn btn-red btn-block" disabled={busy} onClick={() => void submit()}>
            {busy ? "请稍候…" : mode === "admin" ? "进入后台" : reg ? "注册并进入" : "登录"}
          </button>
          {mode === "user" && (
            <button className="btn btn-ghost btn-block" onClick={() => setReg((v) => !v)}>
              {reg ? "已有账号？去登录" : "没有账号？去注册"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
