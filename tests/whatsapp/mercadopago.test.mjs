import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  construirPayloadPlan,
  crearPlanMercadoPago,
  validarFirmaMercadoPago
} from "../../channels/whatsapp/functions/lib-mercadopago.mjs";
import {
  liberarNotificacionSuscripcion,
  reclamarNotificacionSuscripcion
} from "../../channels/whatsapp/functions/lib-cartes.mjs";

function conEntorno(variables, fn) {
  const anteriores = {};
  for (const [clave, valor] of Object.entries(variables)) {
    anteriores[clave] = process.env[clave];
    process.env[clave] = valor;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [clave, valor] of Object.entries(anteriores)) {
        if (valor === undefined) delete process.env[clave];
        else process.env[clave] = valor;
      }
    });
}

test("el plan mensual no solicita payer_email", () => {
  const payload = construirPayloadPlan({
    telefono: "5213312345678",
    entorno: "test"
  });

  assert.equal(payload.reason, "Cartes Plus");
  assert.equal(payload.auto_recurring.frequency, 1);
  assert.equal(payload.auto_recurring.frequency_type, "months");
  assert.equal(payload.auto_recurring.transaction_amount, 149);
  assert.equal(payload.auto_recurring.currency_id, "MXN");
  assert.equal("payer_email" in payload, false);
  assert.match(
    payload._cartes_reference,
    /^cartes-plus:test:5213312345678:\d+$/
  );
});

test("el periodo gratuito queda apagado cuando CARTES_PLUS_TRIAL_DAYS es 0", async () => {
  await conEntorno({ CARTES_PLUS_TRIAL_DAYS: "0" }, () => {
    const payload = construirPayloadPlan({
      telefono: "5213312345678",
      entorno: "production"
    });
    assert.equal("free_trial" in payload.auto_recurring, false);
  });
});

test("la firma HMAC oficial se valida en tiempo constante", () => {
  const dataId = "ABC123";
  const xRequestId = "req-789";
  const ts = "1704908010";
  const secret = "secreto-prueba";
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const v1 = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  assert.equal(
    validarFirmaMercadoPago({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId,
      dataId,
      secret
    }),
    true
  );

  assert.equal(
    validarFirmaMercadoPago({
      xSignature: `ts=${ts},v1=${"0".repeat(64)}`,
      xRequestId,
      dataId,
      secret
    }),
    false
  );
});

test("la creación rechaza credenciales de una aplicación distinta", async () => {
  await conEntorno(
    {
      MERCADOPAGO_TEST_ACCESS_TOKEN: "APP_USR-test",
      MERCADOPAGO_TEST_APPLICATION_ID: "6813716852527592"
    },
    async () => {
      const fetchImpl = async () =>
        new Response(
          JSON.stringify({
            id: "plan-1",
            application_id: 2098819259889432,
            collector_id: 123,
            status: "active",
            init_point:
              "https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=plan-1"
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );

      await assert.rejects(
        crearPlanMercadoPago({
          telefono: "5213312345678",
          entorno: "test",
          fetchImpl
        }),
        /no pertenecen a la aplicación esperada/i
      );
    }
  );
});

test("la creación acepta el Application ID exacto del entorno de prueba", async () => {
  await conEntorno(
    {
      MERCADOPAGO_TEST_ACCESS_TOKEN: "APP_USR-test",
      MERCADOPAGO_TEST_APPLICATION_ID: "6813716852527592"
    },
    async () => {
      const fetchImpl = async () =>
        new Response(
          JSON.stringify({
            id: "plan-2",
            application_id: 6813716852527592,
            collector_id: 3573488818,
            status: "active",
            init_point:
              "https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=plan-2"
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );

      const plan = await crearPlanMercadoPago({
        telefono: "5213312345678",
        entorno: "test",
        fetchImpl
      });

      assert.equal(plan.application_id, "6813716852527592");
      assert.equal(plan.id, "plan-2");
    }
  );
});

test("la API recibe solo los campos oficiales del plan", async () => {
  await conEntorno(
    {
      MERCADOPAGO_TEST_ACCESS_TOKEN: "APP_USR-test",
      MERCADOPAGO_TEST_APPLICATION_ID: "6813716852527592"
    },
    async () => {
      let bodyEnviado = null;
      const fetchImpl = async (_url, options) => {
        bodyEnviado = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            id: "plan-oficial",
            application_id: 6813716852527592,
            collector_id: 3573488818,
            status: "active",
            init_point:
              "https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_plan_id=plan-oficial"
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      };

      await crearPlanMercadoPago({
        telefono: "5213312345678",
        entorno: "test",
        fetchImpl
      });

      assert.deepEqual(Object.keys(bodyEnviado).sort(), [
        "auto_recurring",
        "back_url",
        "reason"
      ]);
      assert.equal("payer_email" in bodyEnviado, false);
      assert.equal("_cartes_reference" in bodyEnviado, false);
    }
  );
});


test("solo una ejecución puede reclamar la misma notificación", async () => {
  const entradas = new Map();
  const store = {
    async set(clave, valor, opciones = {}) {
      if (opciones.onlyIfNew && entradas.has(clave)) {
        return { modified: false };
      }
      entradas.set(clave, valor);
      return { modified: true };
    },
    async delete(clave) {
      entradas.delete(clave);
    }
  };

  const resultados = await Promise.all([
    reclamarNotificacionSuscripcion({
      entorno: "test",
      preapprovalId: "preapproval-123",
      status: "authorized",
      store
    }),
    reclamarNotificacionSuscripcion({
      entorno: "test",
      preapprovalId: "preapproval-123",
      status: "authorized",
      store
    })
  ]);

  assert.equal(resultados.filter(Boolean).length, 1);
  assert.equal(resultados.filter((valor) => !valor).length, 1);
});

test("si falla el envío, liberar la marca permite un reintento", async () => {
  const entradas = new Map();
  const store = {
    async set(clave, valor, opciones = {}) {
      if (opciones.onlyIfNew && entradas.has(clave)) {
        return { modified: false };
      }
      entradas.set(clave, valor);
      return { modified: true };
    },
    async delete(clave) {
      entradas.delete(clave);
    }
  };

  const argumentos = {
    entorno: "test",
    preapprovalId: "preapproval-456",
    status: "authorized",
    store
  };

  assert.equal(await reclamarNotificacionSuscripcion(argumentos), true);
  assert.equal(await reclamarNotificacionSuscripcion(argumentos), false);
  await liberarNotificacionSuscripcion(argumentos);
  assert.equal(await reclamarNotificacionSuscripcion(argumentos), true);
});
