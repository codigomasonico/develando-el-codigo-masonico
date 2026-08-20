import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  createPayPalWebhookHandler
} from "../../channels/whatsapp/functions/paypal-webhook.mjs";

const USER_ID =
  "usr_cccccccccccccccccccccccccccccccc";

const paypalSource = fs.readFileSync(
  new URL(
    "../../channels/whatsapp/functions/lib-paypal.mjs",
    import.meta.url
  ),
  "utf8"
);

const webhookSource = fs.readFileSync(
  new URL(
    "../../channels/whatsapp/functions/paypal-webhook.mjs",
    import.meta.url
  ),
  "utf8"
);

const waSource = fs.readFileSync(
  new URL(
    "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
    import.meta.url
  ),
  "utf8"
);

const statusSource = fs.readFileSync(
  new URL(
    "../../netlify/functions/cartes-subscription-status.mjs",
    import.meta.url
  ),
  "utf8"
);

const returnSource = fs.readFileSync(
  new URL(
    "../../channels/web/public/cartes-whatsapp/suscripcion.html",
    import.meta.url
  ),
  "utf8"
);

test(
  "V112 PayPal usa destinos distintos para aprobación y cancelación",
  () => {
    assert.match(
      paypalSource,
      /returnTarget\.searchParams\.set\("result", "success"\)/
    );

    assert.match(
      paypalSource,
      /cancelTarget\.searchParams\.set\("result", "cancel"\)/
    );

    assert.match(
      paypalSource,
      /return_url:\s*returnUrl,\s*cancel_url:\s*cancelUrl/
    );

    assert.doesNotMatch(
      paypalSource,
      /cancel_url:\s*returnUrl/
    );
  }
);

test(
  "V112 CREATED pending no sincroniza la cuenta central",
  async () => {
    let syncCalls = 0;
    let contextCalls = 0;
    let notifyCalls = 0;

    const handler =
      createPayPalWebhookHandler({
        env: {
          PAYPAL_ENVIRONMENT: "live"
        },

        async verifyPayPalWebhook() {
          return true;
        },

        async getPayPalSubscription(id) {
          return {
            id,
            custom_id: USER_ID,
            status: "APPROVAL_PENDING"
          };
        },

        async obtenerSuscripcionUsuario() {
          return null;
        },

        normalizePayPalSubscription(remote) {
          return {
            provider: "paypal",
            status: "pending",
            subscription_id: remote.id,
            plan_actual: "gratuito"
          };
        },

        async sincronizarSuscripcionUsuario() {
          syncCalls += 1;
          throw new Error(
            "Un pending no debe sincronizarse."
          );
        },

        async getPaymentContext() {
          contextCalls += 1;
          throw new Error(
            "Un pending no debe consultar contexto."
          );
        },

        async sendWhatsAppTextParts() {
          notifyCalls += 1;
          throw new Error(
            "Un pending no debe notificar WhatsApp."
          );
        }
      });

    const request =
      new Request(
        "https://qa.invalid/.netlify/functions/paypal-webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            id: "WH-V112-PENDING",
            event_type:
              "BILLING.SUBSCRIPTION.CREATED",
            resource: {
              id: "I-V112-PENDING",
              custom_id: USER_ID,
              status: "APPROVAL_PENDING"
            }
          })
        }
      );

    const response = await handler(request);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.recibido, true);
    assert.equal(body.ignorado, true);
    assert.equal(body.status, "pending");
    assert.equal(syncCalls, 0);
    assert.equal(contextCalls, 0);
    assert.equal(notifyCalls, 0);
  }
);

test(
  "V112 webhook conserva rama ACTIVE fuera del filtro pending",
  () => {
    assert.match(
      webhookSource,
      /CARTES_PAYPAL_PENDING_V112/
    );

    assert.match(
      webhookSource,
      /sincronizarSuscripcionUsuario/
    );

    assert.match(
      webhookSource,
      /subscription\.status === "authorized"/
    );
  }
);

test(
  "V112 Web no publica pending residual",
  () => {
    assert.match(
      statusSource,
      /CARTES_PAYPAL_PENDING_STATUS_V112/
    );

    assert.match(
      statusSource,
      /visibleSubscription/
    );

    assert.match(
      statusSource,
      /String\(subscription\.status \|\| ""\)\.toLowerCase\(\) !== "pending"/
    );
  }
);

test(
  "V112 WhatsApp no muestra pending y conserva V093/V099",
  () => {
    assert.match(
      waSource,
      /CARTES_PAYPAL_PENDING_UI_V112/
    );

    assert.match(
      waSource,
      /storedSubscription/
    );

    assert.match(
      waSource,
      /CARTES_SUBSCRIPTION_BUTTONS_V099/
    );

    assert.doesNotMatch(
      waSource,
      /Revisiones disponibles:[^\\\r\n]*\$\{[^}\r\n]*disponibles[^}\r\n]*\} de \$\{/
    );
  }
);

test(
  "V112 retorno cancelado no comunica suscripción completada",
  () => {
    assert.match(
      returnSource,
      /CARTES_PAYPAL_RETURN_UI_V112/
    );

    assert.match(
      returnSource,
      /provider === "paypal" && result === "cancel"/
    );

    assert.match(
      returnSource,
      /Cancelaste el proceso en PayPal/
    );

    assert.match(
      returnSource,
      /Cartes Plus no fue activado/
    );
  }
);