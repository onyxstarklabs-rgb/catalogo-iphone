/** Categorías del catálogo, en el orden en que se muestran. `storage`: el producto se vende por capacidad (GB). */
export const CATEGORIES = [
  { key: "iphone", label: "iPhones", storage: true },
  { key: "accesorios", label: "Accesorios", storage: false },
  { key: "mac", label: "Mac", storage: true },
  { key: "airpods", label: "AirPods", storage: false }
];
export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
export const hasCapacity = (p) => p.storages.some((s) => s.gb > 0);
