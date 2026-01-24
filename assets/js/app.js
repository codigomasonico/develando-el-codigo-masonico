/* =========================
   app.js (limpio)
   - Evita duplicar la barra de novedades (antes había 2 inicializaciones)
   - Reduce “saltos” en iOS/Safari evitando múltiples intervals y observadores agresivos
   ========================= */

(function () {
  "use strict";

  function textFrom(node) {
    return (node && (node.textContent || "")).replace(/\s+/g, " ").trim();
  }

  function extractLatestEpisodeTitle() {
    var latest = document.getElementById("latestEpisode");
    if (!latest) return null;

    var a = latest.querySelector("a");
    if (a) return textFrom(a);

    var h = latest.querySelector("h3, h4, strong");
    if (h) return textFrom(h);

    var t = textFrom(latest);
    if (!t || /cargando/i.test(t)) return null;
    if (t.length < 4) return null;

    return t;
  }

  function buildMessages(container) {
    var base = Array.prototype.slice
      .call(container.querySelectorAll(".newsbar__msg"))
      .map(function (el) { return textFrom(el); })
      .filter(Boolean);

    var title = extractLatestEpisodeTitle();
    if (title) {
      base.unshift("🆕 Último episodio: " + title);
    } else {
      base.unshift("🆕 Último episodio: cargando…");
    }

    // Dedup simple
    var seen = {};
    return base.filter(function (m) {
      var k = m.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function initNewsbar() {
    var ticker = document.getElementById("newsTicker");
    if (!ticker) return;

    var container = ticker.closest(".newsbar");
    if (!container) return;

    var msgs = buildMessages(container);
    if (!msgs.length) {
      ticker.textContent = "";
      return;
    }

    var i = 0;
    var intervalId = null;

    // Fade suave sin forzar reflow pesado
    function setTicker(text) {
      // Evita trabajo si no cambió
      if (ticker.textContent === text) return;

      ticker.classList.add("is-fading");

      // requestAnimationFrame ayuda a Safari a aplicar la clase antes del cambio
      requestAnimationFrame(function () {
        window.setTimeout(function () {
          ticker.textContent = text;
          ticker.classList.remove("is-fading");
        }, 200);
      });
    }

    // Render inicial
    ticker.textContent = msgs[0];

    // Rota mensajes (solo 1 interval)
    intervalId = window.setInterval(function () {
      i = (i + 1) % msgs.length;
      setTicker(msgs[i]);
    }, 4500);

    // Observa “Último episodio” con throttle para iOS
    var latest = document.getElementById("latestEpisode");
    if (!latest) return;

    var pending = false;

    function refreshDynamic() {
      pending = false;
      var title = extractLatestEpisodeTitle();
      if (!title) return;

      var dynamic = "🆕 Último episodio: " + title;
      if (msgs[0] !== dynamic) {
        msgs[0] = dynamic;
        if (i === 0) setTicker(dynamic);
      }
    }

    var obs = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      // agrupa cambios múltiples en una sola actualización
      window.setTimeout(refreshDynamic, 120);
    });

    obs.observe(latest, { childList: true, subtree: true, characterData: true });

    // Limpieza básica si el usuario navega y la página se “congela” en iOS
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      // Re-render rápido al volver
      if (msgs.length) {
        setTicker(msgs[i] || msgs[0]);
      }
    });
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(initNewsbar);
})();
