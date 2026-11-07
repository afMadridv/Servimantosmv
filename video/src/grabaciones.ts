/* Grabaciones reales de la interfaz (ver GUION.md → «Guía de grabación»).
   Cada clip tiene su carpeta en public/grabaciones/<ID>/ con:
     movil.mp4       → 9:16, celular (o PWA instalada)
     escritorio.mp4  → 16:9, navegador de escritorio
   Al copiar un archivo, pon su bandera en true. */
export type Clip = {
  nombre: string;
  movil: boolean;
  escritorio: boolean;
  desde: number;     // segundos a recortar al inicio
  velocidad: number; // 1 = normal; 1.25 acelera esperas
  graba: string;     // recordatorio de qué grabar
};

export const CLIPS: Record<string, Clip> = {
  "REC-01": { nombre: "Ingreso y Formatos", movil: false, escritorio: false, desde: 0, velocidad: 1, graba: "Login → pantalla Formatos → tocar «Reporte de Obra»" },
  "REC-02": { nombre: "Datos del reporte", movil: false, escritorio: false, desde: 0, velocidad: 1.25, graba: "Llenar proyecto, ingeniero, código y contrato; la fecha sale sola" },
  "REC-03": { nombre: "Hojas de fotos", movil: false, escritorio: false, desde: 0, velocidad: 1.25, graba: "Cargar 4 fotos, escribir sus descripciones, agregar hoja" },
  "REC-04": { nombre: "Vista previa y PDF", movil: false, escritorio: false, desde: 0, velocidad: 1, graba: "Vista previa → Generar PDF → descarga y banner «listo»" },
  "REC-05": { nombre: "Historial y edición", movil: false, escritorio: false, desde: 0, velocidad: 1.25, graba: "Buscar en Historial → Editar → volver a generar" },
  "REC-06": { nombre: "Administrar página", movil: false, escritorio: false, desde: 0, velocidad: 1.25, graba: "Nuevo proyecto con fotos → guardar → el sitio público lo muestra" },
};

export const rutaClip = (id: string, tipo: "movil" | "escritorio") => `grabaciones/${id}/${tipo}.mp4`;
