import * as Sentry from "@sentry/react-native";
import type { Event, EventHint } from "@sentry/react-native";

const SENSITIVE = /^(nss|curp|clabe|salary|salario|password|contraseña|rfc|bank|banco|imss|cuenta|tarjeta|card|token|secret|pin|razon_social|nombre|apellido|telefono|celular|email|direccion|cp|colonia|ciudad)$/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE.test(k) ? "[Filtered]" : scrub(v, depth + 1);
  }
  return out;
}

function beforeSendPII(event: Event, _hint: EventHint): Event | null {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete (event.request as Record<string, unknown>).headers;
  }
  if (event.user) {
    event.user = { id: event.user.id };
  }
  if (event.extra) {
    event.extra = scrub(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrub(event.contexts) as Record<string, unknown>;
  }
  if (event.breadcrumbs?.values) {
    event.breadcrumbs.values = event.breadcrumbs.values.map(bc => ({
      ...bc,
      data: bc.data ? (scrub(bc.data) as Record<string, unknown>) : bc.data,
    }));
  }
  return event;
}

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return; // no inicializar sin DSN (dev sin variable)

  Sentry.init({
    dsn,
    environment: __DEV__ ? "development" : "production",
    sendDefaultPii: false,          // NO enviar device ID, IP, headers
    tracesSampleRate: __DEV__ ? 0 : 0.05,
    attachScreenshot: false,        // capturas de pantalla pueden mostrar datos
    attachViewHierarchy: false,     // jerarquía puede exponer labels con datos
    beforeSend: beforeSendPII,
    integrations: [],
  });
}

export { Sentry };
