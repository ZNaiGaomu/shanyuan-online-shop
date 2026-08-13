import type { BannerRow, CategoryRow, ConfigMap, MediaRow, PriceRow, ProductRow } from "./types";

export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/media/${encodeURIComponent(key)}`;
}

export function yuan(cents: number): number {
  return Math.round(cents) / 100;
}

export function toCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function mapConfig(rows: { key: string; value: string }[]): ConfigMap {
  const out: ConfigMap = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export function publicConfig(cfg: ConfigMap) {
  return {
    shopName: cfg.shop_name || "善愿日用品店（零售/批发）",
    shopLogoUrl: mediaUrl(cfg.shop_logo_key),
    notice: cfg.notice || "",
    shopVideoUrl: mediaUrl(cfg.shop_video_key),
    contact: {
      name: cfg.contact_name || "",
      phone: cfg.contact_phone || "",
      wechat: cfg.contact_wechat || "",
      qrUrl: mediaUrl(cfg.contact_qr_key),
      hours: cfg.contact_hours || "",
      address: cfg.contact_address || "",
      note: cfg.contact_note || "",
    },
  };
}

export function publicPrice(row: PriceRow) {
  return {
    id: row.id,
    amount: yuan(row.amount_cents),
    qty: row.qty,
    unit: row.unit,
  };
}

export function publicProduct(
  product: ProductRow,
  prices: PriceRow[],
  media: MediaRow[] = [],
) {
  return {
    id: product.id,
    categoryId: product.category_id,
    name: product.name,
    coverKey: product.cover_key,
    coverUrl: mediaUrl(product.cover_key),
    intro: product.intro,
    onSale: product.on_sale === 1,
    sort: product.sort,
    prices: prices.map(publicPrice),
    media: media.map((item) => ({
      id: item.id,
      kind: item.kind,
      objectKey: item.object_key,
      url: mediaUrl(item.object_key),
    })),
  };
}

export function publicCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    iconKey: row.icon_key,
    iconUrl: mediaUrl(row.icon_key),
    sort: row.sort,
    visible: row.visible === 1,
  };
}

export function publicBanner(row: BannerRow) {
  return {
    id: row.id,
    imageKey: row.image_key,
    imageUrl: mediaUrl(row.image_key),
    sort: row.sort,
  };
}
