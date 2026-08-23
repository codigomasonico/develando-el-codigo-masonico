import { CARTES_PLUS_QUERY_LIMIT } from "../../core/ai/config.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const wa = readFileSync(
  new URL(
    "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
    import.meta.url
  ),
  "utf8"
);

const web = readFileSync(
  new URL(
    "../../channels/web/public/bot/guia-masonico.js",
    import.meta.url
  ),
  "utf8"
);

test(
  "117-D01 WhatsApp gratuito bloqueado ofrece Cartes Plus",
  () => {
    assert.match(
      wa,
      /if \(!reservation\.permitida\)[\s\S]*?reservation\.plan !== "plus"[\s\S]*?ofrecerCartesPlusPorLimite/
    );

    assert.match(
      wa,
      /id:\s*"menu_suscribirme"[\s\S]*?title:\s*"Contratar Plus"/
    );
  }
);

test(
  "117-D01 WhatsApp consulta que agota el limite ofrece Plus",
  () => {
    assert.match(
      wa,
      /Number\(usageAfterQuery\.disponibles\) <= 0[\s\S]*?ofrecerCartesPlusPorLimite/
    );
  }
);

test(
  "117-D01 WhatsApp conserva tratamiento separado del límite Plus",
  () => {
    assert.match(
      wa,
      /Ya utilizaste las \$\{CARTES_PLUS_QUERY_LIMIT\} consultas incluidas en Cartes Plus/
    );
  }
);

test(
  "117-D01 Web usage_limit gratuito ofrece Plus",
  () => {
    assert.match(
      web,
      /data\?\.code === "usage_limit"[\s\S]*?usagePlan !== "plus"[\s\S]*?mostrarLimiteGratuitoWeb/
    );
  }
);

test(
  "117-D01 Web consulta que agota el limite ofrece Plus",
  () => {
    assert.match(
      web,
      /Number\(data\?\.usage\?\.disponibles\) <= 0[\s\S]*?mostrarLimiteGratuitoWeb/
    );
  }
);

test(
  "117-D01 Web CTA reutiliza el flujo existente Suscribirme",
  () => {
    assert.match(
      web,
      /label:\s*"Contratar Plus"[\s\S]*?value:\s*"suscribirme"/
    );

    assert.match(
      web,
      /if \(id === "suscribirme"\)[\s\S]*?comenzarSuscripcionWeb/
    );
  }
);

test(
  "117-D01 CTA no contiene fecha de renovación inventada",
  () => {
    const startWa =
      wa.indexOf("async function ofrecerCartesPlusPorLimite");

    const endWa =
      wa.indexOf(
        "async function ofrecerCartesPlusPorDocumento",
        startWa
      );

    const waHelper =
      wa.slice(startWa, endWa);

    const startWeb =
      web.indexOf("function mostrarLimiteGratuitoWeb");

    const endWeb =
      web.indexOf(
        "async function comenzarSuscripcionWeb",
        startWeb
      );

    const webHelper =
      web.slice(startWeb, endWeb);

    assert.doesNotMatch(
      waHelper + webHelper,
      /31 de|1 de|renueva el|renovación el/i
    );
  }
);