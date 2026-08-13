import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "./api";
import { ProductEditorForm } from "./product-editor";
import { enterShopAsAdmin, formatPrice, useStore } from "./store";
import type { Category } from "./types";
import { FilePick } from "./upload";

function AdminShell({ children, tab }: { children: ReactNode; tab: string }) {
  const { boot, loading, setEditMode, refresh } = useStore();
  const nav = useNavigate();
  if (loading)
    return (
      <div className="app-shell">
        <div className="page">加载中…</div>
      </div>
    );
  if (boot?.me?.kind !== "admin") return <Navigate to="/login/admin" replace />;

  function goLive(edit: boolean) {
    enterShopAsAdmin(edit);
    setEditMode(edit);
    nav("/shop");
  }

  async function logout() {
    await api.logout();
    await refresh();
    nav("/");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">管</div>
          <h1>店铺后台</h1>
          <button type="button" className="logout-inline" onClick={() => void logout()}>
            退出登录
          </button>
        </div>
        <button className="icon-btn" title="用户视角" onClick={() => goLive(true)}>
          看
        </button>
      </header>
      <div className="live-jump">
        <button className="btn btn-gold" onClick={() => goLive(true)}>
          进入用户视角摆货
        </button>
        <p className="muted">到商城页直接改封面、名称、价格和介绍，看到的就是顾客看到的。</p>
      </div>
      <nav className="admin-nav">
        <Link className={tab === "shop" ? "on" : ""} to="/admin">
          店铺
        </Link>
        <Link className={tab === "contact" ? "on" : ""} to="/admin/contact">
          客服
        </Link>
        <Link className={tab === "cats" ? "on" : ""} to="/admin/cats">
          分类
        </Link>
        <Link className={tab === "products" ? "on" : ""} to="/admin/products">
          商品
        </Link>
        <Link className={tab === "users" ? "on" : ""} to="/admin/users">
          客户
        </Link>
        <Link className={tab === "account" ? "on" : ""} to="/admin/account">
          账号
        </Link>
      </nav>
      <div className="page">{children}</div>
    </div>
  );
}

export function AdminShopPage() {
  const { boot, refresh } = useStore();
  const shop = boot?.shop;
  const [name, setName] = useState(shop?.shopName || "");
  const [notice, setNotice] = useState(shop?.notice || "");
  const [logoKey, setLogoKey] = useState("");
  const [logoUrl, setLogoUrl] = useState(shop?.shopLogoUrl || "");
  const [videoKey, setVideoKey] = useState("");
  const [videoUrl, setVideoUrl] = useState(shop?.shopVideoUrl || "");
  const [msg, setMsg] = useState("");

  async function save() {
    const body: Record<string, string> = { shop_name: name, notice };
    if (logoKey) body.shop_logo_key = logoKey;
    if (videoKey) body.shop_video_key = videoKey;
    const res = await api.saveConfig(body);
    setMsg(res.ok ? "已保存店铺资料" : res.error);
    if (res.ok) await refresh();
  }

  async function addBanner(key: string) {
    const res = await api.addBanner(key, (boot?.banners.length || 0) + 1);
    if (res.ok) await refresh();
    else setMsg(res.error);
  }

  return (
    <AdminShell tab="shop">
      <div className="form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="店名" />
        <textarea value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="通知公告" />
        <FilePick
          label={logoUrl ? "更换店标" : "上传店标"}
          maxEdge={512}
          onDone={(d) => {
            setLogoKey(d.key);
            setLogoUrl(d.url);
          }}
        />
        {logoUrl && <img src={logoUrl} alt="" style={{ width: 64, height: 64, borderRadius: "50%" }} />}
        <FilePick
          label={videoUrl ? "更换首页视频" : "上传首页视频"}
          kind="video"
          onDone={(d) => {
            setVideoKey(d.key);
            setVideoUrl(d.url);
          }}
        />
        {videoUrl && <video src={videoUrl} controls style={{ width: "100%", borderRadius: 12 }} />}
        <button className="btn btn-gold" onClick={() => void save()}>
          保存店铺
        </button>
        <div className="muted">{msg}</div>
      </div>
      <h3>轮播图</h3>
      <FilePick label="新增一张轮播" onDone={(d) => void addBanner(d.key)} />
      <div className="thumb-row">
        {boot?.banners.map((b) => (
          <div key={b.id}>
            {b.imageUrl && <img src={b.imageUrl} alt="" />}
            <button className="btn btn-ghost" onClick={() => void api.delBanner(b.id).then(() => refresh())}>
              删除
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

export function AdminContactPage() {
  const { boot, refresh } = useStore();
  const c = boot?.shop.contact;
  const [name, setName] = useState(c?.name || "");
  const [phone, setPhone] = useState(c?.phone || "");
  const [wechat, setWechat] = useState(c?.wechat || "");
  const [hours, setHours] = useState(c?.hours || "");
  const [address, setAddress] = useState(c?.address || "");
  const [note, setNote] = useState(c?.note || "");
  const [qrKey, setQrKey] = useState("");
  const [qrUrl, setQrUrl] = useState(c?.qrUrl || "");
  const [msg, setMsg] = useState("");

  async function save() {
    const body: Record<string, string> = {
      contact_name: name,
      contact_phone: phone,
      contact_wechat: wechat,
      contact_hours: hours,
      contact_address: address,
      contact_note: note,
    };
    if (qrKey) body.contact_qr_key = qrKey;
    const res = await api.saveConfig(body);
    setMsg(res.ok ? "客服资料已保存" : res.error);
    if (res.ok) await refresh();
  }

  return (
    <AdminShell tab="contact">
      <div className="form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="联系人" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="手机号" />
        <input value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="微信号" />
        <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="营业时间" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="地址" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="补充说明" />
        <FilePick
          label={qrUrl ? "更换微信二维码" : "上传微信二维码"}
          onDone={(d) => {
            setQrKey(d.key);
            setQrUrl(d.url);
          }}
        />
        {qrUrl && <img className="qr" src={qrUrl} alt="" />}
        <button className="btn btn-gold" onClick={() => void save()}>
          保存客服
        </button>
        <div className="muted">{msg}</div>
      </div>
    </AdminShell>
  );
}

export function AdminCatsPage() {
  const { boot, refresh } = useStore();
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [msg, setMsg] = useState("");

  async function add() {
    const res = await api.addCategory({
      name,
      iconKey,
      sort: (boot?.categories.length || 0) + 1,
      visible: true,
    });
    setMsg(res.ok ? "已添加分类" : res.error);
    if (res.ok) {
      setName("");
      setIconKey("");
      setIconUrl("");
      await refresh();
    }
  }

  async function toggle(cat: Category) {
    await api.saveCategory(cat.id, { visible: !cat.visible });
    await refresh();
  }

  async function remove(cat: Category) {
    const res = await api.delCategory(cat.id);
    setMsg(res.ok ? "已删除" : res.error);
    if (res.ok) await refresh();
  }

  return (
    <AdminShell tab="cats">
      <div className="form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新分类名称" />
        <FilePick
          label={iconUrl ? "已选图标" : "分类图标"}
          maxEdge={512}
          onDone={(d) => {
            setIconKey(d.key);
            setIconUrl(d.url);
          }}
        />
        {iconUrl && <img src={iconUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8 }} />}
        <button className="btn btn-gold" onClick={() => void add()}>
          添加分类
        </button>
        <div className="muted">{msg}</div>
      </div>
      {(boot?.categories || []).map((cat) => (
        <div className="admin-card" key={cat.id}>
          <strong>{cat.name}</strong>
          <div className="muted">{cat.visible ? "显示中" : "已隐藏"}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => void toggle(cat)}>
              {cat.visible ? "隐藏" : "显示"}
            </button>
            <button className="btn btn-ghost" onClick={() => void remove(cat)}>
              删除
            </button>
          </div>
        </div>
      ))}
    </AdminShell>
  );
}

export function AdminProductsPage() {
  const { boot } = useStore();
  return (
    <AdminShell tab="products">
      <Link className="btn btn-gold btn-block" to="/admin/products/new">
        新增商品
      </Link>
      <div style={{ height: 12 }} />
      {(boot?.products || []).map((p) => (
        <Link className="admin-card" key={p.id} to={`/admin/products/${p.id}`} style={{ display: "block" }}>
          <strong>{p.name}</strong>
          {!p.onSale && <span className="badge">未上架</span>}
          <div className="muted">
            {p.prices[0] ? formatPrice(p.prices[0].amount, p.prices[0].qty, p.prices[0].unit) : "无报价"}
          </div>
        </Link>
      ))}
    </AdminShell>
  );
}

export function AdminProductEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = id === "new";
  return (
    <AdminShell tab="products">
      <ProductEditorForm
        productId={isNew || !id ? "new" : Number(id)}
        onSaved={() => nav("/admin/products")}
        onCancel={() => nav("/admin/products")}
      />
    </AdminShell>
  );
}

export function AdminUsersPage() {
  const [rows, setRows] = useState<
    { id: number; username: string; nickname: string | null; created_at: string; cart_count: number }[]
  >([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [cart, setCart] = useState<{ id: number; name: string; qty: number; amount: number; packQty: number; unit: string }[]>(
    [],
  );
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPass, setNewPass] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void api.users().then((res) => {
      if (res.ok) setRows(res.data);
    });
  }, []);

  async function toggleCart(id: number) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    const res = await api.userCart(id);
    if (res.ok) {
      setCart(res.data);
      setOpenId(id);
    }
  }

  async function resetPassword(id: number) {
    setMsg("");
    const res = await api.resetUserPassword(id, newPass);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg(`已重置 @${res.data.username} 的密码。用户名没变，请把新密码告诉对方。`);
    setResetId(null);
    setNewPass("");
  }

  return (
    <AdminShell tab="users">
      <p className="muted">用户名不能替客户改。忘记密码时，在这里设一个新密码即可。</p>
      {msg && <div className="notice-card">{msg}</div>}
      {rows.map((u) => (
        <div className="admin-card" key={u.id}>
          <strong>{u.username}</strong>
          <div className="muted">ID {u.id} · 注册 {u.created_at} · 购物车 {u.cart_count} 件</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={() => void toggleCart(u.id)}>
              {openId === u.id ? "收起意向" : "查看购物车"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setResetId(u.id);
                setNewPass("");
              }}
            >
              重置密码
            </button>
          </div>
          {resetId === u.id && (
            <div className="form" style={{ marginTop: 10 }}>
              <input
                type="text"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="新密码，至少 6 位"
              />
              <button className="btn btn-gold" onClick={() => void resetPassword(u.id)}>
                确认重置
              </button>
            </div>
          )}
          {openId === u.id && (
            <div style={{ marginTop: 8 }}>
              {cart.length ? (
                cart.map((item) => (
                  <div key={item.id} className="muted">
                    {item.name} · {formatPrice(item.amount, item.packQty, item.unit)} × {item.qty}
                  </div>
                ))
              ) : (
                <div className="muted">购物车是空的</div>
              )}
            </div>
          )}
        </div>
      ))}
      {!rows.length && <div className="muted">还没有注册客户</div>}
    </AdminShell>
  );
}

export function AdminAccountPage() {
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentSecret, setCurrentSecret] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void api.adminAccount().then((res) => {
      if (res.ok) setUsername(res.data.username);
    });
  }, []);

  async function save() {
    setMsg("");
    const res = await api.saveAdminAccount({
      currentPassword,
      currentSecret,
      username,
      password: password || undefined,
      secret: secret || undefined,
    });
    setMsg(res.ok ? "已更新。下次登录用新账号 / 密码 / 密钥。" : res.error);
    if (res.ok) {
      setCurrentPassword("");
      setCurrentSecret("");
      setPassword("");
      setSecret("");
    }
  }

  return (
    <AdminShell tab="account">
      <p className="muted">改管理员登录账号、密码、独立密钥。必须先核对当前密码和密钥。</p>
      <div className="form">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="管理员账号" />
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="当前密码（必填）"
        />
        <input
          type="password"
          value={currentSecret}
          onChange={(e) => setCurrentSecret(e.target.value)}
          placeholder="当前密钥（必填）"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="新密码（不改请留空）"
        />
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="新密钥（不改请留空）"
        />
        <div className="hint">{msg}</div>
        <button className="btn btn-gold" onClick={() => void save()}>
          保存账号
        </button>
      </div>
    </AdminShell>
  );
}
