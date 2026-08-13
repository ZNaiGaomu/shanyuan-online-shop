import type { Api, Bootstrap, CartItem, Product } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<Api<T>> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({ ok: false, error: "网络异常" }))) as Api<T>;
  if (!json || typeof json !== "object") return { ok: false, error: "网络异常" };
  if (!("ok" in json)) return { ok: false, error: res.ok ? "返回格式不对" : `上传失败（${res.status}）` };
  return json;
}

export const api = {
  bootstrap: () => request<Bootstrap>("/api/bootstrap"),
  search: (q: string) => request<Product[]>(`/api/search?q=${encodeURIComponent(q)}`),
  product: (id: number) => request<Product>(`/api/products/${id}`),
  cart: () => request<CartItem[]>("/api/cart"),
  register: (username: string, password: string) =>
    request<void>("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<void>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  adminLogin: (username: string, password: string, secret: string) =>
    request<void>("/api/auth/admin-login", { method: "POST", body: JSON.stringify({ username, password, secret }) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST", body: "{}" }),
  saveProfile: (body: Record<string, string>) =>
    request<void>("/api/auth/profile", { method: "POST", body: JSON.stringify(body) }),
  addCart: (productId: number, priceId: number, qty = 1) =>
    request<void>("/api/auth/cart", { method: "POST", body: JSON.stringify({ productId, priceId, qty }) }),
  patchCart: (id: number, qty: number) =>
    request<void>(`/api/auth/cart/${id}`, { method: "PATCH", body: JSON.stringify({ qty }) }),
  delCart: (id: number) => request<void>(`/api/auth/cart/${id}`, { method: "DELETE" }),
  upload: async (file: File, kind: "image" | "video") => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    return request<{ key: string; url: string }>("/api/upload", { method: "POST", body: form });
  },
  saveConfig: (body: Record<string, string>) =>
    request<void>("/api/admin/config", { method: "PUT", body: JSON.stringify(body) }),
  addBanner: (imageKey: string, sort = 0) =>
    request<void>("/api/admin/banners", { method: "POST", body: JSON.stringify({ imageKey, sort }) }),
  delBanner: (id: number) => request<void>(`/api/admin/banners/${id}`, { method: "DELETE" }),
  addCategory: (body: Record<string, unknown>) =>
    request<void>("/api/admin/categories", { method: "POST", body: JSON.stringify(body) }),
  saveCategory: (id: number, body: Record<string, unknown>) =>
    request<void>(`/api/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delCategory: (id: number) => request<void>(`/api/admin/categories/${id}`, { method: "DELETE" }),
  addProduct: (body: Record<string, unknown>) =>
    request<{ id: number }>("/api/admin/products", { method: "POST", body: JSON.stringify(body) }),
  saveProduct: (id: number, body: Record<string, unknown>) =>
    request<void>(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delProduct: (id: number) => request<void>(`/api/admin/products/${id}`, { method: "DELETE" }),
  saveLayout: (items: { id: number; categoryId: number; sort: number }[]) =>
    request<void>("/api/admin/layout", { method: "PUT", body: JSON.stringify({ items }) }),
  users: () =>
    request<{ id: number; username: string; nickname: string | null; created_at: string; cart_count: number }[]>(
      "/api/admin/users",
    ),
  userCart: (id: number) =>
    request<{ id: number; name: string; qty: number; amount: number; packQty: number; unit: string }[]>(
      `/api/admin/users/${id}/cart`,
    ),
  resetUserPassword: (id: number, password: string) =>
    request<{ username: string }>(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  adminAccount: () => request<{ username: string }>("/api/admin/account"),
  saveAdminAccount: (body: {
    currentPassword: string;
    currentSecret: string;
    username: string;
    password?: string;
    secret?: string;
  }) => request<void>("/api/admin/account", { method: "PUT", body: JSON.stringify(body) }),
};
