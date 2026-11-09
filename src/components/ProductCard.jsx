import { Card, Flex, Tag, Typography, theme } from "antd";
import PhoneArt from "./PhoneArt";
import { cop, gbLabel } from "../lib/format";
import { fromPrice, totalStock } from "../lib/catalog";
import { FONT_DISPLAY } from "../theme";

export default function ProductCard({ product: p, catalog, compact, onOpen }) {
  const { token } = theme.useToken();
  const { colors, warr, shop } = catalog;
  const stock = totalStock(p);
  const first = p.colors[0];
  const open = () => onOpen(p.id);

  return (
    <Card
      hoverable
      role="button"
      tabIndex={0}
      aria-label={`Ver ${p.name}`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      style={{ height: "100%", overflow: "hidden", opacity: stock === 0 ? 0.78 : 1 }}
      styles={{
        cover: {
          margin: 0,
          borderBottom: `1px solid ${token.colorBorderSecondary}`
        },
        body: { padding: compact ? 10 : 14 }
      }}
      cover={
        <PhoneArt product={p} color={first} colorName={colors[first][0]} hex={colors[first][1]} ratio="4 / 3">
          <Tag style={{ position: "absolute", top: 8, left: 8, margin: 0 }}>{p.cond}</Tag>
          {stock === 0 ? (
            <Tag color="error" variant="solid" style={{ position: "absolute", bottom: 8, left: 8, margin: 0 }}>
              Agotado
            </Tag>
          ) : (
            <Tag color={token.colorPrimary} variant="solid" style={{ position: "absolute", bottom: 8, left: 8, margin: 0 }}>
              Garantía {warr[p.warr].months} meses
            </Tag>
          )}
        </PhoneArt>
      }
    >
      <Flex vertical gap={2}>
        <Typography.Text strong style={{ fontFamily: FONT_DISPLAY, fontSize: compact ? 15 : 18 }}>{p.name}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>{p.storages.map((s) => gbLabel(s.gb)).join(" · ")}</Typography.Text>
        <Typography.Text strong style={{ fontSize: compact ? 15 : 17, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
          Desde {cop(fromPrice(p), shop.currency)}
        </Typography.Text>
        {stock === 0 ? (
          <Typography.Text type="danger" strong style={{ fontSize: 13 }}>
            Agotado
          </Typography.Text>
        ) : stock <= 2 ? (
          <Typography.Text type="warning" strong style={{ fontSize: 13 }}>
            Últimas {stock} unidades
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Disponible ({stock} uds)
          </Typography.Text>
        )}
      </Flex>
    </Card>
  );
}
