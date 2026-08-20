import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const wa = fs.readFileSync(
  new URL(
    "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
    import.meta.url
  ),
  "utf8"
);

const web = fs.readFileSync(
  new URL(
    "../../channels/web/public/bot/guia-masonico.js",
    import.meta.url
  ),
  "utf8"
);

const api = fs.readFileSync(
  new URL(
    "../../core/ai/guia-masonico.mjs",
    import.meta.url
  ),
  "utf8"
);

test("117-M01 WA límite bloqueado recibe reservation con cycle_end", () => {
  assert.match(
    wa,
    /if \(!reservation\.permitida\)[\s\S]*?ofrecerCartesPlusPorLimite\([\s\S]*?usage:\s*reservation/
  );
});

test("117-M01 WA quinta consulta usa estado posterior", () => {
  assert.match(
    wa,
    /const usageAfterQuery[\s\S]*?ofrecerCartesPlusPorLimite\([\s\S]*?usage:\s*usageAfterQuery/
  );
});

test("117-M01 WA muestra fecha real y no una fecha fija", () => {
  assert.match(
    wa,
    /function ofrecerCartesPlusPorLimite[\s\S]*?usage\?\.cycle_end[\s\S]*?formatDateForUser/
  );

  assert.match(
    wa,
    /Tus 5 consultas gratuitas estarán disponibles nuevamente/
  );
});

test("117-M01 D03 reingreso gratuito muestra vigencia del ciclo", () => {
  assert.match(
    wa,
    /Bienvenido de nuevo a Cartes[\s\S]*?plan !== "plus"[\s\S]*?usage\?\.cycle_end[\s\S]*?se renuevan el/
  );
});

test("117-M01 cuenta nueva indica que el ciclo todavía no comenzó", () => {
  assert.match(
    wa,
    /Tu periodo de 30 días comenzará con la primera consulta válida que Cartes responda/
  );
});

test("117-M01 Mi suscripción WA usa cycle_end para gratuito", () => {
  assert.match(
    wa,
    /const freeCycleEnd[\s\S]*?formatDateForUser\(usage\?\.cycle_end\)[\s\S]*?Renovación de consultas gratuitas/
  );
});

test("117-M01 Web 0 de 5 usa cycle_end real", () => {
  assert.match(
    web,
    /function mostrarLimiteGratuitoWeb\(usage\)[\s\S]*?usage\?\.cycle_end[\s\S]*?formatCartesDateWeb/
  );

  assert.match(
    web,
    /Tus 5 consultas gratuitas estarán disponibles nuevamente/
  );
});

test("117-M01 Mi suscripción Web usa cycle_end para gratuito", () => {
  assert.match(
    web,
    /const freeCycleEnd[\s\S]*?formatCartesDateWeb\(usage\?\.cycle_end\)[\s\S]*?Renovación de consultas gratuitas/
  );
});

test("117-M01 Web refresca usage después de completar consulta", () => {
  assert.match(
    api,
    /await completarConsultaMensual\([\s\S]*?usageResponse\s*=\s*[\s\S]*?await obtenerEstadoUsoMensual/
  );
});