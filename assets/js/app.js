/* =========================
   app.js
   ========================= */

"use strict";

/* =========================
   VARIABLES GLOBALES
   ========================= */

let allEpisodes = [];
let allBoletines = [];

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
   BOLETINES
   ========================= */

async function loadBoletines() {
  const container = document.getElementById("boletinesResults");
  if (!container) return;

  try {
    const res = await fetch("assets/data/boletines.json");

    if (!res.ok) {
      throw new Error("No se pudo cargar boletines.json");
    }

    allBoletines = await res.json();

    if (!Array.isArray(allBoletines) || allBoletines.length === 0) {
      container.innerHTML = "<p>No hay boletines disponibles.</p>";
      return;
    }

    renderBoletines(allBoletines);
    initBoletinesFilters();

  } catch (err) {
    console.error("Error cargando boletines:", err);
    container.innerHTML = "<p>Error al cargar boletines.</p>";
  }
}

function formatBoletinDate(value) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);

    return localDate.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  return value;
}

function renderBoletines(lista) {
  const container = document.getElementById("boletinesResults");
  if (!container) return;

  container.innerHTML = "";

  if (!lista.length) {
    container.innerHTML = "<p>No hay resultados.</p>";
    return;
  }

  lista.forEach(b => {
    const card = document.createElement("div");
    card.className = "card boletin-card";

		const fechaMostrada = formatBoletinDate(b.fecha);

    card.innerHTML = `
      <div class="boletin-layout">
        <div class="boletin-main">
          <h3>Boletín ${b.numero}: ${b.titulo}</h3>
          <p class="muted">${b.descripcion}</p>
        </div>

        <div class="boletin-side">
          <span class="boletin-fecha">${fechaMostrada}</span>
          <div class="cta">
            <a href="${b.archivo}" class="btn">Descargar</a>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function initBoletinesFilters() {
  const searchInput = document.getElementById("searchBoletines");
  const yearSelect = document.getElementById("yearSelect");

  if (!searchInput && !yearSelect) return;

  // llenar años
	if (yearSelect) {
		const years = [
			...new Set(
				allBoletines
					.map(b => {
						const match = String(b.fecha).match(/\b(20\d{2}|19\d{2})\b/);
						return match ? match[1] : null;
					})
					.filter(Boolean)
			)
		];

		years.sort((a, b) => Number(b) - Number(a));

		yearSelect.innerHTML = '<option value="">Todos los años</option>';

		years.forEach(y => {
			const option = document.createElement("option");
			option.value = y;
			option.textContent = y;
			yearSelect.appendChild(option);
		});
	}

  function applyFilters() {
    let filtered = allBoletines;

    if (searchInput && searchInput.value) {
      const text = searchInput.value.toLowerCase();
      filtered = filtered.filter(b =>
        b.titulo.toLowerCase().includes(text) ||
        b.descripcion.toLowerCase().includes(text)
      );
    }

		if (yearSelect && yearSelect.value) {
			filtered = filtered.filter(b => {
				const match = String(b.fecha).match(/\b(20\d{2}|19\d{2})\b/);
				return match && match[1] === yearSelect.value;
			});
		}

    renderBoletines(filtered);
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  if (yearSelect) {
    yearSelect.addEventListener("change", applyFilters);
  }
}

/* =========================
   NEWSBAR
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
   LECTURAS
   ========================= */

function loadLecturas() {
  const contenedorLibros = document.getElementById("listaLibros");

  if (!contenedorLibros) return Promise.resolve();

  return fetch("assets/data/libros.json")
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

function scrollToHashWithOffset() {
  if (!window.location.hash) return;

  const target = document.querySelector(window.location.hash);
  if (!target) return;

  const offset = 90;
  const top = target.getBoundingClientRect().top + window.pageYOffset - offset;

  window.scrollTo({
    top,
    behavior: "auto"
  });
}

/* =========================
   INIT GLOBAL
   ========================= */

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.allSettled([
    loadEpisodes(),
    loadBoletines(),
    loadLecturas()
  ]);

  initNewsbar();
  initCategoryFilter();

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (window.location.hash) {
    requestAnimationFrame(() => {
      setTimeout(scrollToHashWithOffset, 120);
    });
  }
});