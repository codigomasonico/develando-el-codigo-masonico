import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const qaSiteId =
  "c91954f4-08d6-4df6-a831-59457b9a59b3";

const localFlag =
  "CARTES_QA_LOCAL_FRESH_STORE";

const runtimeFiles = [
  "core/ai/lib-cartes-account.mjs",
  "core/ai/lib-cartes-reviews.mjs",
  "core/ai/lib-cartes-review-packs.mjs",
  "channels/whatsapp/functions/lib-state.mjs"
];

test(
  "V133 QA publicado usa store persistente y solo QA local puede usar deploy store",
  () => {
    for (const rel of runtimeFiles) {
      const source =
        fs.readFileSync(
          path.join(root, rel),
          "utf8"
        );

      assert.match(
        source,
        /CARTES_QA_DEPLOY_STORE_GENERIC/,
        `${rel}: falta marker`
      );

      assert.match(
        source,
        /getDeployStore/,
        `${rel}: debe conservar getDeployStore para QA local`
      );

      assert.match(
        source,
        /getStore/,
        `${rel}: debe conservar getStore persistente`
      );

      assert.match(
        source,
        new RegExp(
          `process\\.env\\.SITE_ID\\s*===\\s*"${qaSiteId}"\\s*&&\\s*process\\.env\\.${localFlag}\\s*===\\s*"1"`
        ),
        `${rel}: deploy store no esta limitado a QA local`
      );

      assert.doesNotMatch(
        source,
        new RegExp(
          `process\\.env\\.SITE_ID\\s*===\\s*"${qaSiteId}"\\s*\\?\\s*`
        ),
        `${rel}: conserva selector antiguo por Site ID`
      );
    }
  }
);