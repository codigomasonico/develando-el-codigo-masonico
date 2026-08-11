import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import cartesWhatsapp from "../../channels/whatsapp/functions/cartes-whatsapp.mjs";
import {
  MENU_IDS,
  construirMenuPrincipal,
  construirMenuSuscripcion,
  construirMenuMiSuscripcion,
  esComandoCancelar,
  esComandoEstadoSuscripcion,
  esComandoMenu,
  esConfirmacionCancelacion,
  esEstadoCancelable,
  esEntradaSinContenidoUtil,
  extraerEntradaMensaje,
  resolverOpcionNumericaMenu
} from "../../channels/whatsapp/functions/lib-menu-cartes.mjs";
import {
  eliminarCancelacionPendiente,
  enviarBotonesWhatsApp,
  enviarListaWhatsApp,
  guardarCancelacionPendiente,
  leerCancelacionPendiente
} from "../../channels/whatsapp/functions/lib-cartes.mjs";
import {
  cancelarSuscripcionMercadoPago,
  normalizarEstadoSuscripcion
} from "../../channels/whatsapp/functions/lib-mercadopago.mjs";
import { TEXTOS_CARTES } from "../../channels/whatsapp/functions/lib-textos-cartes.mjs";

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

function crearStoreMemoria() {
  const datos = new Map();
  return {
    datos,
    async setJSON(clave, valor) {
      datos.set(clave, structuredClone(valor));
    },
    async get(clave) {
      return datos.has(clave) ? structuredClone(datos.get(clave)) : null;
    },
    async delete(clave) {
      datos.delete(clave);
    }
  };
}

test("el menú se activa solo con comandos completos", () => {
  assert.equal(esComandoMenu("Menú"), true);
  assert.equal(esComandoMenu("Inicio"), true);
  assert.equal(esComandoMenu("Hola, quiero conocer a Cartes."), true);
  assert.equal(esComandoMenu("Necesito ayuda para entender un símbolo"), false);
  assert.equal(esComandoCancelar("Darme de baja"), true);
  assert.equal(esConfirmacionCancelacion("Sí, cancelar"), true);
  assert.equal(resolverOpcionNumericaMenu("4"), MENU_IDS.MI_SUSCRIPCION);
});

test("suscripcion y suscripción abren Mi suscripción sin consumir consulta", () => {
  assert.equal(esComandoEstadoSuscripcion("suscripcion"), true);
  assert.equal(esComandoEstadoSuscripcion("suscripción"), true);
  assert.equal(esComandoEstadoSuscripcion("mi suscripcion"), true);
  assert.equal(esComandoEstadoSuscripcion("mi suscripción"), true);
  assert.equal(esComandoEstadoSuscripcion("estado de mi suscripción"), true);
  assert.equal(esComandoEstadoSuscripcion("ver mi suscripción"), true);
});

test("las entradas sin contenido útil regresan al menú", () => {
  assert.equal(esEntradaSinContenidoUtil("."), true);
  assert.equal(esEntradaSinContenidoUtil("..."), true);
  assert.equal(esEntradaSinContenidoUtil("geeer"), true);
  assert.equal(esEntradaSinContenidoUtil("masonería"), false);
  assert.equal(esEntradaSinContenidoUtil("¿Qué simboliza la escuadra?"), false);
});

test("el menú principal contiene las seis opciones acordadas", () => {
  const menu = construirMenuPrincipal();
  const rows = menu.sections.flatMap((section) => section.rows);

  assert.equal(
    menu.body,
    "Hola, soy Cartes, el asistente de Develando el Código Masónico. Puedo ayudarte con consultas sobre historia, simbolismo, filosofía y pensamiento masónico. También puedo revisar tus trabajos si tienes Cartes Plus."
  );
  assert.equal(menu.footer, "También puedes escribir tu pregunta directamente.");
  assert.equal(menu.button, "Menú");
  assert.equal(rows.length, 6);
  assert.deepEqual(
    rows.map((row) => row.id),
    [
      MENU_IDS.CONVERSAR,
      MENU_IDS.PLUS_INFO,
      MENU_IDS.SUSCRIBIR,
      MENU_IDS.MI_SUSCRIPCION,
      MENU_IDS.AYUDA,
      MENU_IDS.LEGAL
    ]
  );
});

test("PayPal permanece oculto hasta habilitarlo explícitamente", () => {
  const oculto = construirMenuSuscripcion({ paypalHabilitado: false });
  const visible = construirMenuSuscripcion({ paypalHabilitado: true });

  const idsOcultos = oculto.sections.flatMap((section) =>
    section.rows.map((row) => row.id)
  );
  const idsVisibles = visible.sections.flatMap((section) =>
    section.rows.map((row) => row.id)
  );

  assert.equal(idsOcultos.includes(MENU_IDS.SUSCRIBIR_PAYPAL), false);
  assert.equal(idsVisibles.includes(MENU_IDS.SUSCRIBIR_PAYPAL), true);
});

test("las respuestas interactivas de WhatsApp se interpretan por ID", () => {
  const entrada = extraerEntradaMensaje({
    type: "interactive",
    interactive: {
      list_reply: {
        id: MENU_IDS.MI_SUSCRIPCION,
        title: "Mi suscripción"
      }
    }
  });

  assert.deepEqual(entrada, {
    tipo: "seleccion",
    id: MENU_IDS.MI_SUSCRIPCION,
    texto: "Mi suscripción"
  });
});

test("la baja requiere una confirmación vigente", async () => {
  const store = crearStoreMemoria();
  const guardada = await guardarCancelacionPendiente({
    telefono: "5218115774235",
    entorno: "production",
    preapprovalId: "preapproval-1",
    store
  });

  assert.equal(guardada.telefono, "528115774235");
  assert.equal(
    (await leerCancelacionPendiente({ telefono: "528115774235", store }))
      .preapproval_id,
    "preapproval-1"
  );

  await eliminarCancelacionPendiente({ telefono: "528115774235", store });
  assert.equal(
    await leerCancelacionPendiente({ telefono: "528115774235", store }),
    null
  );
});

test("solo los estados administrables permiten solicitar la baja", () => {
  assert.equal(esEstadoCancelable("authorized"), true);
  assert.equal(esEstadoCancelable("paused"), true);
  assert.equal(esEstadoCancelable("pending"), true);
  assert.equal(esEstadoCancelable("cancelled"), false);
});

test("la cancelación usa el estado aceptado y normaliza canceled", async () => {
  await conEntorno(
    {
      MERCADOPAGO_ACCESS_TOKEN: "APP_USR-production",
      MERCADOPAGO_APPLICATION_ID: "2098819259889432"
    },
    async () => {
      let body = null;
      const fetchImpl = async (_url, options) => {
        body = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            id: "preapproval-2",
            application_id: "2098819259889432",
            status: "cancelled"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const resultado = await cancelarSuscripcionMercadoPago(
        "preapproval-2",
        "production",
        fetchImpl
      );

      assert.deepEqual(body, { status: "cancelled" });
      assert.equal(resultado.status, "cancelled");
      assert.equal(normalizarEstadoSuscripcion("canceled"), "cancelled");
    }
  );
});

test("si Mercado Pago rechaza cancelled, se intenta canceled una sola vez", async () => {
  await conEntorno(
    {
      MERCADOPAGO_TEST_ACCESS_TOKEN: "APP_USR-test",
      MERCADOPAGO_TEST_APPLICATION_ID: "6813716852527592"
    },
    async () => {
      const cuerpos = [];
      const fetchImpl = async (_url, options) => {
        const body = JSON.parse(options.body);
        cuerpos.push(body);

        if (body.status === "cancelled") {
          return new Response(
            JSON.stringify({
              message: "Invalid preapproval status param: cancelled",
              status: 400
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            id: "preapproval-3",
            application_id: "6813716852527592",
            status: "canceled"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const resultado = await cancelarSuscripcionMercadoPago(
        "preapproval-3",
        "test",
        fetchImpl
      );

      assert.deepEqual(cuerpos, [
        { status: "cancelled" },
        { status: "canceled" }
      ]);
      assert.equal(resultado.status, "cancelled");
    }
  );
});


test("Mi suscripción usa el texto aprobado cuando no hay suscripción activa", () => {
  const menu = construirMenuMiSuscripcion({ resumen: "", cancelable: false });
  assert.equal(
    menu.body,
    "No encontré una suscripción activa de Cartes Plus vinculada a este número de WhatsApp."
  );
});

test("el webhook de WhatsApp envía el menú como lista interactiva", async () => {
  const secret = "meta-secret-test";
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: `wamid-menu-${Date.now()}`,
                  from: "528115774235",
                  type: "text",
                  text: { body: "Menú" }
                }
              ]
            }
          }
        ]
      }
    ]
  };
  const raw = JSON.stringify(payload);
  const signature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex")}`;
  const fetchAnterior = globalThis.fetch;
  const envAnterior = {
    META_APP_SECRET: process.env.META_APP_SECRET,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID
  };
  let enviado = null;

  process.env.META_APP_SECRET = secret;
  process.env.WHATSAPP_ACCESS_TOKEN = "whatsapp-test";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-test";
  globalThis.fetch = async (_url, options) => {
    enviado = JSON.parse(options.body);
    return new Response(
      JSON.stringify({ messages: [{ id: "wamid-salida" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const response = await cartesWhatsapp(
      new Request("https://cartes.test/.netlify/functions/cartes-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": signature
        },
        body: raw
      })
    );

    assert.equal(response.status, 200);
    assert.equal(enviado.type, "interactive");
    assert.equal(enviado.interactive.type, "list");
    assert.equal(
      enviado.interactive.action.sections[0].rows.length,
      6
    );
  } finally {
    globalThis.fetch = fetchAnterior;
    for (const [clave, valor] of Object.entries(envAnterior)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
});


test("todos los footers interactivos respetan el máximo de 60 caracteres de Meta", () => {
  const footers = {
    PIE_MENU_PRINCIPAL: TEXTOS_CARTES.PIE_MENU_PRINCIPAL,
    PIE_MENU_SUSCRIPCION: TEXTOS_CARTES.PIE_MENU_SUSCRIPCION,
    SEGURIDAD_MI_SUSCRIPCION: TEXTOS_CARTES.SEGURIDAD_MI_SUSCRIPCION,
    SEGURIDAD_AYUDA: TEXTOS_CARTES.SEGURIDAD_AYUDA,
    AVISO_CONFIRMAR_CANCELACION: TEXTOS_CARTES.AVISO_CONFIRMAR_CANCELACION,
    PIE_AUTORIZACION_DOCUMENTO: TEXTOS_CARTES.PIE_AUTORIZACION_DOCUMENTO,
    PIE_ACEPTACION_LEGAL: TEXTOS_CARTES.PIE_ACEPTACION_LEGAL
  };

  for (const [nombre, footer] of Object.entries(footers)) {
    assert.ok(
      footer.length <= 60,
      `${nombre} excede el máximo de 60 caracteres de Meta: ${footer.length}`
    );
  }
});

test("pie del menú de suscripción usa el texto aprobado", async () => {
  const menu = await construirMenuSuscripcion("521234567890");
  assert.equal(menu.footer, "Aquí encontrarás los medios de pago disponibles actualmente.");
});

test("un formato no compatible ejecuta enviarTextoEnPartes y responde sin error", async () => {
  const secret = "meta-secret-test-def004";
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: `wamid-def004-${Date.now()}`,
                  from: "528115774235",
                  type: "image",
                  image: { id: "image-test" }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  const raw = JSON.stringify(payload);
  const signature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex")}`;

  const fetchAnterior = globalThis.fetch;
  const envAnterior = {
    META_APP_SECRET: process.env.META_APP_SECRET,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID
  };

  const enviados = [];

  process.env.META_APP_SECRET = secret;
  process.env.WHATSAPP_ACCESS_TOKEN = "whatsapp-test";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-test";

  globalThis.fetch = async (_url, options) => {
    enviados.push(JSON.parse(options.body));
    return new Response(
      JSON.stringify({ messages: [{ id: "wamid-salida-def004" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const response = await cartesWhatsapp(
      new Request("https://cartes.test/.netlify/functions/cartes-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": signature
        },
        body: raw
      })
    );

    assert.equal(response.status, 200);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].type, "text");
    assert.equal(enviados[0].text.body, TEXTOS_CARTES.FORMATO_NO_COMPATIBLE);
  } finally {
    globalThis.fetch = fetchAnterior;
    for (const [clave, valor] of Object.entries(envAnterior)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
});

test("la capa de envío limita cualquier footer interactivo futuro a 60 caracteres", async () => {
  const fetchAnterior = globalThis.fetch;
  const envAnterior = {
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID
  };

  const enviados = [];
  process.env.WHATSAPP_ACCESS_TOKEN = "whatsapp-test";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-test";

  globalThis.fetch = async (_url, options) => {
    enviados.push(JSON.parse(options.body));
    return new Response(
      JSON.stringify({ messages: [{ id: "wamid-footer-def005" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const footerLargo = "X".repeat(75);

    await enviarListaWhatsApp("528115774235", {
      body: "Selecciona una opción.",
      footer: footerLargo,
      button: "Menú",
      sections: [{ title: "Opciones", rows: [{ id: "uno", title: "Uno" }] }]
    });

    await enviarBotonesWhatsApp("528115774235", {
      body: "Confirma una opción.",
      footer: footerLargo,
      buttons: [{ id: "si", title: "Sí" }]
    });

    assert.equal(enviados.length, 2);
    assert.equal(enviados[0].interactive.footer.text.length, 60);
    assert.equal(enviados[1].interactive.footer.text.length, 60);
    assert.equal(enviados[0].interactive.footer.text, "X".repeat(60));
    assert.equal(enviados[1].interactive.footer.text, "X".repeat(60));
  } finally {
    globalThis.fetch = fetchAnterior;
    for (const [clave, valor] of Object.entries(envAnterior)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
});
