import { Descriptions, Flex, Tag, Typography, theme } from "antd";
import { gbLabel } from "../lib/format";

const List = ({ items, ordered }) => {
  const Tagname = ordered ? "ol" : "ul";
  return <Tagname className="tight-list">{items.map((t) => <li key={t}>{t}</li>)}</Tagname>;
};

export function WarrantyLabel({ w }) {
  const { token } = theme.useToken();
  return <Flex align="center" gap={8} wrap><Tag color={token.colorPrimary} variant="solid" style={{ margin: 0 }}>{w.months} meses</Tag><Typography.Text strong>{w.who}</Typography.Text></Flex>;
}

export function WarrantyBody({ w }) {
  return (
    <Flex vertical gap={14}>
      <Typography.Text>{w.lead}</Typography.Text>
      <div><Typography.Text type="success" strong style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>Qué cubre</Typography.Text><List items={w.covers} /></div>
      <div><Typography.Text type="warning" strong style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>Qué no cubre</Typography.Text><List items={w.excludes} /></div>
      <div><Typography.Text type="secondary" strong style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>Cómo hacerla válida</Typography.Text><List items={w.how} ordered /></div>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>{w.note}</Typography.Text>
    </Flex>
  );
}

export function SpecsBody({ product }) {
  const items = [
    ...product.specs.map(([label, value]) => ({ key: label, label, children: value })),
    { key: "capacidades", label: "Capacidades", children: product.storages.map((s) => gbLabel(s.gb)).join(", ") }
  ];
  return <Descriptions column={1} size="small" items={items} />;
}
