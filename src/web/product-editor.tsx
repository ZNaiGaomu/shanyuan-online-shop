import { useEffect, useState } from "react";
import { api } from "./api";
import { useStore } from "./store";
import { FilePick } from "./upload";

type DraftPrice = { amount: string; qty: string; unit: string };
type DraftMedia = { kind: "image" | "video"; objectKey: string; url: string };

function editAt<T>(list: T[], index: number, next: T): T[] {
  return list.map((item, i) => (i === index ? next : item));
}

export function ProductEditorForm({
  productId,
  onSaved,
  onCancel,
}: {
  productId: number | "new";
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { boot, refresh } = useStore();
  const isNew = productId === "new";
  const [loading, setLoading] = useState(!isNew);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [coverKey, setCoverKey] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [intro, setIntro] = useState("");
  const [onSale, setOnSale] = useState(true);
  const [sort, setSort] = useState("0");
  const [prices, setPrices] = useState<DraftPrice[]>([{ amount: "", qty: "1", unit: "个" }]);
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (isNew) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void api.product(productId).then((res) => {
      if (!live) return;
      if (!res.ok) {
        setMsg(res.error);
        setLoading(false);
        return;
      }
      const p = res.data;
      setName(p.name);
      setCategoryId(String(p.categoryId));
      setCoverKey(p.coverKey || "");
      setCoverUrl(p.coverUrl || "");
      setIntro(p.intro);
      setOnSale(p.onSale);
      setSort(String(p.sort));
      setPrices(
        p.prices.length
          ? p.prices.map((x) => ({ amount: String(x.amount), qty: String(x.qty), unit: x.unit }))
          : [{ amount: "", qty: "1", unit: "个" }],
      );
      setMedia(
        p.media
          .filter((m) => m.objectKey || m.url)
          .map((m) => ({
            kind: m.kind,
            objectKey: m.objectKey || "",
            url: m.url || "",
          })),
      );
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [productId, isNew]);

  useEffect(() => {
    if (!isNew) return;
    const first = boot?.categories[0];
    if (first) setCategoryId((cur) => cur || String(first.id));
  }, [isNew, boot]);

  function payload() {
    return {
      name,
      categoryId: Number(categoryId),
      coverKey,
      intro,
      onSale,
      sort: Number(sort) || 0,
      prices: prices
        .filter((p) => p.amount && p.qty)
        .map((p) => ({ amount: Number(p.amount), qty: Number(p.qty), unit: p.unit || "个" })),
      media: media.filter((m) => m.objectKey).map((m) => ({ kind: m.kind, objectKey: m.objectKey })),
    };
  }

  async function save() {
    setBusy(true);
    setMsg("");
    const body = payload();
    const res = isNew ? await api.addProduct(body) : await api.saveProduct(productId, body);
    setBusy(false);
    setMsg(res.ok ? "已保存，前台马上能看到" : res.error);
    if (res.ok) {
      await refresh();
      onSaved();
    }
  }

  async function remove() {
    if (isNew) return;
    if (!window.confirm("确定删除这个商品？")) return;
    const res = await api.delProduct(productId);
    if (res.ok) {
      await refresh();
      onSaved();
    } else setMsg(res.error);
  }

  if (loading) return <div className="muted">读取商品…</div>;

  return (
    <div className="form">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="底部名称 / 商品名" />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">选择分类</option>
        {(boot?.categories || []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <FilePick
        label={coverUrl ? "更换封面" : "上传封面"}
        onDone={(d) => {
          setCoverKey(d.key);
          setCoverUrl(d.url);
        }}
      />
      {coverUrl && <img src={coverUrl} alt="" style={{ width: "100%", borderRadius: 12 }} />}
      <label className="check-row">
        <input type="checkbox" checked={onSale} onChange={(e) => setOnSale(e.target.checked)} /> 上架（关掉则顾客看不到）
      </label>
      <input value={sort} onChange={(e) => setSort(e.target.value)} placeholder="排序，数字越小越靠前" />
      <h3>报价（金额 + 数量，例如 100元 5个）</h3>
      {prices.map((p, i) => (
        <div key={i} className="price-edit">
          <input
            value={p.amount}
            onChange={(e) => setPrices(editAt(prices, i, { ...p, amount: e.target.value }))}
            placeholder="金额"
            inputMode="decimal"
          />
          <input
            value={p.qty}
            onChange={(e) => setPrices(editAt(prices, i, { ...p, qty: e.target.value }))}
            placeholder="数量"
            inputMode="numeric"
          />
          <input
            value={p.unit}
            onChange={(e) => setPrices(editAt(prices, i, { ...p, unit: e.target.value }))}
            placeholder="单位"
          />
          <button type="button" className="btn btn-ghost" onClick={() => setPrices(prices.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={() => setPrices([...prices, { amount: "", qty: "1", unit: "个" }])}>
        加一条报价
      </button>
      <h3>详情图 / 视频</h3>
      <FilePick
        label="加一张图"
        onDone={(d) => setMedia([...media, { kind: "image", objectKey: d.key, url: d.url }])}
      />
      <FilePick
        label="加一段视频"
        kind="video"
        onDone={(d) => setMedia([...media, { kind: "video", objectKey: d.key, url: d.url }])}
      />
      <div className="thumb-row">
        {media.map((m, i) => (
          <div key={i}>
            {m.kind === "video" ? <video src={m.url} /> : <img src={m.url} alt="" />}
            <button type="button" className="btn btn-ghost" onClick={() => setMedia(media.filter((_, j) => j !== i))}>
              删
            </button>
          </div>
        ))}
      </div>
      <textarea value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="商品介绍，顾客点进详情能看到" />
      <div className="hint">{msg}</div>
      <button className="btn btn-gold" disabled={busy} onClick={() => void save()}>
        {busy ? "保存中…" : "保存商品"}
      </button>
      {onCancel && (
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          取消
        </button>
      )}
      {!isNew && (
        <button type="button" className="btn btn-ghost" onClick={() => void remove()}>
          删除商品
        </button>
      )}
    </div>
  );
}

export function ProductEditorSheet() {
  const { editorTarget, closeEditor } = useStore();
  if (!editorTarget) return null;
  return (
    <>
      <div className="sheet-mask" onClick={closeEditor} />
      <div className="sheet editor">
        <h3>{editorTarget === "new" ? "上新货" : "改这件货"}</h3>
        <p className="muted">你现在改的就是顾客看到的样子。封面、名称、价格、介绍都可以在这里动。</p>
        <ProductEditorForm key={String(editorTarget)} productId={editorTarget} onSaved={closeEditor} onCancel={closeEditor} />
      </div>
    </>
  );
}
