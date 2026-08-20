import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../channels/whatsapp/functions/cartes-whatsapp.mjs", import.meta.url),
  "utf8"
);

test("V099 elimina el mensaje redundante Selecciona una acción", () => {
  assert.doesNotMatch(source, /body:\s*"Selecciona una acción:"/);
});

test("V099 usa Mi suscripción como body del mensaje con botones", () => {
  assert.match(source, /CARTES_SUBSCRIPTION_BUTTONS_V099/);
  assert.match(source, /body:\s*subscriptionText/);
});

test("V099 conserva Comprar revisiones y Menú", () => {
  assert.match(source, /id:\s*"review_pack_buy"[\s\S]*?title:\s*"Comprar revisiones"/);
  assert.match(source, /id:\s*"menu_main"[\s\S]*?title:\s*"Menú"/);
});
