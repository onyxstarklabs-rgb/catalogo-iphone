export const cop = (n, currency = "COP") =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export const gbLabel = (g) => (g === 0 ? "Único" : g >= 1024 ? `${g / 1024} TB` : `${g} GB`);
/** Nombre con capacidad para frases ("iPhone 16 128 GB"); los productos sin capacidad llevan solo el nombre. */
export const nameWith = (name, g) => (g > 0 ? `${name} ${gbLabel(g)}` : name);
