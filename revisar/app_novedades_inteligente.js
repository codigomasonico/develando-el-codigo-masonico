// Barra de novedades (inteligente): rota mensajes y usa el "Último episodio" si está disponible
(function () {
  function textFrom(node) {
    return (node && (node.textContent || "")).replace(/\s+/g, " ").trim();
  }

  function extractLatestEpisodeTitle() {
    var latest = document.getElementById("latestEpisode");
    if (!latest) return null;

    // Si el bloque tiene un link, tomamos el texto del primer link
    var a = latest.querySelector("a");
    if (a) return textFrom(a);

    // Si usa encabezados dentro del card
    var h = latest.querySelector("h3, h4, strong");
    if (h) return textFrom(h);

    // Si solo hay texto plano
    var t = textFrom(latest);
    if (!t || /cargando/i.test(t)) return null;

    // Evita textos genéricos tipo "Ver en..." si aplica
    if (t.length < 4) return null;
    return t;
  }

  function buildMessages(container) {
    var msgs = Array.prototype.slice.call(container.querySelectorAll(".newsbar__msg"))
      .map(function (el) { return textFrom(el); })
      .filter(Boolean);

    // Mensaje dinámico basado en "Último episodio"
    var title = extractLatestEpisodeTitle();
    if (title) {
      msgs.unshift("🆕 Último episodio: " + title);
    } else {
      // Placeholder si aún no cargó, se reemplaza cuando aparezca el título real
      msgs.unshift("🆕 Último episodio: cargando…");
    }

    // Elimina duplicados simples
    var seen = {};
    msgs = msgs.filter(function (m) {
      var key = m.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    return msgs;
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

    function setTicker(text) {
      ticker.classList.add("is-fading");
      setTimeout(function () {
        ticker.textContent = text;
        ticker.classList.remove("is-fading");
      }, 220);
    }

    // Primer render
    ticker.textContent = msgs[0];

    // Rota mensajes
    setInterval(function () {
      i = (i + 1) % msgs.length;
      setTicker(msgs[i]);
    }, 4500);

    // Si el "Último episodio" se carga después, lo detectamos y actualizamos el primer mensaje
    var latest = document.getElementById("latestEpisode");
    if (!latest) return;

    var obs = new MutationObserver(function () {
      var title = extractLatestEpisodeTitle();
      if (title) {
        var dynamic = "🆕 Último episodio: " + title;

        // Actualiza lista de mensajes y el ticker solo si cambió
        if (msgs[0] !== dynamic) {
          msgs[0] = dynamic;
          if (i === 0) setTicker(dynamic);
        }
      }
    });

    obs.observe(latest, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNewsbar);
  } else {
    initNewsbar();
  }
})();
