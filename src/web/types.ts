export type ShopContact = {
  name: string;
  phone: string;
  wechat: string;
  qrUrl: string | null;
  hours: string;
  address: string;
  note: string;
};

export type ShopInfo = {
  shopName: string;
  shopLogoUrl: string | null;
  notice: string;
  shopVideoUrl: string | null;
  contact: ShopContact;
};

export type Banner = { id: number; imageKey?: string; imageUrl: string | null; sort: number };
export type Category = {
  id: number;
  name: string;
  iconKey?: string | null;
  iconUrl: string | null;
  sort: number;
  visible: boolean;
};
export type Price = { id: number; amount: number; qty: number; unit: string };
export type Media = { id: number; kind: "image" | "video"; objectKey?: string; url: string | null };

export type Product = {
  id: number;
  categoryId: number;
  name: string;
  coverKey?: string;
  coverUrl: string | null;
  intro: string;
  onSale: boolean;
  sort: number;
  prices: Price[];
  media: Media[];
};

export type Me =
  | { kind: "admin" }
  | {
      kind: "user";
      id: number;
      username: string;
      nickname: string;
      avatarUrl: string | null;
    };

export type Bootstrap = {
  shop: ShopInfo;
  banners: Banner[];
  categories: Category[];
  products: Product[];
  me: Me | null;
  preview: boolean;
  activities: ActivityNotice[];
};

export type ActivityNotice = {
  id: number;
  body: string;
  startAt: string;
  endAt: string;
};

export type CartItem = {
  id: number;
  productId: number;
  name: string;
  coverUrl: string | null;
  onSale: boolean;
  priceId: number;
  amount: number;
  packQty: number;
  unit: string;
  qty: number;
};

export type EditorTarget = number | "new" | null;

export type Api<T> = { ok: true; data: T } | { ok: false; error: string };
