import { useState } from "react";
import { Alert, App as AntApp, Button, Drawer, Empty, Flex, Form, Grid, Input, InputNumber, Radio, Tag, Typography, theme } from "antd";
import { CheckCircleOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import { cop, gbLabel } from "../lib/format";
import { priceOf } from "../lib/catalog";
import { buildOrderSummary, whatsappLink } from "../lib/cart";
import { FONT_DISPLAY } from "../theme";

const DELIVERY = ["Recoger en el local", "Domicilio en Cúcuta"];

export default function CartDrawer({ open, onClose, catalog, cart, order, setOrder }) {
  const { message } = AntApp.useApp();
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const { shop, byId, colors, warr } = catalog;
  const [ticket, setTicket] = useState(null);

  const ready = cart.lines.length > 0 && order.name.trim().length >= 2;
  const whatsappEnabled = Boolean(shop.whatsappAddon);
  const href = ready && whatsappEnabled ? whatsappLink(catalog, cart.lines, cart.total, order.name, order.delivery) : undefined;

  const handleGenerateOrder = async () => {
    if (!ready) return;
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const text = buildOrderSummary(catalog, cart.lines, cart.total, order.name, order.delivery, code);
    setTicket({ code, text });
    try {
      await navigator.clipboard.writeText(text);
      message.success(`Orden #${code} generada y copiada al portapapeles`);
    } catch {
      message.success(`Orden #${code} generada lista para presentar en tienda`);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <Flex align="center" gap={8} wrap>
          <span>Mi pedido</span>
          {whatsappEnabled && <Tag color="success" style={{ margin: 0 }}>Add-on Chatbot WhatsApp activo</Tag>}
        </Flex>
      }
      size={screens.sm ? 440 : "100%"}
      destroyOnHidden
      footer={
        <Flex vertical gap={10}>
          <Flex justify="space-between" align="center">
            <Typography.Text>Total</Typography.Text>
            <Typography.Text style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{cop(cart.total, shop.currency)}</Typography.Text>
          </Flex>
          {whatsappEnabled ? (
            <>
              <Button type="primary" size="large" block href={href} target="_blank" rel="noopener noreferrer" disabled={!ready}>
                Confirmar con Chatbot de WhatsApp
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {ready
                  ? "Módulo Chatbot WhatsApp activo: tu orden se envía automáticamente al asistente del local."
                  : cart.lines.length ? "Escribe tu nombre para habilitar el envío." : "Agrega al menos un producto."}
              </Typography.Text>
            </>
          ) : (
            <>
              <Button type="primary" size="large" block icon={<CheckCircleOutlined />} disabled={!ready} onClick={handleGenerateOrder}>
                Generar orden de reserva
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {ready
                  ? "Genera tu comprobante con código de reserva para presentarlo en el local o compartirlo."
                  : cart.lines.length ? "Escribe tu nombre para generar la reserva." : "Agrega al menos un producto."}
              </Typography.Text>
            </>
          )}
        </Flex>
      }
    >
      {cart.lines.length === 0 ? (
        <Empty description="Tu pedido está vacío. Elige un modelo del catálogo para empezar." />
      ) : (
        <Flex vertical gap={12}>
          {ticket && !whatsappEnabled && (
            <Alert
              type="success"
              showIcon
              title={`Reserva #${ticket.code} generada`}
              description={
                <Flex vertical gap={8} style={{ marginTop: 4 }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, background: token.colorFillQuaternary, padding: 10, borderRadius: token.borderRadius }}>
                    {ticket.text}
                  </pre>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    style={{ alignSelf: "flex-start" }}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(ticket.text);
                        message.success("Resumen copiado al portapapeles");
                      } catch {
                        message.info("Selecciona el texto para copiarlo");
                      }
                    }}
                  >
                    Copiar comprobante
                  </Button>
                </Flex>
              }
            />
          )}

          {cart.lines.map((l, i) => {
            const p = byId[l.id];
            return (
              <div key={`${l.id}|${l.gb}|${l.color}`} style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadius, padding: 12, background: token.colorBgContainer }}>
                <Flex justify="space-between" gap={12} align="start">
                  <Typography.Text strong>{p.name} {gbLabel(l.gb)}</Typography.Text>
                  <Typography.Text style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{cop(priceOf(p, l.gb) * l.qty, shop.currency)}</Typography.Text>
                </Flex>
                <Flex align="center" gap={8} style={{ marginTop: 4 }}>
                  <span className="swatch" style={{ background: colors[l.color][1] }} />
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>{colors[l.color][0]} · {p.cond} · garantía {warr[p.warr].months} meses</Typography.Text>
                </Flex>
                <Flex justify="space-between" align="center" style={{ marginTop: 8 }}>
                  <InputNumber aria-label={`Cantidad de ${p.name}`} min={1} value={l.qty} changeOnWheel={false} onChange={(v) => cart.setQty(i, Number(v) || 1)} style={{ width: 88 }} />
                  <Button type="link" danger icon={<DeleteOutlined />} onClick={() => cart.remove(i)}>Quitar</Button>
                </Flex>
              </div>
            );
          })}

          <Form layout="vertical" requiredMark={false} style={{ marginTop: 8 }}>
            <Form.Item label="Tu nombre" htmlFor="pedido-nombre" required>
              <Input id="pedido-nombre" value={order.name} maxLength={80} autoComplete="name" placeholder="Nombre y apellido" onChange={(e) => setOrder({ ...order, name: e.target.value })} />
            </Form.Item>
            <Form.Item label="Entrega">
              <Radio.Group value={order.delivery} onChange={(e) => setOrder({ ...order, delivery: e.target.value })} options={DELIVERY} />
            </Form.Item>
          </Form>
          <Button type="link" danger style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => { setTicket(null); cart.clear(); }}>Vaciar pedido</Button>
        </Flex>
      )}
    </Drawer>
  );
}
