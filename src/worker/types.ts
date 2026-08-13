export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
};

export type SessionKind = "user" | "admin";

export type Session = {
  token: string;
  kind: SessionKind;
  user_id: number | null;
};

export type ConfigMap = Record<string, string>;

export type BannerRow = {
  id: number;
  image_key: string;
  sort: number;
};

export type CategoryRow = {
  id: number;
  name: string;
  icon_key: string | null;
  sort: number;
  visible: number;
};

export type ProductRow = {
  id: number;
  category_id: number;
  name: string;
  cover_key: string;
  intro: string;
  on_sale: number;
  sort: number;
};

export type MediaRow = {
  id: number;
  product_id: number;
  kind: "image" | "video";
  object_key: string;
  sort: number;
};

export type PriceRow = {
  id: number;
  product_id: number;
  amount_cents: number;
  qty: number;
  unit: string;
  sort: number;
};

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  nickname: string | null;
  avatar_key: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export type CartRow = {
  id: number;
  user_id: number;
  product_id: number;
  price_id: number;
  qty: number;
};
