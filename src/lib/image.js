const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT = 8 * 1024 * 1024;
const MAX_OUTPUT = 2 * 1024 * 1024; // mismo tope que el bucket de Supabase
const MAX_SIDE = 1200;

/**
 * Valida y re-codifica la foto en el navegador: solo JPG/PNG/WebP, máx. 1200 px por lado, salida WebP.
 * Re-codificar descarta metadatos (EXIF/GPS) y cualquier contenido que no sea la imagen en sí.
 */
export async function prepareImage(file) {
  if (!file || !OK_TYPES.includes(file.type)) throw new Error("Formato no admitido: usa JPG, PNG o WebP");
  if (file.size > MAX_INPUT) throw new Error("La imagen pesa más de 8 MB");
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error("No se pudo leer la imagen"); }
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * s));
  canvas.height = Math.max(1, Math.round(bmp.height * s));
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen");
  if (blob.size > MAX_OUTPUT) throw new Error("La imagen sigue pesando más de 2 MB; usa una más pequeña");
  const preview = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("No se pudo leer la imagen"));
    r.readAsDataURL(blob);
  });
  return { blob, contentType: "image/webp", ext: "webp", preview };
}
