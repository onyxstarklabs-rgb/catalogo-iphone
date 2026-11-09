import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, App as AntApp, Button, Col, Empty, FloatButton, Flex, Form, Grid, Input, Modal, Row, Select, Skeleton, Switch, Typography, theme } from "antd";
import { LockOutlined, SearchOutlined, SettingOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import ProductCard from "./components/ProductCard";
import ProductModal from "./components/ProductModal";
import CartDrawer from "./components/CartDrawer";
import AdminDrawer from "./components/AdminDrawer";
import { useCatalog } from "./lib/catalog";
import { useCart } from "./lib/cart";
import { useOwner } from "./lib/auth";
import { CATEGORIES } from "./lib/categories";
import { totalStock } from "./lib/catalog";
import { FONT_DISPLAY } from "./theme";

const GUTTER = [{ xs: 10, md: 16 }, { xs: 10, md: 16 }];
const COL = { xs: 12, sm: 12, md: 8, lg: 6 };

function Shop({ catalog }) {
  const { message } = AntApp.useApp();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const compact = !screens.md;
  const cart = useCart(catalog);
  const { shop, products } = catalog;

  const [category, setCategory] = useState("Todos");
  const [line, setLine] = useState("Todos");
  const [onlyStock, setOnlyStock] = useState(false);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  const hasAdminParam = useMemo(() => new URLSearchParams(window.location.search).has("admin"), []);
  const owner = useOwner();
  const isUnlocked = owner.owner;
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginForm] = Form.useForm();
  const clickCountRef = useRef({ count: 0, timer: null });

  // ?admin abre el acceso del dueño en cuanto se sabe si ya hay sesión.
  useEffect(() => {
    if (!hasAdminParam || !owner.ready || !owner.available) return;
    if (owner.owner) setAdminOpen(true); else setLoginOpen(true);
  }, [hasAdminParam, owner.ready, owner.available, owner.owner]);

  const [order, setOrder] = useState({ name: "", delivery: "Recoger en el local" });

  useEffect(() => { document.title = `${shop.name} · Catálogo`; }, [shop.name]);

  const handleLogoSecretClick = () => {
    if (!owner.available) return;
    clearTimeout(clickCountRef.current.timer);
    clickCountRef.current.count += 1;
    if (clickCountRef.current.count >= 5) {
      clickCountRef.current.count = 0;
      if (isUnlocked) setAdminOpen(true);
      else setLoginOpen(true);
    } else {
      clickCountRef.current.timer = setTimeout(() => {
        clickCountRef.current.count = 0;
      }, 1500);
    }
  };

  const handleLogin = async ({ email, password }) => {
    setLoginBusy(true);
    try {
      await owner.signIn(email, password);
      setLoginOpen(false);
      loginForm.resetFields();
      setAdminOpen(true);
      message.success("Acceso de propietario desbloqueado");
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLockAdmin = async () => {
    setAdminOpen(false);
    await owner.signOut();
    if (window.location.search.includes("admin")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    message.info("Modo propietario cerrado (vista pública activa)");
  };

  const inStock = (p) => totalStock(p) > 0;
  const categoryOptions = useMemo(() => [
    { value: "Todos", label: `Todos (${products.filter(inStock).length})` },
    ...CATEGORIES.map((c) => ({ value: c.key, label: `${c.label} (${products.filter((p) => p.category === c.key && inStock(p)).length})` }))
  ], [products]);
  const lineOptions = useMemo(() => {
    const ls = [...new Set(products.filter((p) => p.category === category).map((p) => p.line))];
    return ls.length > 1 ? [{ value: "Todos", label: "Todas las líneas" }, ...ls.map((l) => ({ value: l, label: l }))] : [];
  }, [products, category]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => (category === "Todos" || p.category === category) && (line === "Todos" || p.line === line)
      && (!onlyStock || inStock(p))
      && (!q || [p.name, p.line, p.cond, ...p.colors.map((c) => catalog.colors[c][0]), ...p.storages.filter((s) => s.gb > 0).map((s) => `${s.gb} gb`)].join(" ").toLowerCase().includes(q)));
  }, [products, category, line, onlyStock, query, catalog.colors]);

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

        <Flex wrap gap={10} align="center" role="group" aria-label="Filtros" style={{ padding: "14px 0 6px" }}>
          <Select
            aria-label="Categoría"
            value={category}
            options={categoryOptions}
            onChange={(v) => { setCategory(v); setLine("Todos"); }}
            style={{ flex: "1 1 160px", maxWidth: 240 }}
            size="large"
          />
          {lineOptions.length > 0 && (
            <Select aria-label="Línea" value={line} options={lineOptions} onChange={setLine} style={{ flex: "1 1 160px", maxWidth: 240 }} size="large" />
          )}
          <Flex align="center" gap={8}>
            <Switch id="solo-stock" checked={onlyStock} onChange={setOnlyStock} aria-label="Solo con stock" />
            <label htmlFor="solo-stock" style={{ cursor: "pointer" }}>Solo con stock</label>
          </Flex>
        </Flex>
        <Typography.Text type="secondary" style={{ display: "block", fontSize: 13, padding: "6px 0 14px" }} aria-live="polite">
          {visible.length ? `${visible.length} ${visible.length === 1 ? "modelo" : "modelos"}` : ""}
        </Typography.Text>

        {visible.length === 0 ? (
          <Empty description={onlyStock ? "No hay productos con stock en esta selección." : "No encontramos productos con esos filtros. Prueba con otra búsqueda o consulta disponibilidad en el local."} />
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
        open={loginOpen}
        onCancel={() => { setLoginOpen(false); loginForm.resetFields(); }}
        title={<Flex align="center" gap={8}><LockOutlined /><span>Acceso exclusivo del local</span></Flex>}
        okText="Ingresar al panel"
        cancelText="Cancelar"
        onOk={() => loginForm.submit()}
        okButtonProps={{ loading: loginBusy }}
        destroyOnHidden
      >
        <Form form={loginForm} layout="vertical" onFinish={handleLogin} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="email" label="Correo del propietario" rules={[{ required: true, type: "email", message: "Escribe un correo válido" }]}>
            <Input autoFocus autoComplete="username" maxLength={254} onPressEnter={() => loginForm.submit()} />
          </Form.Item>
          <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: "Escribe la contraseña" }]}>
            <Input.Password autoComplete="current-password" maxLength={128} onPressEnter={() => loginForm.submit()} />
          </Form.Item>
        </Form>
      </Modal>

      <FloatButton
        type="primary"
        icon={<ShoppingCartOutlined />}
        badge={{ count: cart.count, overflowCount: 99 }}
        aria-label="Mi pedido"
        onClick={() => setCartOpen(true)}
        style={{ insetInlineEnd: "max(20px, env(safe-area-inset-right, 0px))", insetBlockEnd: "calc(20px + env(safe-area-inset-bottom, 0px))", width: 56, height: 56 }}
      />

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
