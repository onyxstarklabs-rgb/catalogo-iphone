import { useState } from "react";
import { Alert, App as AntApp, Button, Col, Collapse, Flex, Grid, InputNumber, Modal, Radio, Row, Tag, Typography, theme } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import PhoneArt from "./PhoneArt";
import { SpecsBody, WarrantyBody, WarrantyLabel } from "./Warranty";
import { cop, gbLabel } from "../lib/format";
import { priceOf, stockOf } from "../lib/catalog";
import { FONT_DISPLAY } from "../theme";

export default function ProductModal({ product, catalog, cart, onClose }) {
  const { message } = AntApp.useApp();
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const { colors, warr, shop } = catalog;
  const first = product.storages.find((s) => s.stock > 0) ?? product.storages[0];

  const [gb, setGb] = useState(first.gb);
  const [color, setColor] = useState(product.colors[0]);
  const [qty, setQty] = useState(1);
  const [panels, setPanels] = useState([]);

  const stock = stockOf(product, gb);
  const left = cart.available(product.id, gb);
  const out = stock === 0;
  const maxed = !out && left <= 0;
  const q = Math.min(Math.max(qty, 1), Math.max(left, 1));
  const w = warr[product.warr];
  const wide = Boolean(screens.md);

  const add = () => {
    const n = cart.add(product.id, gb, color, q);
    if (n > 0) { message.success(`${product.name} ${gbLabel(gb)} agregado al pedido`); onClose(); }
  };

  const note = out ? "Esta capacidad está agotada."
    : maxed ? "Ya tienes todas las unidades disponibles en tu pedido."
    : stock <= 2 ? `Quedan ${stock} en stock.` : "Disponible para entrega inmediata.";

  return (
    <Modal
      open
      centered
      destroyOnHidden
      onCancel={onClose}
      footer={null}
      width={{ xs: "calc(100vw - 16px)", md: 820 }}
      title={<Flex align="center" gap={10} wrap><span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 800 }}>{product.name}</span><Tag style={{ margin: 0 }}>{product.cond}</Tag></Flex>}
      styles={{ body: { padding: 0, maxHeight: "calc(100dvh - 120px)", overflowY: "auto" } }}
    >
      <Row>
        <Col xs={24} md={10} style={{ background: token.colorFillSecondary }}>
          <div style={wide ? { position: "sticky", top: 0 } : undefined}>
            <PhoneArt flat key={color} product={product} color={color} colorName={colors[color][0]} hex={colors[color][1]} height={wide ? 420 : 240} />
          </div>
        </Col>
        <Col xs={24} md={14}>
          <Flex vertical gap={16} style={{ padding: wide ? 20 : 16 }}>
            <div>
              <Typography.Text type="secondary" strong style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>Capacidad</Typography.Text>
              <div style={{ marginTop: 6 }}>
                <Radio.Group
                  optionType="button"
                  value={gb}
                  onChange={(e) => { setGb(e.target.value); setQty(1); }}
                  options={product.storages.map((s) => ({ label: gbLabel(s.gb), value: s.gb, disabled: s.stock === 0 }))}
                />
              </div>
            </div>
            <div>
              <Typography.Text type="secondary" strong style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>Color · {colors[color][0]}</Typography.Text>
              <Flex wrap gap={8} style={{ marginTop: 6 }}>
                <Radio.Group
                  optionType="button"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  options={product.colors.map((c) => ({
                    value: c,
                    label: <Flex align="center" gap={8}><span className="swatch" style={{ background: colors[c][1] }} />{colors[c][0]}</Flex>
                  }))}
                />
              </Flex>
            </div>

            <Flex align="center" justify="space-between" gap={12} wrap>
              <Typography.Text style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {cop(priceOf(product, gb) * q, shop.currency)}
              </Typography.Text>
              <Flex gap={4} aria-label="Cantidad">
                <Button aria-label="Menos" icon={<MinusOutlined />} disabled={q <= 1} onClick={() => setQty(q - 1)} />
                <InputNumber aria-label="Cantidad" min={1} max={Math.max(left, 1)} value={q} controls={false} changeOnWheel={false} onChange={(v) => setQty(Number(v) || 1)} style={{ width: 56, textAlign: "center" }} />
                <Button aria-label="Más" icon={<PlusOutlined />} disabled={q >= left} onClick={() => setQty(q + 1)} />
              </Flex>
            </Flex>

            {out || maxed || stock <= 2
              ? <Alert type={out ? "error" : "warning"} showIcon title={note} />
              : <Typography.Text type="secondary">{note}</Typography.Text>}

            <Button type="primary" size="large" block disabled={out || maxed} onClick={add}>Agregar al pedido</Button>

            <Collapse
              activeKey={panels}
              onChange={(k) => setPanels(Array.isArray(k) ? k : [k])}
              items={[
                { key: "warr", label: <WarrantyLabel w={w} />, children: <WarrantyBody w={w} /> },
                { key: "specs", label: "Ficha técnica", children: <SpecsBody product={product} /> }
              ]}
              style={{ background: token.colorBgContainer }}
            />
          </Flex>
        </Col>
      </Row>
    </Modal>
  );
}
