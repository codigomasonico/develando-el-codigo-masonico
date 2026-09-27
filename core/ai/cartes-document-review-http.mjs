import {
  actualizarIdiomaUsuario,
  resolverOCrearUsuarioPorIdentidad
} from "./lib-cartes-account.mjs";
import { coreText, normalizeLocale } from "./i18n.mjs";

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
  actualizarIdiomaUsuario,
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
    const headerLocale = normalizeLocale(
      request.headers.get("x-cartes-locale") ||
      request.headers.get("accept-language") ||
      "es"
    );
    let activeLocale = headerLocale;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (request.method !== "POST") {
      return json(
        { error: coreText(activeLocale, "method_not_allowed") },
        405
      );
    }

    try {
      const contentType = String(
        request.headers.get("content-type") || ""
      ).toLowerCase();

      if (contentType.includes("application/json")) {
        const body = await request.json().catch(() => ({}));
        const requestedLocale = String(body?.locale || "").trim();
        activeLocale = normalizeLocale(requestedLocale, headerLocale);

        if (String(body?.action || "").toLowerCase() !== "status") {
          return json(
            { error: activeLocale === "en" ? "Unsupported action." : "Acción no soportada." },
            400
          );
        }

        const webIdentity = String(
          body?.web_identity || ""
        ).trim();

        if (!webIdentity) {
          return json(
            { error: activeLocale === "en" ? "The Web session does not contain a valid identity." : "La sesión Web no contiene una identidad válida." },
            400
          );
        }

        const identity =
          await d.resolverOCrearUsuarioPorIdentidad({
            tipo: "web",
            valor: webIdentity
          });

        if (requestedLocale) {
          await d.actualizarIdiomaUsuario({
            userId: identity.user_id,
            locale: activeLocale
          });
        }

        const reviews =
          await d.obtenerEstadoRevisionesCartes({
            userId: identity.user_id
          });

        return json({
          ok: true,
          locale: activeLocale,
          plan: reviews.plan,
          reviews
        });
      }

      if (!contentType.includes("multipart/form-data")) {
        return json(
          {
            error:
              activeLocale === "en"
                ? "Document review requires multipart/form-data."
                : "La revisión documental requiere multipart/form-data."
          },
          415
        );
      }

      const form = await request.formData();

      const requestedLocale = String(
        form.get("locale") || ""
      ).trim();

      activeLocale = normalizeLocale(requestedLocale, headerLocale);

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
          { error: activeLocale === "en" ? "The Web session does not contain a valid identity." : "La sesión Web no contiene una identidad válida." },
          400
        );
      }

      if (
        !file ||
        typeof file.arrayBuffer !== "function"
      ) {
        return json(
          { error: activeLocale === "en" ? "No document was received." : "No se recibió ningún documento." },
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
            error: activeLocale === "en"
              ? "This file type is not supported. Cartes accepts only Word documents in .doc or .docx format for review.\n\nThe file was not reviewed and no review credit was used."
              : "Este tipo de archivo no es compatible. Cartes admite únicamente documentos Word en formato .doc o .docx para revisión.\n\nEl archivo no fue revisado y no se consumió ninguna revisión."
          },
          415
        );
      }

      const identity =
        await d.resolverOCrearUsuarioPorIdentidad({
          tipo: "web",
          valor: webIdentity
        });

      if (requestedLocale) {
        await d.actualizarIdiomaUsuario({
          userId: identity.user_id,
          locale: activeLocale
        });
      }

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
            consentAccepted,
            locale: activeLocale
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
          error: activeLocale === "en"
            ? "The document could not be reviewed at this time."
            : "No fue posible revisar el documento en este momento."
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
      "Content-Type, X-Cartes-Locale",
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
