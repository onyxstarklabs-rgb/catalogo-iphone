const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT = 15 * 1024 * 1024;
const MAX_OUTPUT = 2 * 1024 * 1024; // mismo tope que el bucket de Supabase
const MAX_SIDE = 1600;

/**
 * Valida y re-codifica la foto en el navegador: solo JPG/PNG/WebP, máx. 1600 px por lado, salida WebP.
 * Re-codificar descarta metadatos (EXIF/GPS) y cualquier contenido que no sea la imagen en sí.
 */
export async function prepareImage(file) {
  if (!file || !OK_TYPES.includes(file.type)) throw new Error("Formato no admitido: usa JPG, PNG o WebP");
  if (file.size > MAX_INPUT) throw new Error("La imagen pesa más de 15 MB");
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error("No se pudo leer la imagen"); }
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * s));
  canvas.height = Math.max(1, Math.round(bmp.height * s));
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  // Fotos de cámaras de gama alta (hasta 15 MB) se reducen: si 0.85 no cabe en el tope, se baja la calidad.
  let blob = null;
  for (const q of [0.85, 0.7, 0.55]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", q));
    if (!blob || blob.size <= MAX_OUTPUT) break;
  }
  if (!blob) throw new Error("No se pudo procesar la imagen");
  if (blob.size > MAX_OUTPUT) throw new Error("No se pudo reducir la imagen al tamaño permitido; prueba con otra");
  const preview = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("No se pudo leer la imagen"));
    r.readAsDataURL(blob);
  });
  return { blob, contentType: "image/webp", ext: "webp", preview };
}
