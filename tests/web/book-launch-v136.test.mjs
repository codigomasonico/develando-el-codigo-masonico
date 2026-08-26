import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicRoot = new URL("../../channels/web/public/", import.meta.url);

const home = fs.readFileSync(new URL("index.html", publicRoot), "utf8");
const homeCss = fs.readFileSync(
  new URL("assets/css/styles.css", publicRoot),
  "utf8"
);
const landing = fs.readFileSync(
  new URL("libro-la-camara-de-reflexiones/index.html", publicRoot),
  "utf8"
);
const bookCss = fs.readFileSync(
  new URL("libro-la-camara-de-reflexiones/assets/css/libro.css", publicRoot),
  "utf8"
);
const preorderJs = fs.readFileSync(
  new URL("libro-la-camara-de-reflexiones/assets/js/preventa.js", publicRoot),
  "utf8"
);
const headerJs = fs.readFileSync(
  new URL("assets/js/header.js", publicRoot),
  "utf8"
);
const sitemap = fs.readFileSync(new URL("sitemap.xml", publicRoot), "utf8");

test("V136 integra el acceso al libro entre Cartes y la guía gratuita", () => {
  const cartes = home.indexOf('class="cartes-launch"');
  const book = home.indexOf('class="book-home-promo"');
  const guide = home.indexOf('class="guia-section"');

  assert.ok(cartes >= 0);
  assert.ok(book > cartes);
  assert.ok(guide > book);
  assert.match(home, /href="\/libro-la-camara-de-reflexiones\/"/);
});

test("V136 conserva el precio físico en la landing y deriva Kindle a Amazon", () => {
  assert.match(landing, /data-format="fisico"[\s\S]*?data-price="429"/);
  assert.match(
    landing,
    /<h3>Edición Kindle<\/h3>[\s\S]*?Próximamente en Amazon[\s\S]*?Reservar edición Kindle en Amazon/
  );
  assert.doesNotMatch(landing, /data-format="digital"/);
  assert.doesNotMatch(landing, /data-format="ambos"/);

  const promoStart = home.indexOf('class="book-home-promo"');
  const promoEnd = home.indexOf('class="guia-section"');
  const promo = home.slice(promoStart, promoEnd);

  assert.doesNotMatch(promo, /\$(429|249|599)/);
  assert.match(promo, /¿qué hacemos con aquello que descubrimos/);
  assert.match(promo, />\s*Quiero descubrir lo que guarda la Cámara\s*</);
});

test("V136 presenta la promoción dentro de una tarjeta delimitada", () => {
  assert.match(
    homeCss,
    /\.book-home-promo__inner\s*\{[\s\S]*?border:\s*1px solid rgba\(201, 162, 39, 0\.62\)/
  );
  assert.match(
    homeCss,
    /\.book-home-promo__inner\s*\{[\s\S]*?border-radius:\s*22px/
  );
});

test("V136 conserva el módulo del libro dentro de su carpeta", () => {
  assert.match(landing, /href="\.\.\/assets\/css\/styles\.css"/);
  assert.match(landing, /href="assets\/css\/libro\.css"/);
  assert.match(
    landing,
    /src="assets\/js\/preventa\.js(?:\?[^"\s]*)?"/
  );
  assert.match(
    landing,
    /src="assets\/img\/libro-camara-reflexiones-tapa-blanda\.gif"/
  );
  assert.match(preorderJs, /const BANK_DETAILS/);
});

test("V136 permite desplazamiento vertical y no activa Inicio en la landing", () => {
  assert.match(bookCss, /\.book-launch\s*\{\s*overflow-x:\s*hidden/);
  assert.doesNotMatch(bookCss, /\.book-launch\s*\{\s*overflow:\s*hidden/);
  assert.match(headerJs, /path\.includes\('\/libro-la-camara-de-reflexiones\/'\)/);
});

test("V136 incorpora la landing al sitemap", () => {
  assert.match(
    sitemap,
    /https:\/\/develandoelcodigomasonico\.com\/libro-la-camara-de-reflexiones\//
  );
});
