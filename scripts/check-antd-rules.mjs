// Reglas del proyecto para Ant Design. Uso: node scripts/check-antd-rules.mjs
//  1. Ninguna referencia a clases internas de Ant Design (ant-*, anticon): si cambia su nomenclatura, no rompe nada.
//  2. Nada de métodos estáticos (message.*, notification.*, Modal.confirm...): ignoran el ConfigProvider.
//  3. main.jsx envuelve la app en <ConfigProvider>.
//  4. Los colores de marca viven solo en src/theme.js (tokens); el resto los lee del tema.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|css)$/.test(f)) files.push(p);
  }
})(SRC);

const err = [];
const add = (file, line, msg) => err.push(`✗ ${relative(ROOT, file)}:${line + 1}  ${msg}`);

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    if (/(?<![\w@/-])ant-[a-z0-9]/.test(text) || /\banticon\b/.test(text)) add(file, i, "referencia a clases internas de Ant Design (ant-* / anticon); usa tokens del tema o props semánticas (styles, classNames)");
    const imp = text.match(/import\s*\{([^}]*)\}\s*from\s*["']antd["']/);
    if (imp && /\b(message|notification)\b/.test(imp[1].replace(/\bas\b\s+\w+/g, ""))) add(file, i, "message/notification estáticos ignoran el ConfigProvider; usa App.useApp()");
    if (/\bModal\.(confirm|info|success|error|warning)\s*\(/.test(text) || /ConfigProvider\.config\s*\(/.test(text)) add(file, i, "método estático de Ant Design; usa App.useApp() o el componente dentro del ConfigProvider");
    if (rel !== "src/theme.js" && /#[0-9a-fA-F]{3,8}\b/.test(text) && !/^\s*(\/\/|\/\*|\*)/.test(text) && rel !== "src/app.css") add(file, i, "color literal fuera de src/theme.js; léelo del tema con theme.useToken()");
  });
}
const main = readFileSync(join(SRC, "main.jsx"), "utf8");
if (!/<ConfigProvider[\s>]/.test(main)) err.push("✗ src/main.jsx  la app debe estar envuelta en <ConfigProvider>");

if (err.length) { console.error(err.join("\n")); process.exit(1); }
console.log(`OK: ${files.length} archivos revisados, reglas de Ant Design cumplidas`);
