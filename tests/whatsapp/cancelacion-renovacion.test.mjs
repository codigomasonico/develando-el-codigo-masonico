import test from "node:test";
import assert from "node:assert/strict";
import {
  construirBotonesCancelacion,
  construirMenuMiSuscripcion
} from "../../channels/whatsapp/functions/lib-menu-cartes.mjs";

test("la confirmación informa la fecha hasta la que se conservan beneficios", () => {
  const payload = construirBotonesCancelacion({ fechaFin: "15 de agosto de 2026" });
  assert.match(payload.body, /cancelar la renovación/i);
  assert.match(payload.body, /15 de agosto de 2026/);
  assert.match(payload.body, /no se realizarán nuevos cobros/i);
});

test("una renovación ya cancelada no vuelve a ofrecer la baja", () => {
  const payload = construirMenuMiSuscripcion({
    resumen: "Cartes Plus",
    cancelable: false,
    plusActivo: true
  });
  const ids = payload.sections.flatMap((section) => section.rows.map((row) => row.id));
  assert.equal(ids.includes("suscripcion_cancelar"), false);
  assert.equal(ids.includes("revision_iniciar"), true);
});
