import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  CartesDocumentError
} from "../../core/ai/cartes-document-review.mjs";

import {
  createDocumentReviewHttpHandler
} from "../../core/ai/cartes-document-review-http.mjs";

const USER =
  "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const WEB =
  "web_test_document_review";

function deps(overrides = {}) {
  return {
    async resolverOCrearUsuarioPorIdentidad({
      tipo,
      valor
    }) {
      assert.equal(tipo, "web");
      assert.equal(valor, WEB);

      return {
        user_id: USER
      };
    },

    async obtenerEstadoRevisionesCartes({
      userId
    }) {
      assert.equal(userId, USER);

      return {
        user_id: USER,
        plan: "plus",
        limite: 5,
        usadas: 2,
        disponibles: 3
      };
    },

    async revisarDocumentoCartes(args) {
      assert.equal(args.userId, USER);
      assert.equal(args.channel, "web");
      assert.equal(args.fileName, "trabajo.docx");
      assert.equal(args.consentAccepted, true);
      assert.ok(Buffer.isBuffer(args.fileBuffer));

      return {
        ok: true,
        review: "Revisión documental correcta.",
        reviews: {
          plan: "plus",
          limite: 5,
          usadas: 3,
          disponibles: 2
        }
      };
    },

    ...overrides
  };
}

test(
  "status Web devuelve contador central de revisiones",
  async () => {
    const handler =
      createDocumentReviewHttpHandler(
        deps()
      );

    const response = await handler(
      new Request(
        "https://cartes.test/.netlify/functions/cartes-document-review",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            action: "status",
            web_identity: WEB
          })
        }
      )
    );

    assert.equal(response.status, 200);

    const data = await response.json();

    assert.equal(data.plan, "plus");
    assert.equal(
      data.reviews.disponibles,
      3
    );
    assert.equal(
      data.reviews.limite,
      5
    );
  }
);

test(
  "Web envía .docx al motor central",
  async () => {
    const handler =
      createDocumentReviewHttpHandler(
        deps()
      );

    const form = new FormData();

    form.append(
      "web_identity",
      WEB
    );

    form.append(
      "request_id",
      "webreview_test_1"
    );

    form.append(
      "accepted_processing",
      "true"
    );

    form.append(
      "document",
      new Blob(
        ["contenido-docx-simulado"],
        {
          type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      ),
      "trabajo.docx"
    );

    const response = await handler(
      new Request(
        "https://cartes.test/.netlify/functions/cartes-document-review",
        {
          method: "POST",
          body: form
        }
      )
    );

    assert.equal(response.status, 200);

    const data = await response.json();

    assert.equal(
      data.review,
      "Revisión documental correcta."
    );

    assert.equal(
      data.reviews.disponibles,
      2
    );
  }
);

test(
  "error Plus requerido conserva HTTP 403",
  async () => {
    const handler =
      createDocumentReviewHttpHandler(
        deps({
          async revisarDocumentoCartes() {
            throw new CartesDocumentError(
              "La revisión requiere Cartes Plus.",
              "plus_required",
              403
            );
          }
        })
      );

    const form = new FormData();

    form.append(
      "web_identity",
      WEB
    );

    form.append(
      "request_id",
      "webreview_free"
    );

    form.append(
      "accepted_processing",
      "true"
    );

    form.append(
      "document",
      new Blob(
        ["x"],
        {
          type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      ),
      "trabajo.docx"
    );

    const response = await handler(
      new Request(
        "https://cartes.test/.netlify/functions/cartes-document-review",
        {
          method: "POST",
          body: form
        }
      )
    );

    assert.equal(response.status, 403);

    const data = await response.json();

    assert.equal(
      data.code,
      "plus_required"
    );
  }
);

test(
  "UI Web muestra documentos solo cuando plan es Plus",
  () => {
    const source = fs.readFileSync(
      new URL(
        "../../channels/web/public/bot/guia-masonico.js",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(
      source,
      /documentReviewEndpoint/
    );

    assert.match(
      source,
      /Revisar documento/
    );

    assert.match(
      source,
      /accept="\.docx,\.doc,application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document,application\/msword"/
    );

    assert.match(
      source,
      /currentWebPlan === "plus"/
    );

    assert.match(
      source,
      /ui\.reviewsUsage\.hidden = !isPlus/
    );

    assert.match(
      source,
      /Revisiones de documentos disponibles:/
    );

    assert.match(
      source,
      /accepted_processing/
    );
  }
);