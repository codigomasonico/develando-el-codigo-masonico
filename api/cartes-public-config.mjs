import { CARTES_LINK_CODE_TTL_MINUTES } from "../core/ai/config.mjs";
import { CARTES_PLUS_PRICE_MXN, CARTES_PLUS_REVIEW_LIMIT, CARTES_QUERY_LIMITS, CARTES_REVIEW_PACK_PRICE_MXN, CARTES_REVIEW_PACK_SIZE, CARTES_REVIEW_PACK_MAX_PER_PERIOD, CARTES_DOCUMENT_MAX_PAGES, CARTES_DOCUMENT_MAX_MB } from "../core/ai/config.mjs";

export default async (request) => {
  if (request.method !== "GET") {
    return new Response("Método no permitido", { status: 405 });
  }

  return Response.json(
    {
      query_limits: CARTES_QUERY_LIMITS,
      review_limits: {
        plus: CARTES_PLUS_REVIEW_LIMIT
      },
      review_pack: {
        size: CARTES_REVIEW_PACK_SIZE
      ,
        max_per_period: CARTES_REVIEW_PACK_MAX_PER_PERIOD
      },
      document_limits: {
        max_pages: CARTES_DOCUMENT_MAX_PAGES
      ,
    max_mb: CARTES_DOCUMENT_MAX_MB
  },
  link_code_ttl_minutes: CARTES_LINK_CODE_TTL_MINUTES,
      pricing: {
        plus_mxn: CARTES_PLUS_PRICE_MXN
      ,
        review_pack_mxn: CARTES_REVIEW_PACK_PRICE_MXN
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
};