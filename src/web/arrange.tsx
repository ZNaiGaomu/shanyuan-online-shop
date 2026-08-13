import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { api } from "./api";
import { useStore } from "./store";
import type { Product } from "./types";

export type LayoutItem = { id: number; categoryId: number; sort: number };
type Drop = { categoryId: number; beforeId: number | null };

type DragVisual = {
  id: number;
  name: string;
  coverUrl: string | null;
  x: number;
  y: number;
};

type Start = {
  id: number;
  name: string;
  coverUrl: string | null;
  x: number;
  y: number;
  pointerId: number | "touch";
  moved: boolean;
};

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

export function sortProducts(list: Product[]) {
  return list.slice().sort((a, b) => a.sort - b.sort || a.id - b.id);
}

export function placeProduct(
  products: Product[],
  dragId: number,
  categoryId: number,
  beforeId: number | null,
): LayoutItem[] | null {
  const moving = products.find((p) => Number(p.id) === Number(dragId));
  if (!moving) return null;
  const destCat = Number(categoryId);
  const fromCat = Number(moving.categoryId);
  const before = beforeId == null ? null : Number(beforeId);

  if (before != null && fromCat === destCat) {
    const shelf = sortProducts(products.filter((p) => Number(p.categoryId) === destCat));
    const from = shelf.findIndex((p) => Number(p.id) === Number(dragId));
    const to = shelf.findIndex((p) => Number(p.id) === before);
    if (from < 0 || to < 0 || from === to) return null;
    const next = [...shelf];
    const a = next[from];
    const b = next[to];
    next[from] = b;
    next[to] = a;
    return next.map((p, i) => ({ id: Number(p.id), categoryId: destCat, sort: i }));
  }

  const target = sortProducts(
    products.filter((p) => Number(p.categoryId) === destCat && Number(p.id) !== Number(dragId)),
  );
  let insertAt = target.length;
  if (before != null) {
    const idx = target.findIndex((p) => Number(p.id) === before);
    if (idx >= 0) insertAt = idx;
  }
  if (fromCat === destCat && insertAt === target.length) {
    const from = sortProducts(products.filter((p) => Number(p.categoryId) === destCat)).findIndex(
      (p) => Number(p.id) === Number(dragId),
    );
    if (from === target.length) return null;
  }
  const nextTarget = [...target];
  nextTarget.splice(insertAt, 0, { ...moving, categoryId: destCat });
  const updates: LayoutItem[] = nextTarget.map((p, i) => ({ id: Number(p.id), categoryId: destCat, sort: i }));
  if (fromCat !== destCat) {
    const source = sortProducts(
      products.filter((p) => Number(p.categoryId) === fromCat && Number(p.id) !== Number(dragId)),
    );
    source.forEach((p, i) => updates.push({ id: Number(p.id), categoryId: fromCat, sort: i }));
  }
  return updates;
}

function nearestProduct(categoryId: number, x: number, y: number, dragId: number): number | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-drop-product][data-drop-shelf="${categoryId}"]`);
  let bestId: number | null = null;
  let best = Infinity;
  nodes.forEach((node) => {
    const id = Number(node.dataset.dropProduct);
    if (id === dragId || !Number.isFinite(id)) return;
    const r = node.getBoundingClientRect();
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d < best) {
      best = d;
      bestId = id;
    }
  });
  return bestId != null && best < 160 ? bestId : null;
}

function hitDrop(x: number, y: number, dragId: number): Drop | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (!(el instanceof Element) || el.closest(".arrange-ghost")) continue;
    const prod = el.closest("[data-drop-product]");
    if (prod instanceof HTMLElement) {
      const id = Number(prod.dataset.dropProduct);
      const categoryId = Number(prod.dataset.dropShelf);
      if (id === dragId) continue;
      if (Number.isFinite(id) && Number.isFinite(categoryId)) return { categoryId, beforeId: id };
    }
    const shelf = el.closest("[data-drop-shelf]");
    if (shelf instanceof HTMLElement) {
      const categoryId = Number(shelf.dataset.dropShelf);
      if (!Number.isFinite(categoryId)) continue;
      return { categoryId, beforeId: nearestProduct(categoryId, x, y, dragId) };
    }
  }
  return null;
}

function eventPoint(e: Event): { x: number; y: number; pointerId: number | "touch" } | null {
  if (e instanceof PointerEvent) return { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  if (window.TouchEvent && e instanceof TouchEvent) {
    const t = e.changedTouches[0] || e.touches[0];
    if (!t) return null;
    return { x: t.clientX, y: t.clientY, pointerId: "touch" };
  }
  return null;
}

export function useArrange() {
  const { boot, editMode, applyLayout, refresh } = useStore();
  const productsRef = useRef(boot?.products ?? []);
  productsRef.current = boot?.products ?? [];
  const catsRef = useRef(boot?.categories ?? []);
  catsRef.current = boot?.categories ?? [];

  const [drag, setDrag] = useState<DragVisual | null>(null);
  const [overKey, setOverKey] = useState("");
  const [hint, setHint] = useState("");
  const startRef = useRef<Start | null>(null);
  const lastDropRef = useRef<Drop | null>(null);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);

  const finish = useCallback(
    async (x: number, y: number) => {
      const start = startRef.current;
      startRef.current = null;
      const didMove = Boolean(start?.moved);
      if (didMove) suppressClickRef.current = true;
      document.body.classList.remove("is-arranging");
      setDrag(null);
      setOverKey("");
      if (!didMove || !start) {
        lastDropRef.current = null;
        return;
      }
      const drop = lastDropRef.current || hitDrop(x, y, start.id);
      lastDropRef.current = null;
      if (!drop) {
        setHint("没有放到货品或货架上，再拖一次");
        return;
      }
      const items = placeProduct(productsRef.current, start.id, drop.categoryId, drop.beforeId);
      if (!items) {
        setHint("位置没有变化，拖到另一件货或别的货架上再松手");
        return;
      }
      applyLayout(items);
      const catName = catsRef.current.find((c) => Number(c.id) === Number(drop.categoryId))?.name || "新货架";
      const sameShelf = productsRef.current.some(
        (p) => Number(p.id) === start.id && Number(p.categoryId) === Number(drop.categoryId),
      );
      const res = await api.saveLayout(items);
      if (!res.ok) {
        setHint(res.error || "摆放保存失败");
        await refresh();
        return;
      }
      setHint(sameShelf && drop.beforeId ? "已交换位置" : `已放到「${catName}」`);
      await refresh();
    },
    [applyLayout, refresh],
  );

  useEffect(() => {
    if (!editMode) return;

    function matches(e: Event) {
      const start = startRef.current;
      if (!start) return false;
      if (e instanceof PointerEvent) return start.pointerId === e.pointerId || start.pointerId === "touch";
      return true;
    }

    function onMove(e: Event) {
      const start = startRef.current;
      const pt = eventPoint(e);
      if (!start || !pt || !matches(e)) return;
      lastPointRef.current = { x: pt.x, y: pt.y };
      if (!start.moved) {
        if (dist(pt.x, pt.y, start.x, start.y) < 5) return;
        start.moved = true;
        document.body.classList.add("is-arranging");
        setDrag({ id: start.id, name: start.name, coverUrl: start.coverUrl, x: pt.x, y: pt.y });
      }
      if ("cancelable" in e && e.cancelable) e.preventDefault();
      const drop = hitDrop(pt.x, pt.y, start.id);
      lastDropRef.current = drop;
      setOverKey(drop ? `${drop.categoryId}:${drop.beforeId ?? "end"}` : "");
      setDrag((cur) => (cur ? { ...cur, x: pt.x, y: pt.y } : cur));
    }

    function onEnd(e: Event) {
      if (e.type === "pointercancel") return;
      const start = startRef.current;
      if (!start || !matches(e)) return;
      const pt = eventPoint(e) || lastPointRef.current;
      void finish(pt.x, pt.y);
    }

    function onClick(e: MouseEvent) {
      if (!suppressClickRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }

    function onNativeDrag(e: DragEvent) {
      e.preventDefault();
    }

    const moveOpts: AddEventListenerOptions = { capture: true, passive: false };
    window.addEventListener("pointermove", onMove, moveOpts);
    window.addEventListener("touchmove", onMove, moveOpts);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
    window.addEventListener("touchend", onEnd, true);
    window.addEventListener("touchcancel", onEnd, true);
    window.addEventListener("click", onClick, true);
    document.addEventListener("dragstart", onNativeDrag, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("touchmove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      window.removeEventListener("touchend", onEnd, true);
      window.removeEventListener("touchcancel", onEnd, true);
      window.removeEventListener("click", onClick, true);
      document.removeEventListener("dragstart", onNativeDrag, true);
      document.body.classList.remove("is-arranging");
    };
  }, [editMode, finish]);

  function begin(product: Product, x: number, y: number, pointerId: number | "touch") {
    if (!editMode) return;
    if (startRef.current?.moved) return;
    lastDropRef.current = null;
    lastPointRef.current = { x, y };
    startRef.current = {
      id: product.id,
      name: product.name,
      coverUrl: product.coverUrl,
      x,
      y,
      pointerId,
      moved: false,
    };
  }

  function productBind(product: Product) {
    if (!editMode) return { className: "card-wrap" };
    return {
      className: `card-wrap arrange-item${drag?.id === product.id ? " arrange-lift" : ""}${
        overKey === `${product.categoryId}:${product.id}` ? " arrange-over" : ""
      }`,
      "data-drop-product": String(product.id),
      "data-drop-shelf": String(product.categoryId),
      draggable: false,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).closest(".live-pen")) return;
        if (e.button !== 0) return;
        begin(product, e.clientX, e.clientY, e.pointerId);
      },
      onTouchStart: (e: ReactTouchEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).closest(".live-pen")) return;
        const t = e.touches[0];
        if (!t) return;
        begin(product, t.clientX, t.clientY, "touch");
      },
    };
  }

  function shelfBind(categoryId: number, extraClass = "") {
    if (!editMode) return extraClass ? { className: extraClass } : {};
    const over = overKey === `${categoryId}:end`;
    return {
      "data-drop-shelf": String(categoryId),
      className: `${extraClass}${over ? " arrange-over" : ""}`.trim(),
    };
  }

  const ghost = drag ? (
    <div className="arrange-ghost" style={{ left: drag.x - 38, top: drag.y - 96 }}>
      {drag.coverUrl ? <img src={drag.coverUrl} alt="" draggable={false} /> : <div className="cover-ph" />}
      <span>{drag.name}</span>
    </div>
  ) : null;

  return { productBind, shelfBind, bindProduct: productBind, bindShelf: shelfBind, ghost, err: hint };
}

export function ArrangeHint({ err }: { err?: string }) {
  const { editMode } = useStore();
  if (!editMode) return null;
  return (
    <p className={`arrange-hint${err ? (err.startsWith("已") ? " is-ok" : " is-err") : ""}`}>
      {err || "按住左上角「拖」或按住图片，拖到另一件货上松手换位；拖到下面货架或上方分类松手换架。"}
    </p>
  );
}

export function ArrangeGhost({ ghost }: { ghost: ReactNode }) {
  return <>{ghost}</>;
}
