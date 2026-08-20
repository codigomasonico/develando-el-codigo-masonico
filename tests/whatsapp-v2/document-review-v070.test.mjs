import assert from "node:assert/strict";
import test from "node:test";

import {
  createWhatsAppHandler
} from "../../channels/whatsapp/functions/cartes-whatsapp.mjs";

const USER =
  "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function documentMessage({
  id = "wamid.DOC.1",
  from = "5215512345678"
} = {}) {
  return {
    id,
    from,
    phoneNumberId: "999",
    type: "document",
    document: {
      id: "media-doc-1",
      filename: "trabajo.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
  };
}

function textMessage({
  id = "wamid.TEXT.1",
  text = "acepto documento",
  from = "5215512345678"
} = {}) {
  return {
    id,
    from,
    phoneNumberId: "999",
    type: "text",
    text: {
      body: text
    }
  };
}

function makeDeps({
  plan = "plus"
} = {}) {
  const sent = [];
  const flows = new Map();
  let reviewCalls = 0;

  const deps = {
    env: {
      WHATSAPP_VERIFY_TOKEN: "verify",
      META_APP_SECRET: "secret"
    },

    verifyMetaSignature() {
      return true;
    },

    extractMetaEvents(payload) {
      return {
        messages: payload.messages || [],
        statuses: []
      };
    },

    extractMessageText(message) {
      if (message.type === "text") {
        return message.text?.body || "";
      }

      if (message.type === "interactive") {
        return (
          message.interactive?.button_reply?.id ||
          ""
        );
      }

      return "";
    },

    extractMessageDocument(message) {
      if (message.type !== "document") {
        return null;
      }

      return {
        id: message.document.id,
        fileName:
          message.document.filename,
        mimeType:
          message.document.mime_type
      };
    },

    async resolverOCrearUsuarioPorIdentidad() {
      return {
        user_id: USER
      };
    },

    async obtenerPlanUsuario() {
      return plan;
    },

    async obtenerSuscripcionUsuario() {
      return null;
    },

    async obtenerEstadoUsoMensual() {
      return {
        usadas: 0,
        limite:
          plan === "plus" ? 50 : 5,
        disponibles:
          plan === "plus" ? 50 : 5,
        plan
      };
    },

    async obtenerEstadoRevisionesCartes() {
      return {
        plan,
        usadas: 1,
        limite: 5,
        disponibles: 4
      };
    },

    async claimInboundMessage() {
      return true;
    },

    async releaseInboundMessage() {},

    async setFlow(
      userId,
      flow,
      data
    ) {
      flows.set(userId, {
        flow,
        data
      });
    },

    async getFlow(userId) {
      return flows.get(userId) || null;
    },

    async clearFlow(userId) {
      flows.delete(userId);
    },

    async sendWhatsAppTextParts(args) {
      sent.push({
        type: "text",
        ...args
      });

      return {};
    },

    async sendWhatsAppReplyButtons(args) {
      sent.push({
        type: "buttons",
        ...args
      });

      return {};
    },

    async sendWhatsAppInteractiveList(args) {
      sent.push({
        type: "list",
        ...args
      });

      return {};
    },

    async downloadWhatsAppMedia({
      mediaId
    }) {
      assert.equal(
        mediaId,
        "media-doc-1"
      );

      return {
        buffer:
          Buffer.from("docx-prueba"),
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 11
      };
    },

    async revisarDocumentoCartes(args) {
      reviewCalls += 1;

      assert.equal(
        args.userId,
        USER
      );

      assert.equal(
        args.channel,
        "whatsapp"
      );

      assert.equal(
        args.fileName,
        "trabajo.docx"
      );

      assert.equal(
        args.consentAccepted,
        true
      );

      assert.equal(
        args.requestId,
        "wareview_wamid.DOC.1"
      );

      assert.ok(
        Buffer.isBuffer(
          args.fileBuffer
        )
      );

      return {
        ok: true,
        review:
          "EVALUACIÓN GENERAL\nDocumento revisado.",
        reviews: {
          usadas: 2,
          limite: 5,
          disponibles: 3
        }
      };
    },

    completarVinculacionConWhatsApp() {
      throw new Error(
        "No esperado"
      );
    },

    reservarConsultaMensual() {
      throw new Error(
        "No debe consumir consulta."
      );
    },

    sent,
    flows,
    get reviewCalls() {
      return reviewCalls;
    }
  };

  return deps;
}

async function invoke(
  handler,
  messages
) {
  return handler(
    new Request(
      "https://cartes.test/.netlify/functions/cartes-whatsapp",
      {
        method: "POST",
        headers: {
          "x-hub-signature-256":
            "sha256=test",
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          messages
        })
      }
    )
  );
}

test(
  "gratuito no procesa documentos ni crea revisión",
  async () => {
    const d =
      makeDeps({
        plan: "gratuito"
      });

    const handler =
      createWhatsAppHandler(d);

    const response =
      await invoke(
        handler,
        [
          documentMessage()
        ]
      );

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      d.reviewCalls,
      0
    );

    assert.equal(
      d.flows.size,
      0
    );
    // V077:
    // El aviso para Gratuito ahora es un CTA interactivo
    // hacia Cartes Plus. El contrato del mensaje se valida
    // en document-menu-v077.test.mjs.
  }
);

test(
  "Plus recibe DOCX y solicita autorización sin procesarlo todavía",
  async () => {
    const d =
      makeDeps();

    const handler =
      createWhatsAppHandler(d);

    await invoke(
      handler,
      [
        documentMessage()
      ]
    );

    assert.equal(
      d.reviewCalls,
      0
    );

    const flow =
      d.flows.get(USER);

    assert.equal(
      flow.flow,
      "document_review_consent"
    );

    assert.equal(
      flow.data.mediaId,
      "media-doc-1"
    );

    assert.equal(
      flow.data.fileName,
      "trabajo.docx"
    );

    assert.ok(
      d.sent.some(
        (x) =>
          x.type === "buttons" &&
          x.buttons?.some(
            (b) =>
              b.id ===
              "document_accept"
          )
      )
    );
  }
);

test(
  "aceptar documento usa motor central y contador compartido",
  async () => {
    const d =
      makeDeps();

    const handler =
      createWhatsAppHandler(d);

    await invoke(
      handler,
      [
        documentMessage()
      ]
    );

    await invoke(
      handler,
      [
        textMessage({
          id: "wamid.ACCEPT.1"
        })
      ]
    );

    assert.equal(
      d.reviewCalls,
      1
    );

    assert.equal(
      d.flows.size,
      0
    );

    const text =
      d.sent
        .map((x) => x.text || "")
        .join("\n");

    assert.match(
      text,
      /Documento revisado/
    );

    assert.match(
      text,
      /Revisiones disponibles:\* 3(?! de)/
    );
  }
);