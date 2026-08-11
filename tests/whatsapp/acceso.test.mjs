import test from "node:test";
import assert from "node:assert/strict";
import { tieneAccesoCartesPlus } from "../../channels/whatsapp/functions/lib-acceso-cartes.mjs";

test("una suscripción autorizada mantiene Cartes Plus", () => {
  assert.equal(tieneAccesoCartesPlus({ status: "authorized" }, new Date("2026-07-30T12:00:00Z")), true);
});

test("una renovación cancelada conserva acceso hasta la fecha pagada", () => {
  const registro = {
    status: "cancelled",
    renovacion_cancelada: true,
    access_until: "2026-08-15T06:00:00Z"
  };
  assert.equal(tieneAccesoCartesPlus(registro, new Date("2026-08-01T12:00:00Z")), true);
});

test("al vencer el periodo cancelado regresa automáticamente al plan gratuito", () => {
  const registro = {
    status: "cancelled",
    renovacion_cancelada: true,
    access_until: "2026-08-15T06:00:00Z"
  };
  assert.equal(tieneAccesoCartesPlus(registro, new Date("2026-08-15T06:00:00Z")), false);
  assert.equal(tieneAccesoCartesPlus(registro, new Date("2026-08-16T12:00:00Z")), false);
});

test("una cancelación antigua sin fecha no concede acceso", () => {
  assert.equal(tieneAccesoCartesPlus({ status: "cancelled" }, new Date("2026-07-30T12:00:00Z")), false);
});
