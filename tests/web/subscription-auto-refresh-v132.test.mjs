import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL(
    "../../channels/web/public/bot/guia-masonico.js",
    import.meta.url
  ),
  "utf8"
);

test("V132 Web refresca automaticamente al volver del checkout Plus", () => {
  assert.match(
    source,
    /CARTES_SUBSCRIPTION_AUTO_REFRESH_V132/
  );

  assert.match(
    source,
    /window\.addEventListener\("focus",[\s\S]*refreshAccountAfterCheckoutWeb/
  );

  assert.match(
    source,
    /document\.addEventListener\("visibilitychange",[\s\S]*document\.visibilityState === "visible"[\s\S]*refreshAccountAfterCheckoutWeb/
  );

  assert.match(
    source,
    /async function refreshAccountAfterCheckoutWeb\(\)/
  );

  assert.match(
    source,
    /subscriptionCheckoutPending \? 7 : 0/
  );

  assert.match(
    source,
    /await wait\(1500\)/
  );

  assert.match(
    source,
    /currentWebPlan === "plus"[\s\S]*subscriptionCheckoutPending = false;[\s\S]*await refreshReviewStatus\(\)/
  );
});

test("V132 solo marca el checkout recurrente y no el paquete adicional", () => {
  const subscriptionStart =
    source.indexOf(
      'if (webSubscriptionFlow === "payment_provider")'
    );

  const reviewPackStart =
    source.indexOf(
      'if (webSubscriptionFlow === "review_pack_provider")'
    );

  assert.ok(subscriptionStart >= 0);
  assert.ok(reviewPackStart > subscriptionStart);

  const subscriptionSection =
    source.slice(subscriptionStart, reviewPackStart);

  const reviewPackSection =
    source.slice(reviewPackStart);

  assert.match(
    subscriptionSection,
    /mostrarAccionPagoWeb\(providerLabel, data\.url, \{ trackSubscription: true \}\)/
  );

  assert.doesNotMatch(
    reviewPackSection,
    /trackSubscription: true/
  );

  assert.match(
    reviewPackSection,
    /mostrarAccionPagoWeb\(providerLabel, data\.url\)/
  );
});

test("V132 conserva seguridad noopener noreferrer del checkout", () => {
  assert.match(
    source,
    /window\.open\(url, "_blank", "noopener,noreferrer"\)/
  );
});