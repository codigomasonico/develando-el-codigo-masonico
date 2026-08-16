import {
  resolverOCrearUsuarioPorIdentidad
} from "./lib-cartes-account.mjs";

import {
  CartesDocumentError,
  obtenerEstadoRevisionesCartes,
  revisarDocumentoCartes
} from "./cartes-document-review.mjs";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const DOC_MIME =
  "application/msword";

const GENERIC_BINARY_MIME =
  "application/octet-stream";

const realDeps = {
  resolverOCrearUsuarioPorIdentidad,
  obtenerEstadoRevisionesCartes,
  revisarDocumentoCartes
};

export function createDocumentReviewHttpHandler(overrides = {}) {
  const d = {
    ...realDeps,
    ...overrides
  };

  return async function handler(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (request.method !== "POST") {
      return json(
        { error: "Método no permitido." },
        405
      );
    }

    try {
      const contentType = String(
        request.headers.get("content-type") || ""
      ).toLowerCase();

      if (contentType.includes("application/json")) {
        const body = await request.json().catch(() => ({}));

        if (String(body?.action || "").toLowerCase() !== "status") {
          return json(
            { error: "Acción no soportada." },
            400
          );
        }

        const webIdentity = String(
          body?.web_identity || ""
        ).trim();

        if (!webIdentity) {
          return json(
            { error: "La sesión Web no contiene una identidad válida." },
            400
          );
        }

        const identity =
          await d.resolverOCrearUsuarioPorIdentidad({
            tipo: "web",
            valor: webIdentity
          });

        const reviews =
          await d.obtenerEstadoRevisionesCartes({
            userId: identity.user_id
          });

        return json({
          ok: true,
          plan: reviews.plan,
          reviews
        });
      }

      if (!contentType.includes("multipart/form-data")) {
        return json(
          {
            error:
              "La revisión documental requiere multipart/form-data."
          },
          415
        );
      }

      const form = await request.formData();

      const webIdentity = String(
        form.get("web_identity") || ""
      ).trim();

      const requestId = String(
        form.get("request_id") || ""
      ).trim();

      const consentAccepted =
        String(
          form.get("accepted_processing") || ""
        ).toLowerCase() === "true";

      const file = form.get("document");

      if (!webIdentity) {
        return json(
          { error: "La sesión Web no contiene una identidad válida." },
          400
        );
      }

      if (
        !file ||
        typeof file.arrayBuffer !== "function"
      ) {
        return json(
          { error: "No se recibió ningún documento." },
          400
        );
      }

      const fileName = String(
        file.name || "documento.docx"
      ).trim();

      const mimeType = String(
        file.type || ""
      ).trim();

      const isDocx =
        /\.docx$/i.test(fileName);

      const isDoc =
        !isDocx &&
        /\.doc$/i.test(fileName);

      const validMime =
        !mimeType ||
        mimeType ===
          GENERIC_BINARY_MIME ||
        (
          isDocx &&
          mimeType ===
            DOCX_MIME
        ) ||
        (
          isDoc &&
          mimeType ===
            DOC_MIME
        );

      if (
        (!isDocx && !isDoc) ||
        !validMime
      ) {
        return json(
          {
            error:
              "Este tipo de archivo no es compatible. Cartes admite únicamente documentos Word en formato .doc o .docx para revisión.\n\n" +
              "El archivo no fue revisado y no se consumió ninguna revisión."
          },
          415
        );
      }

      const identity =
        await d.resolverOCrearUsuarioPorIdentidad({
          tipo: "web",
          valor: webIdentity
        });

      let bytes = Buffer.from(
        await file.arrayBuffer()
      );

      try {
        const result =
          await d.revisarDocumentoCartes({
            userId: identity.user_id,
            fileBuffer: bytes,
            fileName,
            channel: "web",
            requestId,
            consentAccepted
          });

        return json(result, 200);
      }
      finally {
        if (bytes?.length) {
          bytes.fill(0);
        }

        bytes = null;
      }
    }
    catch (error) {
      if (error instanceof CartesDocumentError) {
        return json(
          {
            error: error.message,
            code: error.code
          },
          error.status || 400
        );
      }

      console.error(
        "CARTES_DOCUMENT_REVIEW_HTTP_ERROR",
        error instanceof Error
          ? error.message
          : String(error)
      );

      return json(
        {
          error:
            "No fue posible revisar el documento en este momento."
        },
        500
      );
    }
  };
}

export default createDocumentReviewHttpHandler();

function corsHeaders() {
  return {
    "Content-Type":
      "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS"
  };
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders()
    }
  );
}