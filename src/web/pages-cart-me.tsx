import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "./api";
import { ShopChrome } from "./chrome";
import { formatPrice, formatYuan, useStore } from "./store";
import { FilePick } from "./upload";

function QtyBox({ value, onCommit }: { value: number; onCommit: (qty: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit() {
    const n = Math.round(Number(text));
    if (!Number.isFinite(n) || n < 1) {
      setText(String(value));
      return;
    }
    const qty = Math.min(999, n);
    setText(String(qty));
    if (qty !== value) onCommit(qty);
  }

  return (
    <div className="stepper">
      <button type="button" onClick={() => onCommit(Math.max(1, value - 1))}>
        −
      </button>
      <input
        className="qty-input"
        inputMode="numeric"
        value={text}
        aria-label="数量"
        onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <button type="button" onClick={() => onCommit(Math.min(999, value + 1))}>
        +
      </button>
    </div>
  );
}

export function CartPage() {
  const { boot, cart, refreshCart, openContact } = useStore();
  const guest = !boot?.me || boot.me.kind !== "user";

  async function change(id: number, qty: number) {
    if (qty < 1) return;
    const res = await api.patchCart(id, qty);
    if (res.ok) await refreshCart();
  }

  async function remove(id: number) {
    await api.delCart(id);
    await refreshCart();
  }

  const total = cart.reduce((sum, item) => sum + item.amount * item.qty, 0);
  const summary = cart
    .map((item) => `${item.name} ${formatPrice(item.amount, item.packQty, item.unit)} × ${item.qty}`)
    .join("\n");

  return (
    <ShopChrome title="购物车">
      {guest ? (
        <div className="empty">
          <div className="cart-art">🛒</div>
          <div>登录后才能收藏到购物车</div>
          <Link className="btn btn-red" to="/login/user" style={{ marginTop: 12 }}>
            去登录
          </Link>
        </div>
      ) : !cart.length ? (
        <div className="empty">
          <div className="cart-art">🛒</div>
          <div>购物车空空如也</div>
        </div>
      ) : (
        <div className="page">
          {cart.map((item) => (
            <div className="cart-item" key={item.id}>
              <Link to={`/shop/p/${item.productId}`}>
                {item.coverUrl ? <img src={item.coverUrl} alt="" /> : <div className="cover-ph" />}
              </Link>
              <div>
                <div>{item.name}</div>
                <div className="price">{formatPrice(item.amount, item.packQty, item.unit)}</div>
                <div className="stepper-row">
                  <QtyBox value={item.qty} onCommit={(qty) => void change(item.id, qty)} />
                  <button type="button" className="btn btn-ghost" onClick={() => void remove(item.id)}>
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div style={{ height: 72 }} />
          <div className="cart-bar">
            <div>
              合计 <strong>{formatYuan(total)}</strong>
            </div>
            <button className="btn btn-red" onClick={() => openContact(`我想询价：\n${summary}`)}>
              联系商家
            </button>
          </div>
        </div>
      )}
    </ShopChrome>
  );
}

export function MePage() {
  const { boot, refresh, openContact } = useStore();
  const nav = useNavigate();
  const me = boot?.me;
  const [toast, setToast] = useState("");

  function orderTip() {
    setToast("请联系商家查询订单");
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <ShopChrome title="我的">
      <div className="me-head">
        {me && me.kind === "user" && me.avatarUrl ? (
          <img className="avatar" src={me.avatarUrl} alt="" />
        ) : (
          <div className="avatar">{me?.kind === "admin" ? "管" : "我"}</div>
        )}
        <div>
          <strong>
            {me?.kind === "user" ? me.username : me?.kind === "admin" ? "管理员" : "我是昵称"}
          </strong>
          {me?.kind === "user" ? (
            <p>ID：{me.id}</p>
          ) : me?.kind === "admin" ? (
            <p>可进入用户视角摆货</p>
          ) : (
            <p>
              <Link to="/login/user" style={{ color: "#fff" }}>
                请先登录 ›
              </Link>
            </p>
          )}
        </div>
      </div>
      <div className="order-row">
        {["待付款", "待发货", "待收货", "已完成", "售后"].map((label) => (
          <button key={label} onClick={orderTip}>
            <div className="dot-icon">▢</div>
            {label}
          </button>
        ))}
      </div>
      <div className="page" style={{ paddingTop: 8 }}>
        <h3 style={{ fontFamily: '"Noto Serif SC", serif' }}>更多服务</h3>
        <div className="service-grid">
          <button onClick={() => openContact()}>
            <div className="dot-icon">☎</div>
            联系我们
          </button>
          {me?.kind === "user" && (
            <Link to="/shop/me/edit">
              <div className="dot-icon">✎</div>
              个人资料
            </Link>
          )}
          {me?.kind === "admin" && (
            <Link to="/admin">
              <div className="dot-icon">⚙</div>
              管理后台
            </Link>
          )}
        </div>
        {me && (
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: 24 }}
            onClick={async () => {
              await api.logout();
              await refresh();
              nav("/");
            }}
          >
            退出登录
          </button>
        )}
      </div>
      {toast && (
        <div className="notice-card" style={{ position: "fixed", bottom: 90, left: 16, right: 16, zIndex: 30 }}>
          {toast}
        </div>
      )}
    </ShopChrome>
  );
}

export function ProfilePage() {
  const { boot, refresh } = useStore();
  const nav = useNavigate();
  const me = boot?.me?.kind === "user" ? boot.me : null;
  const [username, setUsername] = useState(me?.username || "");
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [avatarKey, setAvatarKey] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl || "");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  if (!me) {
    return (
      <ShopChrome title="个人资料">
        <div className="empty">
          请先登录
          <Link className="btn btn-red" to="/login/user">
            去登录
          </Link>
        </div>
      </ShopChrome>
    );
  }

  async function save() {
    setErr("");
    setOk("");
    const body: Record<string, string> = { username };
    if (avatarKey) body.avatarKey = avatarKey;
    if (password) {
      body.oldPassword = oldPassword;
      body.password = password;
    }
    const res = await api.saveProfile(body);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setOk("已保存");
    setPassword("");
    setOldPassword("");
    await refresh();
  }

  return (
    <ShopChrome title="个人资料">
      <div className="page">
        <button className="btn btn-ghost" onClick={() => nav(-1)}>
          返回
        </button>
        <div className="form" style={{ marginTop: 16 }}>
          <FilePick
            label={avatarUrl ? "更换头像" : "上传头像"}
            maxEdge={512}
            onDone={(d) => {
              setAvatarKey(d.key);
              setAvatarUrl(d.url);
            }}
          />
          {avatarUrl && (
            <img src={avatarUrl} alt="" style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto" }} />
          )}
          <input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input
            placeholder="旧密码（改密码时必填）"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <input
            placeholder="新密码（不改请留空）"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="hint">{err}</div>
          {ok && <div className="muted">{ok}</div>}
          <button className="btn btn-red btn-block" onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </ShopChrome>
  );
}
