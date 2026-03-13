/* =========================
   app.js
   ========================= */

"use strict";

/* =========================
   VARIABLES GLOBALES
   ========================= */

let allEpisodes = [];

/* =========================
   UTILIDADES
   ========================= */

function safeSpotifyId(url) {

  if (!url) return null;

  try {

    if (!url.includes("/episode/")) return null;

    return url.split("/episode/")[1].split("?")[0];

  } catch {
    return null;
  }

}

/* =========================
   CARGA DE EPISODIOS
   ========================= */

async function loadEpisodes() {

  try {

    const res = await fetch("assets/data/episodes.json");

    if (!res.ok) {
      throw new Error("No se pudo cargar episodes.json");
    }

    allEpisodes = await res.json();

    if (!Array.isArray(allEpisodes) || allEpisodes.length === 0) {
      console.warn("No hay episodios");
      return;
    }

    allEpisodes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    renderLatestEpisode(allEpisodes[0]);
    renderEpisodeLibrary(allEpisodes);

  } catch (err) {

    console.error("Error cargando episodios:", err);

    const latest = document.getElementById("latestEpisode");
    if (latest) latest.textContent = "No se pudo cargar el episodio.";

  }

}

/* =========================
   ÚLTIMO EPISODIO
   ========================= */

function renderLatestEpisode(ep) {

  const container = document.getElementById("latestEpisode");
  if (!container) return;

  const spotifyId = safeSpotifyId(ep.spotify);

  container.innerHTML = `

    <div class="latest-title">
      <img src="assets/img/icon-podcast.png" class="episode-icon" alt="">
      <span>${ep.titulo}</span>
    </div>

    <div class="episode-meta">
      ${ep.fecha} • ${ep.duracion} • ${ep.categoria}
    </div>

    <p class="episode-description">
      ${ep.descripcion}
    </p>

    ${
      spotifyId
        ? `
    <iframe
      style="border-radius:12px"
      src="https://open.spotify.com/embed/episode/${spotifyId}?theme=0"
      width="100%"
      height="152"
      frameBorder="0"
      allowfullscreen=""
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture">
    </iframe>`
        : ""
    }

    ${
      ep.transcripcion
        ? `<a class="transcript-link" href="${ep.transcripcion}">Leer transcripción</a>`
        : ""
    }

  `;
}

/* =========================
   BIBLIOTECA DE EPISODIOS
   ========================= */

function renderEpisodeLibrary(episodes) {

  const container = document.getElementById("episodeResults");
  if (!container) return;

  container.innerHTML = "";

  if (!episodes.length) {

    container.innerHTML = `
      <div class="card">
        <p class="muted">
          No hay episodios disponibles en esta categoría.
        </p>
      </div>
    `;

    return;
  }

  episodes.forEach(ep => {

    const spotifyId = safeSpotifyId(ep.spotify);

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `

      <h3>${ep.titulo}</h3>

      <p class="muted">${ep.descripcion}</p>

      ${
        spotifyId
          ? `
      <iframe
        style="border-radius:12px"
        src="https://open.spotify.com/embed/episode/${spotifyId}?theme=0"
        width="100%"
        height="152"
        frameBorder="0"
        allowfullscreen=""
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture">
      </iframe>`
          : ""
      }

    `;

    container.appendChild(card);

  });

}

/* =========================
   FILTRO POR CATEGORÍA
   ========================= */

function initCategoryFilter() {

  const select = document.getElementById("categorySelect");
  if (!select) return;

  select.addEventListener("change", () => {

    const category = select.value;

    let filtered = allEpisodes;

    if (category) {
      filtered = allEpisodes.filter(ep => ep.categoria === category);
    }

    renderEpisodeLibrary(filtered);

  });

}

/* =========================
   NEWSBAR (NOVEDADES)
   ========================= */

function initNewsbar() {

  const ticker = document.getElementById("newsTicker");
  if (!ticker) return;

  const container = ticker.closest(".newsbar");
  if (!container) return;

  const msgs = [...container.querySelectorAll(".newsbar__msg")]
    .map(el => el.textContent.trim())
    .filter(Boolean);

  if (!msgs.length) return;

  let i = 0;

  ticker.textContent = msgs[0];

  setInterval(() => {

    i = (i + 1) % msgs.length;

    ticker.classList.add("is-fading");

    setTimeout(() => {

      ticker.textContent = msgs[i];
      ticker.classList.remove("is-fading");

    }, 200);

  }, 4500);

}

/* =========================
   INICIALIZACIÓN
   ========================= */

document.addEventListener("DOMContentLoaded", () => {

  loadEpisodes();
  initNewsbar();
  initCategoryFilter();

});

/* =========================
   LECTURAS
   ========================= */
	 
document.addEventListener("DOMContentLoaded", () => {
  const contenedorLibros = document.getElementById("listaLibros");

  if (contenedorLibros) {
    fetch("assets/data/libros.json")
      .then(response => {
        if (!response.ok) {
          throw new Error(`No se pudo cargar libros.json: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        const libros = data.libros || [];

        if (!libros.length) {
          contenedorLibros.innerHTML = "<p>No hay libros disponibles.</p>";
          return;
        }

				contenedorLibros.innerHTML = libros.map(libro => `
					<article class="libro-card">
						<div class="libro-icono">📘</div>
						<div class="libro-contenido">
							<h4 class="libro-titulo">${libro.titulo}</h4>
							<p class="libro-autor">${libro.autor}</p>
							<p class="libro-tema">${libro.tema}</p>
						</div>
					</article>
				`).join("");
      })
      .catch(error => {
        console.error(error);
        contenedorLibros.innerHTML = "<p>Error al cargar las lecturas recomendadas.</p>";
      });
  }
});