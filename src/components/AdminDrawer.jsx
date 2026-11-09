import { useMemo, useState } from "react";
import { Alert, App as AntApp, Button, Drawer, Flex, Form, Grid, Input, InputNumber, Select, Switch, Tabs, Tag, Typography, theme } from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { cop, gbLabel } from "../lib/format";
import { totalStock } from "../lib/catalog";
import { FONT_DISPLAY } from "../theme";

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminDrawer({ open, onClose, catalog }) {
  const { message } = AntApp.useApp();
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const { shop, products, lines, hasOverrides, sync, updateShop, updateStorage, setProductStock, resetOverrides } = catalog;

  const [waDraft, setWaDraft] = useState(shop.whatsapp);
  const waValid = /^\d{10,15}$/.test(waDraft);
  const [lineFilter, setLineFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (lineFilter === "Todos" || p.line === lineFilter) && (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, lineFilter, search]);

  const handlePriceChange = (productId, gb, val) => {
    const price = Math.max(1000, Math.round(Number(val) || 0));
    updateStorage(productId, gb, { price });
  };

  const handleStockChange = (productId, gb, val) => {
    const stock = Math.max(0, Math.floor(Number(val) || 0));
    updateStorage(productId, gb, { stock });
  };

  const handleReset = () => {
    resetOverrides();
    message.success("Catálogo restaurado a los datos originales");
  };

  const stockTab = (
    <Flex vertical gap={14}>
      <Alert
        type="info"
        showIcon
        title="Edición de inventario en vivo (Plan Base)"
        description="Cada cambio se guarda en la base de datos y lo ven todos los clientes al instante, en cualquier dispositivo."
      />

      <Flex gap={8} wrap>
        <Select
          value={lineFilter}
          onChange={setLineFilter}
          options={lines.map((l) => ({ value: l, label: l }))}
          style={{ width: 150 }}
        />
        <Input
          allowClear
          placeholder="Filtrar modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
      </Flex>

      <Flex vertical gap={12}>
        {filteredProducts.map((p) => {
          const sumStock = totalStock(p);
          return (
            <div
              key={p.id}
              style={{
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                padding: 12,
                background: token.colorBgContainer
              }}
            >
              <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 10 }}>
                <Flex align="center" gap={8}>
                  <Typography.Text strong style={{ fontFamily: FONT_DISPLAY, fontSize: 16 }}>{p.name}</Typography.Text>
                  <Tag style={{ margin: 0 }}>{p.cond}</Tag>
                </Flex>
                <Flex align="center" gap={8}>
                  <Tag color={sumStock === 0 ? "error" : sumStock <= 2 ? "warning" : "success"} style={{ margin: 0 }}>
                    {sumStock === 0 ? "Agotado" : `${sumStock} uds en total`}
                  </Tag>
                  <Button
                    size="small"
                    danger={sumStock > 0}
                    onClick={() => {
                      setProductStock(p.id, sumStock > 0 ? 0 : 2);
                      message.info(sumStock > 0 ? `${p.name} marcado como agotado` : `${p.name} repuesto con 2 uds por capacidad`);
                    }}
                  >
                    {sumStock > 0 ? "Agotar todo el modelo" : "Reponer modelo (+2)"}
                  </Button>
                </Flex>
              </Flex>

              <Flex vertical gap={8}>
                {p.storages.map((s) => (
                  <Flex
                    key={s.gb}
                    align="center"
                    justify="space-between"
                    wrap
                    gap={8}
                    style={{
                      paddingTop: 8,
                      borderTop: `1px solid ${token.colorBorderSecondary}`
                    }}
                  >
                    <Typography.Text strong style={{ minWidth: 68 }}>{gbLabel(s.gb)}</Typography.Text>

                    <Flex align="center" gap={6} wrap>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Precio:</Typography.Text>
                      <InputNumber
                        aria-label={`Precio ${p.name} ${gbLabel(s.gb)}`}
                        min={1000}
                        step={50000}
                        value={s.price}
                        onChange={(v) => handlePriceChange(p.id, s.gb, v)}
                        style={{ width: 135 }}
                      />
                      <Typography.Text type="secondary" style={{ fontSize: 12, minWidth: 85 }}>
                        ({cop(s.price, shop.currency)})
                      </Typography.Text>
                    </Flex>

                    <Flex align="center" gap={6}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Stock:</Typography.Text>
                      <InputNumber
                        aria-label={`Stock ${p.name} ${gbLabel(s.gb)}`}
                        min={0}
                        max={999}
                        value={s.stock}
                        onChange={(v) => handleStockChange(p.id, s.gb, v)}
                        style={{ width: 72 }}
                      />
                      <Button
                        size="small"
                        danger={s.stock > 0}
                        onClick={() => handleStockChange(p.id, s.gb, s.stock > 0 ? 0 : 3)}
                      >
                        {s.stock > 0 ? "Agotar" : "+3"}
                      </Button>
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            </div>
          );
        })}
      </Flex>
    </Flex>
  );

  const shopTab = (
    <Form layout="vertical" requiredMark={false}>
      <Alert
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
        title="Datos del local"
        description="Se guardan solos y se publican al instante en el catálogo de todos los clientes."
      />
      <Form.Item label="Nombre de la tienda">
        <Input value={shop.name} onChange={(e) => updateShop({ name: e.target.value })} />
      </Form.Item>
      <Form.Item label="Ubicación / Subtítulo">
        <Input value={shop.tagline} onChange={(e) => updateShop({ tagline: e.target.value })} />
      </Form.Item>
      <Form.Item label="Título principal (Hero)">
        <Input value={shop.headline} onChange={(e) => updateShop({ headline: e.target.value })} />
      </Form.Item>
      <Form.Item label="Descripción bajo el título">
        <Input.TextArea rows={2} value={shop.sub} onChange={(e) => updateShop({ sub: e.target.value })} />
      </Form.Item>
      <Form.Item label="Horario de atención">
        <Input value={shop.hours} onChange={(e) => updateShop({ hours: e.target.value })} />
      </Form.Item>
    </Form>
  );

  const addonTab = (
    <Flex vertical gap={16}>
      <Alert
        type="warning"
        showIcon
        title="Módulo Adicional de Pago (2ª Suscripción)"
        description="El Plan Base incluye el Catálogo Digital, gestión de inventario, garantías y órdenes de reserva. La conexión con WhatsApp y el Chatbot IA se comercializa como una segunda suscripción mensual."
      />

      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: 16,
          background: token.colorBgContainer
        }}
      >
        <Flex justify="space-between" align="center" gap={12} wrap>
          <div>
            <Flex align="center" gap={8} wrap>
              <Typography.Text strong style={{ fontFamily: FONT_DISPLAY, fontSize: 17 }}>
                Chatbot IA de WhatsApp + Pedidos Automáticos
              </Typography.Text>
              <Tag color={shop.whatsappAddon ? "success" : "default"} style={{ margin: 0 }}>
                {shop.whatsappAddon ? "Activo en demo" : "Desactivado (Plan Base)"}
              </Tag>
            </Flex>
            <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0, marginTop: 4 }}>
              Activa este interruptor durante la reunión solo si quieres mostrarle al cliente cómo funciona el upgrade de la segunda suscripción.
            </Typography.Paragraph>
          </div>
          <Switch
            checked={Boolean(shop.whatsappAddon)}
            onChange={(checked) => {
              updateShop({ whatsappAddon: checked });
              message.info(
                checked
                  ? "Add-on Chatbot WhatsApp activado para demostración"
                  : "Catálogo en modo Plan Base (órdenes de reserva sin WhatsApp)"
              );
            }}
          />
        </Flex>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Typography.Text strong style={{ fontSize: 13 }}>¿Qué incluye esta 2ª suscripción para la tienda?</Typography.Text>
          <ul className="tight-list" style={{ marginTop: 6, fontSize: 13 }}>
            <li>Chatbot IA 24/7 en WhatsApp entrenado en tiempo real con el stock, precios y garantías del catálogo.</li>
            <li>Envío directo del carrito al WhatsApp de la tienda con desglose automático de equipos y garantías.</li>
            <li>Atención automática de preguntas frecuentes (batería, capacidades, colores disponibles y domicilio).</li>
          </ul>
        </div>

        {shop.whatsappAddon && (
          <Form layout="vertical" requiredMark={false} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
            <Form.Item
              label="Número de WhatsApp del Chatbot / Tienda (con indicativo 57)"
              validateStatus={waDraft && !waValid ? "error" : undefined}
              help={waDraft && !waValid ? "Solo dígitos con indicativo, de 10 a 15" : undefined}
              style={{ marginBottom: 0 }}
            >
              <Flex gap={8}>
                <Input
                  value={waDraft}
                  placeholder="573001234567"
                  inputMode="numeric"
                  maxLength={15}
                  onChange={(e) => setWaDraft(e.target.value.replace(/\D/g, ""))}
                />
                <Button
                  type="primary"
                  disabled={!waValid || waDraft === shop.whatsapp}
                  onClick={() => updateShop({ whatsapp: waDraft, whatsappLabel: `+${waDraft}` })}
                >
                  Guardar
                </Button>
              </Flex>
            </Form.Item>
          </Form>
        )}
      </div>
    </Flex>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Panel del local · Inventario y Módulos"
      size={screens.sm ? 580 : "100%"}
      destroyOnHidden
      footer={
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Flex gap={8} wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                downloadJson("products.json", products);
                message.success("products.json descargado");
              }}
            >
              Descargar products.json
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                downloadJson("shop.json", shop);
                message.success("shop.json descargado");
              }}
            >
              Descargar shop.json
            </Button>
          </Flex>
          <Tag color={sync.status === "error" ? "error" : "default"} style={{ margin: 0 }}>
            {sync.status === "saving" ? "Guardando…" : sync.status === "error" ? sync.error : sync.status === "saved" ? "Guardado" : "Sincronizado"}
          </Tag>
          {hasOverrides && (
            <Button danger icon={<ReloadOutlined />} onClick={handleReset}>
              Restaurar original
            </Button>
          )}
        </Flex>
      }
    >
      <Tabs
        items={[
          { key: "stock", label: "Stock y precios", children: stockTab },
          { key: "shop", label: "Datos del local", children: shopTab },
          {
            key: "addon",
            label: (
              <Flex align="center" gap={6}>
                <span>Chatbot WhatsApp</span>
                <Tag color={shop.whatsappAddon ? "success" : "gold"} style={{ margin: 0, fontSize: 11 }}>
                  2ª Suscripción
                </Tag>
              </Flex>
            ),
            children: addonTab
          }
        ]}
      />
    </Drawer>
  );
}
