import test from "node:test";
import assert from "node:assert/strict";
import {
  SOPORTE_CARTES,
  TEXTOS_CARTES,
  completarTextoCartes
} from "../../channels/whatsapp/functions/lib-textos-cartes.mjs";

test("el catálogo contiene los textos aprobados esenciales", () => {
  assert.equal(SOPORTE_CARTES, "soporte@develandoelcodigomasonico.com");
  assert.ok(Object.keys(TEXTOS_CARTES).length >= 121);
  assert.match(TEXTOS_CARTES.SALUDO_MENU_PRINCIPAL, /pensamiento masónico/);
  assert.match(TEXTOS_CARTES.SALUDO_MENU_PRINCIPAL, /También puedo revisar tus trabajos/);
  assert.equal(TEXTOS_CARTES.ENCABEZADO_MENU_AYUDA, "Cuéntame con qué necesitas ayuda y selecciona la opción que mejor describa tu duda.");
  assert.equal(TEXTOS_CARTES.SIN_SUSCRIPCION_ACTIVA, "No encontré una suscripción activa de Cartes Plus vinculada a este número de WhatsApp.");
  assert.equal(TEXTOS_CARTES.PIE_MENU_PRINCIPAL, "También puedes escribir tu pregunta directamente.");
  assert.match(TEXTOS_CARTES.CONOCER_CARTES_PLUS, /amplía tu conocimiento/);
  assert.match(TEXTOS_CARTES.CONOCER_CARTES_PLUS, /5 revisiones mensuales/);
  assert.match(TEXTOS_CARTES.LIMITE_PAQUETES, /6 revisiones/);
  assert.match(TEXTOS_CARTES.DOCUMENTO_RECIBIDO, /^Recibí/);
  assert.match(TEXTOS_CARTES.ERROR_REVISION, /eliminé el archivo/);
  assert.equal(TEXTOS_CARTES.FORMATO_NO_COMPATIBLE, "Por el momento puedo responder mensajes de texto y opciones del menú.");
  assert.match(TEXTOS_CARTES.ERROR_ENLACE_PAGO, /ni se activó Cartes Plus/);
  assert.match(TEXTOS_CARTES.PAGO_APROBADO_SIN_ACTIVACION, /No envíes datos de tarjeta/);
  assert.match(TEXTOS_CARTES.CANCELACION_VENCIDA, /Darme de baja/);
  assert.match(TEXTOS_CARTES.RESPALDO_MENU_CANCELACION, /Cancelar Cartes Plus/);
  assert.match(TEXTOS_CARTES.RESPALDO_CONFIRMACION_CANCELACION, /Sí, cancelar renovación/);
  assert.equal(TEXTOS_CARTES.BOTON_MENU_PRINCIPAL, "Menú");
  assert.match(TEXTOS_CARTES.ENTRADA_NO_RECONOCIDA, /No entendí tu mensaje/);
});

test("completarTextoCartes reemplaza variables conocidas", () => {
  const resultado = completarTextoCartes(TEXTOS_CARTES.REVISION_EXITOSA, {
    revisiones_disponibles: 4
  });

  assert.equal(
    resultado,
    "Finalicé la revisión y el documento fue eliminado conforme al Aviso de privacidad. Se descontó 1 revisión de tu saldo. Te quedan 4 revisiones disponibles en este periodo."
  );
});

test("completarTextoCartes conserva variables faltantes", () => {
  assert.match(
    completarTextoCartes(TEXTOS_CARTES.PAQUETE_ACTIVO),
    /\{fecha_fin\}/
  );
});


test("incluye la descripción aprobada de Ayuda y soporte", () => {
  assert.equal(TEXTOS_CARTES.DESCRIPCION_AYUDA_SOPORTE, "Aclara dudas sobre acceso, suscripción o pagos.");
});
