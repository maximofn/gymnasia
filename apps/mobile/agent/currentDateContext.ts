/**
 * Fecha de hoy para Coach (GYM-270, ticket para que Coach lea un periodo de
 * fechas de una vez). Sin ella, el modelo interpreta «este mes» con la fecha
 * que cree recordar de su entrenamiento y consulta un periodo equivocado.
 *
 * Solo se envía la fecha civil local: ni hora ni zona horaria, que darían pistas
 * de dónde vive el usuario. Se calcula en cada petición, así que una
 * conversación que cruza la medianoche recibe la fecha nueva.
 */
import { localDateKey } from "../measurements/measurementContract";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export function createCurrentDateContext(now: Date = new Date()): string {
  const weekday = WEEKDAYS[now.getDay()];
  const month = MONTHS[now.getMonth()];
  return [
    "## Fecha de hoy",
    "",
    `Hoy es ${weekday}, ${now.getDate()} de ${month} de ${now.getFullYear()} (${localDateKey(now)}) para el usuario. ` +
      "Usa esta fecha para interpretar «hoy», «ayer», «esta semana», «este mes», «el mes pasado» y cualquier otra fecha relativa, " +
      "y para calcular los argumentos from y to de las herramientas por periodo.",
  ].join("\n");
}

/** Añade la fecha de hoy tras las instrucciones fijas, que siguen siendo un prefijo estable. */
export function appendCurrentDateContext(basePrompt: string, now: Date = new Date()): string {
  const base = basePrompt.trim();
  const context = createCurrentDateContext(now);
  return base ? `${base}\n\n${context}` : context;
}
