import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
    import.meta.url
  ),
  "utf8"
);

test(
  "V081 rechazo documental informa que no consumió revisión",
  () => {
    assert.match(
      source,
      /El documento no fue revisado y no se consumió ninguna revisión\./
    );

    assert.doesNotMatch(
      source,
      /El documento no se considerará revisado si el procesamiento no terminó correctamente\./
    );
  }
);