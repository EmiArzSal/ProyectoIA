// REN-06: Prueba de estrés por escalones (Grafana k6).
//
// Aumenta la carga en escalones de 100 usuarios virtuales (100 → 200 → 300 → 400)
// con las mismas seis operaciones de REN-04 y se detiene sola cuando el sistema
// se degrada: P95 > 2 s (KPI-02) o más de 1 % de solicitudes fallidas. El último
// escalón completado antes de detenerse es la capacidad máxima.
//
// Excluye el flujo de entrevista: depende de los servicios de IA (costo por uso y
// límites del proveedor) y se valida en la prueba de aceptación con usuarios reales.
//
// Uso:
//   1. Crea tests/load/cuentas.json (NO se sube al repositorio) con cuentas de prueba:
//        [{ "email": "prueba01@alumno.ipn.mx", "password": "..." }, ...]
//   2. Ejecuta:
//        K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=ren-06-reporte.html \
//        k6 run -e BASE_URL=https://agora-hub.vercel.app tests/load/ren-06-estres.js
//
// Los registros que crea cada iteración se eliminan en la misma iteración.

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Trend, Counter } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const STEP_HOLD = __ENV.STEP_HOLD || "3m"; // tiempo en cada escalón
const THINK_TIME_S = Number(__ENV.THINK_TIME_S || 1); // pausa entre iteraciones

const accounts = new SharedArray("cuentas", () => JSON.parse(open("./cuentas.json")));

// Tiempo por operación, para reportar cada una por separado.
const t = {
  getStats: new Trend("op_meetings_getStats", true),
  getMany: new Trend("op_meetings_getMany", true),
  glossaryCreate: new Trend("op_glossary_create", true),
  dictionaryCreate: new Trend("op_dictionary_create", true),
  glossaryRemove: new Trend("op_glossary_remove", true),
  dictionaryRemove: new Trend("op_dictionary_remove", true),
};
const iterationsDone = new Counter("iteraciones_completas");

export const options = {
  scenarios: {
    escalones: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 }, { duration: STEP_HOLD, target: 100 },
        { duration: "1m", target: 200 }, { duration: STEP_HOLD, target: 200 },
        { duration: "1m", target: 300 }, { duration: STEP_HOLD, target: 300 },
        { duration: "1m", target: 400 }, { duration: STEP_HOLD, target: 400 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // KPI-02: P95 ≤ 2 s. Se evalúa después del primer minuto para no cortar en el arranque.
    http_req_duration: [{ threshold: "p(95)<2000", abortOnFail: true, delayAbortEval: "1m" }],
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "1m" }],
    checks: ["rate>0.99"],
  },
  setupTimeout: "5m",
};

// Inicia sesión una vez con cada cuenta y comparte las cookies con los usuarios virtuales.
export function setup() {
  if (accounts.length === 0) throw new Error("cuentas.json está vacío");
  const sessions = [];
  for (const acc of accounts) {
    const res = http.post(
      `${BASE_URL}/api/auth/sign-in/email`,
      JSON.stringify({ email: acc.email, password: acc.password }),
      { headers: { "Content-Type": "application/json" }, tags: { name: "setup_sign_in" } },
    );
    const name = Object.keys(res.cookies).find((n) => n.includes("session_token"));
    if (res.status !== 200 || !name) {
      throw new Error(`No se pudo iniciar sesión con ${acc.email} (HTTP ${res.status})`);
    }
    sessions.push(`${name}=${res.cookies[name][0].value}`);
    sleep(0.5); // evita el límite de intentos de inicio de sesión
  }
  return { sessions };
}

const trpcGet = (path, input, cookie, tag) => {
  const query = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  return http.get(`${BASE_URL}/api/trpc/${path}${query}`, { headers: { Cookie: cookie }, tags: { name: tag } });
};

const trpcPost = (path, input, cookie, tag) =>
  http.post(`${BASE_URL}/api/trpc/${path}`, JSON.stringify(input), {
    headers: { "Content-Type": "application/json", Cookie: cookie },
    tags: { name: tag },
  });

const resultData = (res) => {
  try { return res.json("result.data"); } catch { return null; }
};

export default function ren06(data) {
  const cookie = data.sessions[(__VU - 1) % data.sessions.length];
  const unique = `ren06-${__VU}-${__ITER}-${Date.now()}`;

  // Consultas
  let res = trpcGet("meetings.getStats", undefined, cookie, "meetings.getStats");
  t.getStats.add(res.timings.duration);
  check(res, { "getStats 200": (r) => r.status === 200 });

  res = trpcGet("meetings.getMany", { page: 1, pageSize: 10 }, cookie, "meetings.getMany");
  t.getMany.add(res.timings.duration);
  check(res, { "getMany 200": (r) => r.status === 200 });

  // Escrituras (identificadores únicos: el glosario no acepta términos repetidos)
  res = trpcPost("glossary.create", { term: unique, definition: "Registro de prueba REN-06" }, cookie, "glossary.create");
  t.glossaryCreate.add(res.timings.duration);
  const card = resultData(res);
  check(res, { "glossary.create 200": (r) => r.status === 200 && !!card });

  res = trpcPost(
    "dictionary.create",
    { word: unique, definition: "Registro de prueba REN-06", language: "en" },
    cookie,
    "dictionary.create",
  );
  t.dictionaryCreate.add(res.timings.duration);
  const word = resultData(res);
  check(res, { "dictionary.create 200": (r) => r.status === 200 && !!word });

  // Eliminaciones de lo creado en esta misma iteración
  if (card && card.id) {
    res = trpcPost("glossary.remove", { id: card.id }, cookie, "glossary.remove");
    t.glossaryRemove.add(res.timings.duration);
    check(res, { "glossary.remove 200": (r) => r.status === 200 });
  }
  if (word && word.id) {
    res = trpcPost("dictionary.remove", { id: word.id }, cookie, "dictionary.remove");
    t.dictionaryRemove.add(res.timings.duration);
    check(res, { "dictionary.remove 200": (r) => r.status === 200 });
  }

  iterationsDone.add(1);
  sleep(THINK_TIME_S);
}
