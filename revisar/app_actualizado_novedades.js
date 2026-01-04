// Barra de novedades (rotación simple)
(function () {
  function initNewsbar() {
    var ticker = document.getElementById("newsTicker");
    if (!ticker) return;

    var container = ticker.closest(".newsbar");
    if (!container) return;

    var msgs = Array.prototype.slice.call(container.querySelectorAll(".newsbar__msg"))
      .map(function (el) { return (el.textContent || "").trim(); })
      .filter(Boolean);

    if (!msgs.length) {
      ticker.textContent = "";
      return;
    }

    var i = 0;
    ticker.textContent = msgs[i];

    setInterval(function () {
      i = (i + 1) % msgs.length;

      ticker.classList.add("is-fading");
      setTimeout(function () {
        ticker.textContent = msgs[i];
        ticker.classList.remove("is-fading");
      }, 230);
    }, 4500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNewsbar);
  } else {
    initNewsbar();
  }
})();
