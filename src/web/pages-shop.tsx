import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { ContactSheet, LiveBar, ShopChrome } from "./chrome";
import { ProductEditorSheet } from "./product-editor";
import { formatPrice, useStore } from "./store";
import type { Product } from "./types";

export function SearchBar({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <form
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(q.trim());
      }}
    >
      <span>⌕</span>
      <input placeholder="搜索" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { editMode, openEditor } = useStore();
  const first = product.prices[0];
  return (
    <div className="card-wrap">
      <Link className="prod-card" to={`/shop/p/${product.id}`}>
        {product.coverUrl ? <img src={product.coverUrl} alt="" /> : <div className="cover-ph" />}
        <span className="name">
          {product.name}
          {!product.onSale && <span className="badge">未上架</span>}
        </span>
        {first && <div className="price">{formatPrice(first.amount, first.qty, first.unit)}</div>}
      </Link>
      {editMode && (
        <button
          type="button"
          className="live-pen"
          onClick={(e) => {
            e.preventDefault();
            openEditor(product.id);
          }}
        >
          改
        </button>
      )}
    </div>
  );
}

function Banner({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (urls.length < 2) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % urls.length), 4000);
    return () => window.clearInterval(t);
  }, [urls.length]);
  if (!urls.length) return null;
  return (
    <div className="hero">
      <img src={urls[i]} alt="" />
      {urls.length > 1 && (
        <div className="hero-dots">
          {urls.map((_, idx) => (
            <i key={idx} className={idx === i ? "on" : ""} />
          ))}
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  const { boot, editMode, openEditor } = useStore();
  const nav = useNavigate();
  if (!boot)
    return (
      <ShopChrome>
        <div className="page">加载中…</div>
      </ShopChrome>
    );
  const grouped = boot.categories
    .filter((c) => c.visible || boot.preview)
    .map((cat) => ({
      cat,
      items: boot.products.filter((p) => p.categoryId === cat.id),
    }))
    .filter((g) => g.items.length || editMode);

  return (
    <ShopChrome>
      <SearchBar onSubmit={(q) => nav(`/shop/search?q=${encodeURIComponent(q)}`)} />
      <Banner urls={boot.banners.map((b) => b.imageUrl).filter((u): u is string => !!u)} />
      <div className="notice">— 通知 —</div>
      {boot.shop.notice && <div className="notice-card">{boot.shop.notice}</div>}
      {boot.shop.shopVideoUrl && (
        <div className="shop-video">
          <video src={boot.shop.shopVideoUrl} controls playsInline />
        </div>
      )}
      <div className="cat-grid">
        {boot.categories
          .filter((c) => c.visible || boot.preview)
          .map((cat) => (
            <Link className="cat-item" key={cat.id} to={`/shop/cats/${cat.id}`}>
              {cat.iconUrl ? <img src={cat.iconUrl} alt="" /> : <div className="cat-fallback">{cat.name.slice(0, 1)}</div>}
              <span>{cat.name}</span>
            </Link>
          ))}
      </div>
      {grouped.map(({ cat, items }) => (
        <section key={cat.id}>
          <div className="section-title">— {cat.name} —</div>
          <div className="prod-grid">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
            {editMode && (
              <button type="button" className="live-add" onClick={() => openEditor("new")}>
                + 上新货
              </button>
            )}
          </div>
        </section>
      ))}
      {!boot.products.length && (
        <div className="empty">
          <div>店里还没有上架商品</div>
          <div className="muted">{editMode ? "点右上角「上新货」或下面的加号" : "管理员登录后即可摆货"}</div>
          {editMode && (
            <button className="btn btn-gold" style={{ width: 160 }} onClick={() => openEditor("new")}>
              上新货
            </button>
          )}
        </div>
      )}
      <div style={{ height: 24 }} />
    </ShopChrome>
  );
}

export function CatsPage() {
  const { boot } = useStore();
  const nav = useNavigate();
  return (
    <ShopChrome title="分类">
      <SearchBar onSubmit={(q) => nav(`/shop/search?q=${encodeURIComponent(q)}`)} />
      <div className="cat-grid" style={{ paddingBottom: 24 }}>
        {(boot?.categories || [])
          .filter((c) => c.visible || boot?.preview)
          .map((cat) => (
            <Link className="cat-item" key={cat.id} to={`/shop/cats/${cat.id}`}>
              {cat.iconUrl ? <img src={cat.iconUrl} alt="" /> : <div className="cat-fallback">{cat.name.slice(0, 1)}</div>}
              <span>{cat.name}</span>
            </Link>
          ))}
      </div>
    </ShopChrome>
  );
}

export function CatListPage() {
  const { id } = useParams();
  const { boot, editMode, openEditor } = useStore();
  const cat = boot?.categories.find((c) => String(c.id) === id);
  const items = (boot?.products || []).filter((p) => String(p.categoryId) === id);
  return (
    <ShopChrome title={cat?.name || "分类"}>
      <div className="prod-grid" style={{ paddingTop: 8, paddingBottom: 24 }}>
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
        {editMode && (
          <button type="button" className="live-add" onClick={() => openEditor("new")}>
            + 上新货
          </button>
        )}
      </div>
      {!items.length && !editMode && <div className="empty">这个分类还没有商品</div>}
    </ShopChrome>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [items, setItems] = useState<Product[] | null>(null);
  useEffect(() => {
    let live = true;
    void api.search(q).then((res) => {
      if (live && res.ok) setItems(res.data);
    });
    return () => {
      live = false;
    };
  }, [q]);
  return (
    <ShopChrome title="搜索">
      <div className="page" style={{ paddingTop: 0 }}>
        <p className="muted">搜索「{q}」</p>
      </div>
      <div className="prod-grid">
        {(items || []).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {items && !items.length && <div className="empty">没有找到相关商品</div>}
    </ShopChrome>
  );
}

export function DetailPage() {
  const { id } = useParams();
  const { boot, refreshCart, openContact, editMode, openEditor, editorTarget } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [err, setErr] = useState("");
  const [idx, setIdx] = useState(0);
  const [priceId, setPriceId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [loginAsk, setLoginAsk] = useState(false);

  useEffect(() => {
    if (editorTarget) return;
    void api.product(Number(id)).then((res) => {
      if (!res.ok) setErr(res.error);
      else {
        setProduct(res.data);
        setPriceId(res.data.prices[0]?.id ?? null);
      }
    });
  }, [id, editorTarget]);

  const slides = useMemo(() => {
    if (!product) return [];
    const media = product.media.filter((m) => m.url);
    if (media.length) return media;
    if (product.coverUrl) return [{ id: 0, kind: "image" as const, url: product.coverUrl }];
    return [];
  }, [product]);

  async function add() {
    if (!product || !priceId) return;
    if (!boot?.me || boot.me.kind !== "user") {
      setLoginAsk(true);
      return;
    }
    const res = await api.addCart(product.id, priceId, 1);
    setMsg(res.ok ? "已加入购物车" : res.error);
    if (res.ok) await refreshCart();
  }

  if (err) {
    return (
      <ShopChrome>
        <div className="empty">{err}</div>
      </ShopChrome>
    );
  }
  if (!product) {
    return (
      <ShopChrome>
        <div className="page">加载中…</div>
      </ShopChrome>
    );
  }

  const slide = slides[idx];
  return (
    <div className="app-shell detail">
      <LiveBar />
      <header className="topbar">
        <Link className="icon-btn" to="/shop">
          ←
        </Link>
        <div className="brand">
          <h1>{product.name}</h1>
        </div>
        {editMode && (
          <button className="icon-btn" onClick={() => openEditor(product.id)} title="改这件货">
            改
          </button>
        )}
        <button className="icon-btn" onClick={() => openContact()}>
          客
        </button>
      </header>
      <div className="media-swiper">
        {slide?.kind === "video" ? (
          <video src={slide.url || ""} controls playsInline />
        ) : slide?.url ? (
          <img src={slide.url} alt="" />
        ) : (
          <div className="cover-ph" style={{ height: "100%" }} />
        )}
        {slides.length > 1 && (
          <div className="media-nav">
            <button className="icon-btn" onClick={() => setIdx((n) => (n - 1 + slides.length) % slides.length)}>
              ‹
            </button>
            <span>
              {idx + 1}/{slides.length}
            </span>
            <button className="icon-btn" onClick={() => setIdx((n) => (n + 1) % slides.length)}>
              ›
            </button>
          </div>
        )}
      </div>
      <div className="detail-body">
        <h2>
          {product.name}
          {!product.onSale && <span className="badge">未上架</span>}
        </h2>
        <div className="price-list">
          {product.prices.map((p) => (
            <button
              key={p.id}
              className={`price-chip ${priceId === p.id ? "on" : ""}`}
              onClick={() => setPriceId(p.id)}
            >
              {formatPrice(p.amount, p.qty, p.unit)}
            </button>
          ))}
        </div>
        <div className="section-title">商品介绍</div>
        <div className="intro">{product.intro || "暂无介绍"}</div>
        {editMode && (
          <button className="btn btn-gold" style={{ marginTop: 16 }} onClick={() => openEditor(product.id)}>
            在用户视角改这件货
          </button>
        )}
      </div>
      <div className="bottom-buy">
        <Link className="btn btn-ghost" to="/shop/cart">
          购物车
        </Link>
        <button className="btn btn-red" onClick={() => void add()}>
          {boot?.me?.kind === "user" ? "加入购物车" : "登录后加入购物车"}
        </button>
      </div>
      {msg && (
        <div className="notice-card" style={{ position: "fixed", bottom: 80, left: 16, right: 16, zIndex: 30 }}>
          {msg}
        </div>
      )}
      {loginAsk && (
        <>
          <div className="sheet-mask" onClick={() => setLoginAsk(false)} />
          <div className="sheet">
            <h3>登录后才能收藏</h3>
            <p className="muted">游客只能预览商品。登录后可加入购物车，换设备也还在。</p>
            <Link className="btn btn-red btn-block" to="/login/user">
              去登录
            </Link>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setLoginAsk(false)}>
              继续逛
            </button>
          </div>
        </>
      )}
      <ContactSheet />
      <ProductEditorSheet />
    </div>
  );
}
