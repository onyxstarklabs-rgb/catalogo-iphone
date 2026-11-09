import { Alert, App as AntApp, Button, Empty, Flex, Skeleton, Tag, Typography, theme } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useOrders } from "../lib/orders";
import { cop } from "../lib/format";
import { FONT_DISPLAY } from "../theme";

const STATUS = {
  pendiente: { label: "Apartada", color: "processing" },
  entregada: { label: "Entregada", color: "success" },
  cancelada: { label: "Cancelada", color: "default" },
  vencida: { label: "Vencida (stock repuesto)", color: "warning" }
};

function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "venciendo…";
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
const fmt = (iso) => new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(iso));

export default function OrdersAdmin({ currency = "COP" }) {
  const { token } = theme.useToken();
  const { message, modal } = AntApp.useApp();
  const { orders, error, reload, setStatus } = useOrders();

  const act = async (o, status) => {
    const r = await setStatus(o.id, status);
    if (r.ok) message.success(status === "entregada" ? `#${o.code} marcada como entregada` : `#${o.code} cancelada, stock repuesto`);
    else message.error(r.error);
  };
  const cancel = (o) => modal.confirm({
    title: `¿Cancelar la reserva #${o.code}?`,
    content: "Se devuelven las unidades al stock.",
    okText: "Cancelar reserva",
    cancelText: "Volver",
    okButtonProps: { danger: true },
    onOk: () => act(o, "cancelada")
  });

  return (
    <Flex vertical gap={12}>
      <Alert type="info" showIcon title="Reservas de clientes" description="Las unidades quedan apartadas del stock. Si el cliente no llega a tiempo, la reserva vence y el stock se repone solo." />
      <Flex justify="end"><Button size="small" icon={<ReloadOutlined />} onClick={reload}>Actualizar</Button></Flex>
      {error && <Alert type="error" showIcon title={error} />}
      {!orders && !error && <Skeleton active />}
      {orders && orders.length === 0 && <Empty description="Aún no hay reservas." />}
      {orders?.map((o) => {
        const st = STATUS[o.status] ?? { label: o.status, color: "default" };
        return (
          <Flex key={o.id} vertical gap={6} style={{ padding: 12, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadius, opacity: o.status === "pendiente" ? 1 : 0.7 }}>
            <Flex justify="space-between" align="center" wrap gap={8}>
              <Typography.Text strong style={{ fontFamily: FONT_DISPLAY, fontSize: 16 }}>#{o.code} · {o.customer_name}</Typography.Text>
              <Tag color={st.color} style={{ margin: 0 }}>{st.label}</Tag>
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {o.delivery} · creada {fmt(o.created_at)}{o.status === "pendiente" && ` · vence en ${timeLeft(o.expires_at)}`}
            </Typography.Text>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {o.items.map((it, i) => (
                <li key={i}>{it.qty}× {it.name}{it.color ? ` · ${it.color}` : ""}</li>
              ))}
            </ul>
            <Typography.Text strong style={{ fontVariantNumeric: "tabular-nums" }}>Total {cop(o.total, currency)}</Typography.Text>
            {o.status === "pendiente" && (
              <Flex gap={8} wrap>
                <Button size="small" type="primary" onClick={() => act(o, "entregada")}>Marcar entregada</Button>
                <Button size="small" danger onClick={() => cancel(o)}>Cancelar y reponer stock</Button>
              </Flex>
            )}
          </Flex>
        );
      })}
    </Flex>
  );
}
