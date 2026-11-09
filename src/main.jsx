import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App as AntApp, ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";
import "./app.css";
import CatalogApp from "./App";
import { buildTheme } from "./theme";
import { useDarkMode } from "./lib/useDarkMode";

/** Pinta el fondo de la página con el token del tema, para que no haya un color suelto fuera de él. */
function ThemeSync({ dark }) {
  const { token } = theme.useToken();
  useEffect(() => {
    const root = document.documentElement;
    root.style.background = token.colorBgLayout;
    root.style.colorScheme = dark ? "dark" : "light";
    document.body.style.color = token.colorText;
    document.body.style.fontFamily = token.fontFamily;
  }, [dark, token]);
  return null;
}

/**
 * REGLA: todo componente de Ant Design vive dentro de este ConfigProvider (tema, idioma y prefijo de clases).
 * Los mensajes se muestran con App.useApp(), nunca con los métodos estáticos, que ignoran el ConfigProvider.
 */
function Root() {
  const dark = useDarkMode();
  return (
    <ConfigProvider prefixCls="cat" iconPrefixCls="cat-icon" locale={esES} theme={buildTheme(dark)}>
      <AntApp message={{ maxCount: 2, duration: 1.6 }}>
        <ThemeSync dark={dark} />
        <CatalogApp />
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><Root /></StrictMode>);
