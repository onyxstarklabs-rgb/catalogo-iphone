import { theme as antTheme } from "antd";

export const FONT_BODY = '"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Bricolage Grotesque", "Arial Narrow", system-ui, sans-serif';

/** Única fuente de verdad visual. Todo componente lee estos valores desde ConfigProvider. */
export function buildTheme() {
  return {
    algorithm: antTheme.defaultAlgorithm,
    token: {
      colorPrimary: "#111827",
      colorSuccess: "#15803d",
      colorWarning: "#b45309",
      colorTextBase: "#0f172a",
      colorTextSecondary: "#475569",
      colorTextDescription: "#64748b",
      colorBgLayout: "#ffffff",
      colorBgContainer: "#ffffff",
      colorBgElevated: "#ffffff",
      colorFillSecondary: "#ffffff",
      colorFillQuaternary: "#f8fafc",
      colorBorder: "#e2e8f0",
      colorBorderSecondary: "#e5e7eb",
      borderRadius: 10,
      fontFamily: FONT_BODY,
      fontSize: 15,
      controlHeight: 40
    },
    components: {
      Button: { fontWeight: 600 },
      Typography: { titleMarginBottom: 0, titleMarginTop: 0 }
    }
  };
}
