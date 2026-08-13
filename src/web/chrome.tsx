import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ProductEditorSheet } from "./product-editor";
import { enterShopAsAdmin, useStore } from "./store";

export function TabBar() {
  return (
    <nav className="tabbar">
      <NavLink to="/shop" end className={({ isActive }) => (isActive ? "on" : "")}>
        <HomeIcon />
        商城
      </NavLink>
      <NavLink to="/shop/cats" className={({ isActive }) => (isActive ? "on" : "")}>
        <GridIcon />
        分类
      </NavLink>
      <NavLink to="/shop/cart" className={({ isActive }) => (isActive ? "on" : "")}>
        <CartIcon />
        购物车
      </NavLink>
      <NavLink to="/shop/me" className={({ isActive }) => (isActive ? "on" : "")}>
        <MeIcon />
        我的
      </NavLink>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3.2 3 11h2v9h6v-6h2v6h6v-9h2L12 3.2z" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6.2 6l.8 2h12.3l-1.6 7H8.1L6.2 6zM5 4H2v2h2.2l.7 1.8L3.4 16H20v-2H7.8l.3-1.2h10.9L21 6H6.8L6.2 4H5z" />
    </svg>
  );
}
function MeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
    </svg>
  );
}

export function ContactSheet() {
  const { boot, contactOpen, contactExtra, closeContact } = useStore();
  if (!contactOpen || !boot) return null;
  const c = boot.shop.contact;
  return (
    <>
      <div className="sheet-mask" onClick={closeContact} />
      <div className="sheet">
        <h3>联系商家</h3>
        {c.name && <div className="contact-row">联系人：{c.name}</div>}
        {c.phone && (
          <div className="contact-row">
            电话：<a href={`tel:${c.phone}`}>{c.phone}</a>
          </div>
        )}
        {c.wechat && <div className="contact-row">微信：{c.wechat}</div>}
        {c.hours && <div className="contact-row">时间：{c.hours}</div>}
        {c.address && <div className="contact-row">地址：{c.address}</div>}
        {c.note && <div className="contact-row muted">{c.note}</div>}
        {c.qrUrl && <img className="qr" src={c.qrUrl} alt="微信二维码" />}
        {contactExtra && (
          <div className="notice-card" style={{ margin: "12px 0 0" }}>
            {contactExtra}
          </div>
        )}
        {!c.phone && !c.wechat && <p className="muted">管理员还没填写电话或微信。可在后台「客服」里补上。</p>}
        <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={closeContact}>
          关闭
        </button>
      </div>
    </>
  );
}

export function LiveBar() {
  const { boot, editMode, setEditMode, openEditor } = useStore();
  const nav = useNavigate();
  if (boot?.me?.kind !== "admin") return null;
  return (
    <div className="live-bar">
      <span>{editMode ? "摆货中 · 顾客看不到这些按钮" : "用户视角 · 和顾客看到的一样"}</span>
      <button type="button" onClick={() => setEditMode(!editMode)}>
        {editMode ? "退出摆货" : "开始摆货"}
      </button>
      {editMode && (
        <button type="button" onClick={() => openEditor("new")}>
          上新货
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          enterShopAsAdmin(false);
          nav("/admin");
        }}
      >
        回后台
      </button>
    </div>
  );
}

export function ShopChrome({ children, title }: { children: ReactNode; title?: string }) {
  const { boot, openContact } = useStore();
  const name = boot?.shop.shopName || "善愿日用品店（零售/批发）";
  return (
    <div className="app-shell">
      <LiveBar />
      <header className="topbar">
        <div className="brand">
          {boot?.shop.shopLogoUrl ? (
            <img className="brand-mark" src={boot.shop.shopLogoUrl} alt="" />
          ) : (
            <div className="brand-mark">善</div>
          )}
          <h1>{title || name}</h1>
        </div>
        <button className="icon-btn" onClick={() => openContact()} title="客服">
          客
        </button>
      </header>
      {children}
      <TabBar />
      <ContactSheet />
      <ProductEditorSheet />
    </div>
  );
}
