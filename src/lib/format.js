export const cop = (n, currency = "COP") =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export const gbLabel = (g) => (g >= 1024 ? `${g / 1024} TB` : `${g} GB`);
