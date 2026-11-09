import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, App as AntApp, Badge, Button, Col, Empty, Flex, Form, Grid, Input, Modal, Row, Skeleton, Typography, theme } from "antd";
import { LockOutlined, SearchOutlined, SettingOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import ProductCard from "./components/ProductCard";
import ProductModal from "./components/ProductModal";
import CartDrawer from "./components/CartDrawer";
import AdminDrawer from "./components/AdminDrawer";
import { useCatalog } from "./lib/catalog";
import { useCart } from "./lib/cart";
import { FONT_DISPLAY } from "./theme";

const GUTTER = [{ xs: 10, md: 16 }, { xs: 10, md: 16 }];
const COL = { xs: 12, sm: 12, md: 8, lg: 6 };
const ADMIN_PIN = "2026";
const ADMIN_AUTH_KEY = "catalogo-admin-auth-v1";

// sessionStorage puede lanzar (modo privado estricto, cookies bloqueadas): nunca debe tumbar la app.
const auth = {
  get: () => { try { return sessionStorage.getItem(ADMIN_AUTH_KEY) === "1"; } catch { return false; } },
  set: () => { try { auth.set(); } catch { /* sesión solo en memoria */ } },
  clear: () => { try { auth.clear(); } catch { /* ignore */ } }
};

function Shop({ catalog }) {
  const { message } = AntApp.useApp();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const compact = !screens.md;
  const cart = useCart(catalog);
  const { shop, lines, products } = catalog;

  const [line, setLine] = useState("Todos");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  const hasAdminParam = useMemo(() => new URLSearchParams(window.location.search).has("admin"), []);
  const [isUnlocked, setIsUnlocked] = useState(auth.get);
  const [pinModalOpen, setPinModalOpen] = useState(() => hasAdminParam && !auth.get());
  const [adminOpen, setAdminOpen] = useState(() => hasAdminParam && auth.get());
  const [pinInput, setPinInput] = useState("");
  const clickCountRef = useRef({ count: 0, timer: null });

  const [order, setOrder] = useState({ name: "", delivery: "Recoger en el local" });

  useEffect(() => { document.title = `${shop.name} · Catálogo`; }, [shop.name]);

  const handleLogoSecretClick = () => {
    clearTimeout(clickCountRef.current.timer);
    clickCountRef.current.count += 1;
    if (clickCountRef.current.count >= 5) {
      clickCountRef.current.count = 0;
      if (isUnlocked) setAdminOpen(true);
      else setPinModalOpen(true);
    } else {
      clickCountRef.current.timer = setTimeout(() => {
        clickCountRef.current.count = 0;
      }, 1500);
    }
  };

  const handleUnlockPin = () => {
    if (pinInput.trim() === ADMIN_PIN) {
      auth.set();
      setIsUnlocked(true);
      setPinModalOpen(false);
      setPinInput("");
      setAdminOpen(true);
      message.success("Acceso de propietario desbloqueado");
    } else {
      message.error("PIN incorrecto");
    }
  };

  const handleLockAdmin = () => {
    auth.clear();
    setIsUnlocked(false);
    setAdminOpen(false);
    if (window.location.search.includes("admin")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    message.info("Modo propietario cerrado (vista pública activa)");
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => (line === "Todos" || p.line === line) && (!q || [
      p.name, p.cond, ...p.colors.map((c) => catalog.colors[c][0]), ...p.storages.map((s) => `${s.gb} gb`)
    ].join(" ").toLowerCase().includes(q)));
  }, [products, line, query, catalog.colors]);

  return (
    <>
      <header className="sticky-top" style={{ background: token.colorBgLayout, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Flex className="page" align="center" gap={12} wrap style={{ paddingTop: 12, paddingBottom: 12 }}>
          <div
            onClick={handleLogoSecretClick}
            style={{ flex: "1 1 180px", minWidth: 0, cursor: "default", userSelect: "none" }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{shop.name}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{shop.tagline}</Typography.Text>
          </div>
          <Input
            allowClear
            aria-label="Buscar"
            prefix={<SearchOutlined />}
            placeholder="Buscar modelo, color o capacidad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: "1 1 260px", minWidth: 0, order: 3 }}
          />
          <Flex gap={8} align="center">
            {isUnlocked && (
              <Button
                icon={<SettingOutlined />}
                aria-label="Panel del local"
                onClick={() => setAdminOpen(true)}
              >
                {compact ? "Admin" : "Panel del local"}
              </Button>
            )}
            <Badge count={cart.count} color={token.colorPrimary} offset={[-4, 4]}>
              <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => setCartOpen(true)}>Mi pedido</Button>
            </Badge>
          </Flex>
        </Flex>
      </header>

      <main className="page">
        <section style={{ padding: "28px 0 8px" }}>
          <Typography.Title level={1} style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: "clamp(30px, 6vw, 52px)", lineHeight: 1.02, maxWidth: "16ch" }}>
            {shop.headline}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ maxWidth: "52ch", marginTop: 12 }}>{shop.sub}</Typography.Paragraph>
        </section>

        <Flex wrap gap={8} role="group" aria-label="Filtrar por línea" style={{ padding: "14px 0 6px" }}>
          {lines.map((l) => (
            <Button key={l} shape="round" type={l === line ? "primary" : "default"} aria-pressed={l === line} onClick={() => setLine(l)}>{l}</Button>
          ))}
        </Flex>
        <Typography.Text type="secondary" style={{ display: "block", fontSize: 13, padding: "6px 0 14px" }} aria-live="polite">
          {visible.length ? `${visible.length} ${visible.length === 1 ? "modelo" : "modelos"}` : ""}
        </Typography.Text>

        {visible.length === 0 ? (
          <Empty description="No encontramos ese modelo. Prueba con otro nombre o consulta disponibilidad en el local." />
        ) : (
          <Row gutter={GUTTER}>
            {visible.map((p) => (
              <Col key={p.id} {...COL}>
                <ProductCard product={p} catalog={catalog} compact={compact} onOpen={setOpenId} />
              </Col>
            ))}
          </Row>
        )}

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Flex justify="space-between" align="start" wrap gap={12}>
            <Flex vertical gap={4}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>{shop.hours}</Typography.Text>
              {shop.whatsappAddon && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>Chatbot WhatsApp: {shop.whatsappLabel}</Typography.Text>
              )}
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>Precios sujetos a disponibilidad en tienda. Garantía por escrito en cada equipo.</Typography.Text>
            </Flex>
            {isUnlocked && (
              <Button size="small" danger onClick={handleLockAdmin}>
                Salir de modo propietario
              </Button>
            )}
          </Flex>
        </footer>
      </main>

      <Modal
        open={pinModalOpen}
        onCancel={() => {
          setPinModalOpen(false);
          setPinInput("");
        }}
        title={<Flex align="center" gap={8}><LockOutlined /><span>Acceso exclusivo del local</span></Flex>}
        okText="Ingresar al panel"
        cancelText="Cancelar"
        onOk={handleUnlockPin}
        destroyOnHidden
      >
        <Form layout="vertical" onFinish={handleUnlockPin} style={{ marginTop: 12 }}>
          <Form.Item label="Ingresa el PIN de propietario para administrar precios, stock y módulos">
            <Input.Password
              autoFocus
              placeholder="PIN de propietario"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onPressEnter={handleUnlockPin}
            />
          </Form.Item>
        </Form>
      </Modal>

      {openId && <ProductModal key={openId} product={catalog.byId[openId]} catalog={catalog} cart={cart} onClose={() => setOpenId(null)} />}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} catalog={catalog} cart={cart} order={order} setOrder={setOrder} />
      {isUnlocked && <AdminDrawer open={adminOpen} onClose={() => setAdminOpen(false)} catalog={catalog} />}
    </>
  );
}

export default function CatalogApp() {
  const { status, data, error } = useCatalog();
  if (status === "ready") return <Shop catalog={data} />;
  return (
    <main className="page" style={{ paddingTop: 32 }}>
      {status === "error"
        ? <Alert type="error" showIcon title="No se pudo cargar el catálogo" description={error} />
        : <Skeleton active paragraph={{ rows: 6 }} />}
    </main>
  );
}
