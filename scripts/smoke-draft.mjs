import fs from "node:fs/promises";

const rawUrl = process.argv[2];
if (!rawUrl) {
  console.error("Falta la URL del Draft Deploy.");
  process.exit(2);
}

const base = rawUrl.replace(/\/+$/, "");
const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, pass: true, ms: Date.now() - started });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({
      name,
      pass: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
    console.log(`FAIL  ${name}`);
    console.log(`      ${results.at(-1).error}`);
  }
}

async function get(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    redirect: options.redirect ?? "follow",
    headers: {
      "User-Agent": "Cartes-Smoke-Test/1.0"
    }
  });
  const text = options.body === false ? "" : await response.text();
  return { response, text };
}

function expectStatus(actual, expected, path) {
  if (actual !== expected) {
    throw new Error(`${path}: HTTP ${actual}, se esperaba ${expected}`);
  }
}

await check("Sitio principal responde", async () => {
  const { response, text } = await get("/");
  expectStatus(response.status, 200, "/");
  if (!/<html/i.test(text)) throw new Error("/ no devolvio HTML.");
});

await check("CSS principal disponible", async () => {
  const { response } = await get("/assets/css/styles.css", { body: false });
  expectStatus(response.status, 200, "/assets/css/styles.css");
});

await check("JavaScript principal disponible", async () => {
  const { response } = await get("/assets/js/app.js", { body: false });
  expectStatus(response.status, 200, "/assets/js/app.js");
});

await check("Interfaz de Cartes disponible", async () => {
  const { response } = await get("/bot/guia-masonico.js", { body: false });
  expectStatus(response.status, 200, "/bot/guia-masonico.js");
});

await check("Pagina comunidad disponible", async () => {
  const { response } = await get("/comunidad.html", { body: false });
  expectStatus(response.status, 200, "/comunidad.html");
});

await check("Pagina episodios disponible", async () => {
  const { response } = await get("/episodios.html", { body: false });
  expectStatus(response.status, 200, "/episodios.html");
});

await check("Terminos de Cartes disponibles", async () => {
  const { response } = await get("/cartes-whatsapp/terminos.html", { body: false });
  expectStatus(response.status, 200, "/cartes-whatsapp/terminos.html");
});

await check("Aviso de privacidad de Cartes disponible", async () => {
  const { response } = await get("/cartes-whatsapp/privacy.html", { body: false });
  expectStatus(response.status, 200, "/cartes-whatsapp/privacy.html");
});

await check("Funcion estado responde correctamente", async () => {
  const { response, text } = await get("/.netlify/functions/estado");
  expectStatus(response.status, 200, "/.netlify/functions/estado");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("estado no devolvio JSON valido."); }
  if (data?.estado !== "funcionando") throw new Error(`estado inesperado: ${JSON.stringify(data)}`);
});

await check("Launcher de WhatsApp redirige correctamente en dos etapas", async () => {
  const primera = await fetch(`${base}/cartes-whatsapp`, {
    redirect: "manual",
    headers: { "User-Agent": "Cartes-Smoke-Test/1.0" }
  });

  if (![301, 302, 307, 308].includes(primera.status)) {
    throw new Error(`/cartes-whatsapp: HTTP ${primera.status}, se esperaba redireccion.`);
  }

  const locationInterna = primera.headers.get("location") || "";
  if (locationInterna !== "/.netlify/functions/cartes-acceso") {
    throw new Error(
      `Primera redireccion inesperada: ${locationInterna || "(sin Location)"}`
    );
  }

  const segunda = await fetch(`${base}${locationInterna}`, {
    redirect: "manual",
    headers: { "User-Agent": "Cartes-Smoke-Test/1.0" }
  });

  if (![301, 302, 307, 308].includes(segunda.status)) {
    throw new Error(
      `cartes-acceso: HTTP ${segunda.status}, se esperaba redireccion a WhatsApp.`
    );
  }

  const locationWhatsApp = segunda.headers.get("location") || "";
  if (!locationWhatsApp.startsWith("https://wa.me/")) {
    throw new Error(
      `Redireccion final inesperada: ${locationWhatsApp || "(sin Location)"}`
    );
  }
});

const passed = results.filter(r => r.pass).length;
const total = results.length;
const pct = total ? (passed / total) * 100 : 0;

const report = {
  generated_at: new Date().toISOString(),
  draft_url: base,
  passed,
  total,
  percent: Number(pct.toFixed(2)),
  gate: pct === 100 ? "PASS" : "FAIL",
  results
};

await fs.mkdir("reports", { recursive: true });
await fs.writeFile(
  "reports/smoke-draft-report.json",
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("");
console.log("========================================");
console.log("CARTES DRAFT SMOKE REPORT");
console.log("========================================");
console.log(`Resultado: ${passed}/${total}`);
console.log(`Smoke: ${pct.toFixed(2)}%`);
console.log(`SMOKE GATE: ${report.gate}`);
console.log("Reporte JSON: reports/smoke-draft-report.json");

process.exit(report.gate === "PASS" ? 0 : 1);
