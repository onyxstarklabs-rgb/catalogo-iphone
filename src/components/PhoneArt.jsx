import { useState } from "react";
import { theme } from "antd";
import { AppstoreOutlined, CustomerServiceOutlined, LaptopOutlined } from "@ant-design/icons";

/**
 * Foto subida desde el panel (imageUrl), luego img/<id>-<color>.jpg y img/<id>.jpg;
 * si no, el equipo se dibuja con el color elegido. Usar `key={color}` para reiniciar al cambiar de color.
 */
const CATEGORY_ICON = { mac: LaptopOutlined, airpods: CustomerServiceOutlined, accesorios: AppstoreOutlined };

export default function PhoneArt({ product, color, colorName, hex, ratio, height, flat, children }) {
  const { token } = theme.useToken();
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const base = import.meta.env.BASE_URL;
  const sources = [product.imageUrl, `${base}img/${product.id}-${color}.jpg`, `${base}img/${product.id}.jpg`].filter(Boolean);
  const src = sources[step] || null;

  return (
    <div style={{ position: "relative", background: flat ? "transparent" : token.colorFillSecondary, display: "grid", placeItems: "center", overflow: "hidden", aspectRatio: ratio, height }}>
      {!loaded && (CATEGORY_ICON[product.category]
        ? (() => { const Icon = CATEGORY_ICON[product.category]; return <Icon role="img" aria-label={product.name} style={{ fontSize: 44, color: token.colorTextQuaternary }} />; })()
        : <div className="phone" style={{ "--c": hex }} role="img" aria-label={`${product.name} ${colorName}`} />)}
      {src && (
        <img
          key={src}
          src={src}
          alt={`${product.name} ${colorName}`}
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(false); setStep((s) => s + 1); }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", padding: "6%", boxSizing: "border-box", opacity: loaded ? 1 : 0 }}
        />
      )}
      {children}
    </div>
  );
}
