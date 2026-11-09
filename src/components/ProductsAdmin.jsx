import { useState } from "react";
import { Alert, App as AntApp, AutoComplete, Button, Flex, Form, Input, InputNumber, Modal, Select, Tag, Typography, Upload, theme } from "antd";
import { DeleteOutlined, PictureOutlined, PlusOutlined } from "@ant-design/icons";
import PhoneArt from "./PhoneArt";
import { prepareImage } from "../lib/image";
import { cop, gbLabel } from "../lib/format";
import { CATEGORIES, CATEGORY_BY_KEY } from "../lib/categories";
import { FONT_DISPLAY } from "../theme";

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Selector de foto: valida y re-codifica en el navegador; devuelve la imagen lista para subir. */
function PhotoPicker({ value, onChange, current }) {
  const { message } = AntApp.useApp();
  const [busy, setBusy] = useState(false);
  const shown = value?.preview || current;
  return (
    <Flex align="center" gap={12} wrap>
      <div style={{ width: 96, height: 96, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: 8 }}>
        {shown ? <img src={shown} alt="Vista previa" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <PictureOutlined style={{ fontSize: 28 }} />}
      </div>
      <Flex vertical gap={6}>
        <Upload
          accept={ACCEPT}
          showUploadList={false}
          maxCount={1}
          beforeUpload={async (file) => {
            setBusy(true);
            try { onChange(await prepareImage(file)); } catch (e) { message.error(e.message); } finally { setBusy(false); }
            return false;
          }}
        >
          <Button icon={<PictureOutlined />} loading={busy}>{shown ? "Cambiar foto" : "Elegir foto"}</Button>
        </Upload>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>JPG, PNG o WebP de hasta 15 MB. Se optimiza sola.</Typography.Text>
      </Flex>
    </Flex>
  );
}

function ProductFormModal({ open, onClose, catalog, editing }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const category = Form.useWatch("category", form) ?? editing?.category ?? "iphone";
  const withCapacity = CATEGORY_BY_KEY[category].storage;
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const { colors, warr, products, createProduct, updateProduct } = catalog;

  const lines = [...new Set(products.map((p) => p.line))];
  const conds = [...new Set(["Nuevo", "Reacondicionado A", "Reacondicionado B", ...products.map((p) => p.cond)])];
  const initial = editing
    ? { name: editing.name, category: editing.category, line: editing.line, cond: editing.cond, warr: editing.warr, colors: editing.colors, storages: editing.storages, specs: editing.specs.map(([label, value]) => ({ label, value })) }
    : { category: "iphone", cond: "Nuevo", warr: Object.keys(warr)[0], colors: [], storages: [{ gb: 128, price: 1000000, stock: 1 }], specs: [] };

  const submit = async (values) => {
    setBusy(true);
    const res = editing ? await updateProduct(editing.id, values, image) : await createProduct(values, image);
    setBusy(false);
    if (res.ok) { message.success(editing ? "Producto actualizado" : "Producto creado y publicado"); onClose(); }
    else message.error(`No se pudo guardar: ${res.error}`);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={editing ? `Editar ${editing.name}` : "Nuevo producto"}
      okText={editing ? "Guardar cambios" : "Crear producto"}
      cancelText="Cancelar"
      onOk={() => form.submit()}
      okButtonProps={{ loading: busy }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: !busy }}
      destroyOnHidden
      width={620}
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={initial} onFinish={submit} style={{ marginTop: 12 }}
        onValuesChange={(changed, all) => {
          if (!changed.category) return;
          const first = all.storages?.[0] ?? { price: 1000000, stock: 1 };
          form.setFieldValue("storages", CATEGORY_BY_KEY[changed.category].storage
            ? [{ gb: all.storages?.[0]?.gb > 0 ? all.storages[0].gb : 128, price: first.price, stock: first.stock }]
            : [{ gb: 0, price: first.price, stock: first.stock }]);
        }}
      >
        <Form.Item name="category" label="Categoría" rules={[{ required: true }]}>
          <Select options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
        </Form.Item>
        <Form.Item name="name" label="Nombre" rules={[{ required: true, whitespace: true, message: "Escribe el nombre" }, { max: 80, message: "Máximo 80 caracteres" }]}>
          <Input maxLength={80} placeholder={withCapacity ? "iPhone 16 Pro" : "AirPods Pro"} />
        </Form.Item>
        <Flex gap={12} wrap>
          <Form.Item name="line" label="Línea (filtro del catálogo)" rules={[{ required: true, whitespace: true, message: "Elige o escribe una línea" }, { max: 40, message: "Máximo 40 caracteres" }]} style={{ flex: "1 1 220px" }}>
            <AutoComplete options={lines.map((l) => ({ value: l }))} maxLength={40} placeholder={withCapacity ? "iPhone 16" : "AirPods"} />
          </Form.Item>
          <Form.Item name="cond" label="Condición" rules={[{ required: true }]} style={{ flex: "1 1 180px" }}>
            <Select options={conds.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="warr" label="Garantía" rules={[{ required: true }]} style={{ flex: "1 1 180px" }}>
            <Select options={Object.entries(warr).map(([k, w]) => ({ value: k, label: `${w.months} meses` }))} />
          </Form.Item>
        </Flex>
        <Form.Item name="colors" label="Colores disponibles" rules={[{ required: true, type: "array", min: 1, max: 8, message: "Elige de 1 a 8 colores" }]}>
          <Select
            mode="multiple"
            maxCount={8}
            optionFilterProp="label"
            options={Object.entries(colors).map(([k, [name, hex]]) => ({ value: k, label: name, hex }))}
            optionRender={(o) => <Flex align="center" gap={8}><span className="swatch" style={{ background: o.data.hex }} />{o.data.label}</Flex>}
          />
        </Form.Item>

        {!withCapacity && (
          <>
            <Typography.Text strong>Precio y stock</Typography.Text>
            <Flex gap={8} wrap style={{ marginTop: 8, marginBottom: 16 }}>
              <Form.Item name={["storages", 0, "gb"]} hidden><InputNumber /></Form.Item>
              <Form.Item name={["storages", 0, "price"]} rules={[{ required: true, message: "Precio" }]} style={{ marginBottom: 0 }}>
                <InputNumber aria-label="Precio en pesos" min={1000} max={99999999} precision={0} step={10000} addonBefore="$" style={{ width: 180 }} />
              </Form.Item>
              <Form.Item name={["storages", 0, "stock"]} rules={[{ required: true, message: "Stock" }]} style={{ marginBottom: 0 }}>
                <InputNumber aria-label="Unidades en stock" min={0} max={999} precision={0} addonAfter="uds" style={{ width: 130 }} />
              </Form.Item>
            </Flex>
          </>
        )}
        {withCapacity && (
          <>
        <Typography.Text strong>Capacidades, precio y stock</Typography.Text>
        <Form.List name="storages">
          {(fields, { add, remove }) => (
            <Flex vertical gap={8} style={{ marginTop: 8, marginBottom: 16 }}>
              {fields.map((f) => (
                <Flex key={f.key} gap={8} align="start" wrap>
                  <Form.Item name={[f.name, "gb"]} rules={[{ required: true, message: "GB" }, ({ getFieldValue }) => ({ validator: (_, v) => (getFieldValue("storages").filter((s) => s && s.gb === v).length > 1 ? Promise.reject(new Error("Capacidad repetida")) : Promise.resolve()) })]} style={{ marginBottom: 0 }}>
                    <InputNumber aria-label="Capacidad en GB" min={1} max={8192} precision={0} addonAfter="GB" style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item name={[f.name, "price"]} rules={[{ required: true, message: "Precio" }]} style={{ marginBottom: 0 }}>
                    <InputNumber aria-label="Precio en pesos" min={1000} max={99999999} precision={0} step={50000} addonBefore="$" style={{ width: 160 }} />
                  </Form.Item>
                  <Form.Item name={[f.name, "stock"]} rules={[{ required: true, message: "Stock" }]} style={{ marginBottom: 0 }}>
                    <InputNumber aria-label="Unidades en stock" min={0} max={999} precision={0} addonAfter="uds" style={{ width: 120 }} />
                  </Form.Item>
                  <Button aria-label="Quitar capacidad" icon={<DeleteOutlined />} danger disabled={fields.length === 1} onClick={() => remove(f.name)} />
                </Flex>
              ))}
              <Button icon={<PlusOutlined />} onClick={() => add({ gb: undefined, price: 1000000, stock: 1 })} style={{ alignSelf: "flex-start" }} disabled={fields.length >= 8}>Agregar capacidad</Button>
            </Flex>
          )}
        </Form.List>

          </>
        )}

        <Typography.Text strong>Ficha técnica (opcional)</Typography.Text>
        <Form.List name="specs">
          {(fields, { add, remove }) => (
            <Flex vertical gap={8} style={{ marginTop: 8, marginBottom: 16 }}>
              {fields.map((f) => (
                <Flex key={f.key} gap={8} align="start" wrap>
                  <Form.Item name={[f.name, "label"]} rules={[{ required: true, whitespace: true, message: "Título" }, { max: 40 }]} style={{ marginBottom: 0, flex: "1 1 140px" }}>
                    <Input aria-label="Título de la característica" maxLength={40} placeholder="Chip" />
                  </Form.Item>
                  <Form.Item name={[f.name, "value"]} rules={[{ required: true, whitespace: true, message: "Valor" }, { max: 120 }]} style={{ marginBottom: 0, flex: "2 1 200px" }}>
                    <Input aria-label="Valor de la característica" maxLength={120} placeholder="A18 Pro" />
                  </Form.Item>
                  <Button aria-label="Quitar característica" icon={<DeleteOutlined />} danger onClick={() => remove(f.name)} />
                </Flex>
              ))}
              <Button icon={<PlusOutlined />} onClick={() => add({ label: "", value: "" })} style={{ alignSelf: "flex-start" }} disabled={fields.length >= 10}>Agregar característica</Button>
            </Flex>
          )}
        </Form.List>

        <Typography.Text strong>Foto</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <PhotoPicker value={image} onChange={setImage} current={editing?.imageUrl} />
        </div>
      </Form>
    </Modal>
  );
}

export default function ProductsAdmin({ catalog }) {
  const { message, modal } = AntApp.useApp();
  const { token } = theme.useToken();
  const { products, colors, shop, setProductImage, removeProductImage, deleteProduct } = catalog;
  const [formState, setFormState] = useState({ open: false, editing: null });
  const [busyId, setBusyId] = useState(null);

  const changePhoto = async (p, file) => {
    setBusyId(p.id);
    try {
      const img = await prepareImage(file);
      const res = await setProductImage(p.id, img);
      if (res.ok) message.success("Foto actualizada"); else message.error(`No se pudo subir la foto: ${res.error}`);
    } catch (e) { message.error(e.message); } finally { setBusyId(null); }
  };

  const dropPhoto = async (p) => {
    setBusyId(p.id);
    const res = await removeProductImage(p.id);
    setBusyId(null);
    if (res.ok) message.success("Foto quitada"); else message.error(`No se pudo quitar la foto: ${res.error}`);
  };

  const confirmDelete = (p) => modal.confirm({
    title: `Eliminar ${p.name}`,
    content: "Se borra del catálogo con su stock y su foto. No se puede deshacer.",
    okText: "Eliminar",
    cancelText: "Cancelar",
    okButtonProps: { danger: true },
    onOk: async () => {
      const res = await deleteProduct(p.id);
      if (res.ok) message.success("Producto eliminado"); else { message.error(`No se pudo eliminar: ${res.error}`); throw new Error(res.error); }
    }
  });

  return (
    <Flex vertical gap={14}>
      <Alert type="info" showIcon title="Productos y fotos" description="Crea modelos nuevos con su foto, o cambia la foto de cualquier modelo. Todo se publica al instante para todos los clientes." />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormState({ open: true, editing: null })} style={{ alignSelf: "flex-start" }}>Nuevo producto</Button>

      {products.map((p) => (
        <Flex key={p.id} gap={12} align="center" wrap style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadius, padding: 10, background: token.colorBgContainer }}>
          <div style={{ width: 64, height: 64, flex: "none" }}>
            <PhoneArt key={p.imageUrl || p.id} product={p} color={p.colors[0]} colorName={colors[p.colors[0]][0]} hex={colors[p.colors[0]][1]} height={64} />
          </div>
          <Flex vertical gap={2} style={{ flex: "1 1 160px", minWidth: 0 }}>
            <Flex align="center" gap={6} wrap>
              <Typography.Text strong style={{ fontFamily: FONT_DISPLAY }}>{p.name}</Typography.Text>
              {p.custom && <Tag style={{ margin: 0 }}>Nuevo en panel</Tag>}
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{CATEGORY_BY_KEY[p.category].label} · {p.line} · {p.storages.map((s) => `${s.gb > 0 ? `${gbLabel(s.gb)} ` : ""}${cop(s.price, shop.currency)}`).slice(0, 2).join(" · ")}{p.storages.length > 2 ? "…" : ""}</Typography.Text>
          </Flex>
          <Flex gap={6} wrap>
            <Upload accept={ACCEPT} showUploadList={false} beforeUpload={(file) => { changePhoto(p, file); return false; }}>
              <Button size="small" icon={<PictureOutlined />} loading={busyId === p.id}>{p.imageUrl ? "Cambiar foto" : "Subir foto"}</Button>
            </Upload>
            {p.imageUrl && <Button size="small" disabled={busyId === p.id} onClick={() => dropPhoto(p)}>Quitar foto</Button>}
            {p.custom && <Button size="small" onClick={() => setFormState({ open: true, editing: p })}>Editar</Button>}
            {p.custom && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDelete(p)}>Eliminar</Button>}
          </Flex>
        </Flex>
      ))}

      {formState.open && <ProductFormModal open onClose={() => setFormState({ open: false, editing: null })} catalog={catalog} editing={formState.editing} />}
    </Flex>
  );
}
