import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Bootstrap, CartItem, EditorTarget } from "./types";

const EDIT_KEY = "sy_edit";

type Store = {
  boot: Bootstrap | null;
  loading: boolean;
  contactOpen: boolean;
  contactExtra: string;
  cart: CartItem[];
  editMode: boolean;
  editorTarget: EditorTarget;
  refresh: () => Promise<void>;
  refreshCart: () => Promise<void>;
  openContact: (extra?: string) => void;
  closeContact: () => void;
  setEditMode: (on: boolean) => void;
  openEditor: (id: number | "new") => void;
  closeEditor: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactExtra, setContactExtra] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editMode, setEditModeState] = useState(() => sessionStorage.getItem(EDIT_KEY) === "1");
  const [editorTarget, setEditorTarget] = useState<EditorTarget>(null);

  async function refresh() {
    const res = await api.bootstrap();
    if (res.ok) setBoot(res.data);
    setLoading(false);
  }

  async function refreshCart() {
    const res = await api.cart();
    if (res.ok) setCart(res.data);
    else setCart([]);
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (boot?.me?.kind === "user") void refreshCart();
    else setCart([]);
  }, [boot?.me?.kind]);

  useEffect(() => {
    if (boot?.me?.kind !== "admin" && editMode) {
      sessionStorage.removeItem(EDIT_KEY);
      setEditModeState(false);
    }
  }, [boot?.me?.kind, editMode]);

  const value = useMemo<Store>(
    () => ({
      boot,
      loading,
      contactOpen,
      contactExtra,
      cart,
      editMode: Boolean(boot?.me?.kind === "admin" && editMode),
      editorTarget,
      refresh,
      refreshCart,
      openContact: (extra = "") => {
        setContactExtra(extra);
        setContactOpen(true);
      },
      closeContact: () => setContactOpen(false),
      setEditMode: (on: boolean) => {
        sessionStorage.setItem(EDIT_KEY, on ? "1" : "0");
        setEditModeState(on);
      },
      openEditor: (id) => setEditorTarget(id),
      closeEditor: () => setEditorTarget(null),
    }),
    [boot, loading, contactOpen, contactExtra, cart, editMode, editorTarget],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("store");
  return ctx;
}

export function formatPrice(amount: number, qty: number, unit: string) {
  const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${shown}元${qty}${unit}`;
}

export function formatYuan(amount: number) {
  const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${shown}元`;
}

export function enterShopAsAdmin(edit: boolean) {
  sessionStorage.setItem(EDIT_KEY, edit ? "1" : "0");
}
