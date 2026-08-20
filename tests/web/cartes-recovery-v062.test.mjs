import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const web = fs.readFileSync(
  new URL("../../channels/web/public/bot/guia-masonico.js", import.meta.url),
  "utf8"
);

test("Plus no vinculado muestra aviso de recuperación por WhatsApp", () => {
  assert.match(
    web,
    /Protege tu cuenta Cartes Plus: vincúlala con WhatsApp/
  );

  assert.match(
    web,
    /recuperar tu suscripción, consultas y conversación/
  );

  assert.match(
    web,
    /currentWebPlan === "plus"/
  );

  assert.match(
    web,
    /recoveryNoticeShown/
  );
});