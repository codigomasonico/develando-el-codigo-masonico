/* =========================
   app.js
   ========================= */

"use strict";

let allEpisodes = [];
let allBoletines = [];
let allReflexiones = [];

const REFLEXIONES_PER_PAGE = 6;
const EPISODES_PER_PAGE = 6;
const BOLETINES_PER_PAGE = 6;

let episodesFiltered = [];
let episodesVisible = EPISODES_PER_PAGE;
let boletinesFiltered = [];
let boletinesVisible = BOLETINES_PER_PAGE;

let reflexionesFiltered = [];
let reflexionesVisible = REFLEXIONES_PER_PAGE;

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

function normalizeText(value) {
	return String(value || "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

function encodeFormData(formElement) {
	return new URLSearchParams(new FormData(formElement)).toString();
}

function openModal(modal) {
	if (!modal) return;

	modal.classList.add("is-open");
	modal.setAttribute("aria-hidden", "false");
	document.body.classList.add("modal-open");
}

function closeModal(modal) {
	if (!modal) return;

	modal.classList.remove("is-open");
	modal.setAttribute("aria-hidden", "true");

	if (!document.querySelector(".responde-modal.is-open")) {
		document.body.classList.remove("modal-open");
  }
}

/* =========================
   EPISODIOS
   ========================= */

async function loadEpisodes() {
	try {
		const res = await fetch("assets/data/episodios.json");
		if (!res.ok) throw new Error("No se pudo cargar episodios.json");

		allEpisodes = (await res.json()).sort(
			(a, b) => Number(b.numero) - Number(a.numero)
		);
    if (!Array.isArray(allEpisodes) || allEpisodes.length === 0) return;

		const latestEpisode = [...allEpisodes].sort(
			(a, b) => Number(b.numero) - Number(a.numero)
		)[0];

		renderLatestEpisode(latestEpisode);
		episodesFiltered = [...allEpisodes].sort(
			(a, b) => Number(b.numero) - Number(a.numero)
		);
		episodesVisible = EPISODES_PER_PAGE;
		renderEpisodeLibrary(episodesFiltered);
	} catch (err) {
		console.error("Error cargando episodios:", err);
		const latest = document.getElementById("latestEpisode");
		if (latest) latest.textContent = "No se pudo cargar el episodio.";
	}
}

function renderLatestEpisode(ep) {
	const container = document.getElementById("latestEpisode");
	if (!container || !ep) return;

	const spotifyId = safeSpotifyId(ep.spotify);

	container.innerHTML = `
		<div class="latest-title">
			<img src="assets/img/icon-podcast.png" class="episode-icon" alt="">
			<span>${ep.titulo}</span>
		</div>

		<div class="episode-meta">
			${formatSpanishDate(ep.fecha)} • ${ep.duracion} • ${ep.categoria}
		</div>

		<p class="episode-description">${ep.descripcion}</p>

		${
			spotifyId
				? `<iframe
						title="Reproductor Spotify del podcast Develando el Código Masónico"
						style="border-radius:12px"
						src="https://open.spotify.com/embed/episode/${spotifyId}?theme=0"
						width="100%"
						height="84"
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

function renderEpisodeLibrary(episodes) {
	const container = document.getElementById("episodeResults");
	if (!container) return;

	container.innerHTML = "";

	if (!episodes.length) {
		container.innerHTML = `
			<div class="card">
				<p class="muted">No hay episodios disponibles en esta categoría.</p>
			</div>
		`;
		return;
	}

	episodes.slice(0, episodesVisible).forEach((ep, index) => {
		const spotifyId = safeSpotifyId(ep.spotify);
		const descId = `episode-desc-${index}`;
		const card = document.createElement("div");
		card.className = "episode-card";

		card.innerHTML = `
			<div class="responde-card__content episode-library-card__main">
				<p class="responde-meta-line">
					<span>🎙️ EP${String(ep.numero).padStart(3, "0")}</span>
					<span aria-hidden="true">|</span>
					<span>${formatSpanishDate(ep.fecha)}</span>
					<span aria-hidden="true">|</span>
					<span>${ep.duracion}</span>
					<span aria-hidden="true">|</span>
					<span>${ep.categoria}</span>
				</p>

				<h2>${ep.titulo}</h2>

				<div class="episode-actions">
					<button class="episode-toggle-link" type="button" aria-expanded="false" aria-controls="${descId}">
						Ver descripción
					</button>

					${
						spotifyId
							? `<a
									class="episode-play-link"
									href="${ep.spotify}"
									target="_blank"
									rel="noopener noreferrer">
									Escuchar episodio →
								</a>`
							: ""
					}
				</div>
			</div>

			<div id="${descId}" class="episode-card__desc" hidden>
				<p>${ep.descripcion}</p>
			</div>
		`;

		container.appendChild(card);
  });

	updateEpisodesLoadMoreButton(episodes.length);
	initEpisodeToggles();
}

function updateEpisodesLoadMoreButton(total) {
	let container = document.getElementById("episodesLoadMoreContainer");

	if (!container) {
		container = document.createElement("div");
		container.id = "episodesLoadMoreContainer";
		container.className = "load-more-container";

		container.innerHTML = `
			<button
				id="loadMoreEpisodes"
				class="btn btn-secondary"
				type="button">
				Mostrar más
			</button>
		`;

		const results = document.getElementById("episodeResults");

		if (results && results.parentNode) {
			results.parentNode.insertBefore(container, results.nextSibling);
		}

		const button = document.getElementById("loadMoreEpisodes");

		if (button) {
			button.addEventListener("click", () => {
				const source = episodesFiltered.length ? episodesFiltered : allEpisodes;

				if (episodesVisible >= source.length) {
					episodesVisible = EPISODES_PER_PAGE;
				} else {
					episodesVisible += EPISODES_PER_PAGE;
				}

				renderEpisodeLibrary(source);
			});
		}
	}

	const button = document.getElementById("loadMoreEpisodes");

	if (!button) return;

	if (total <= EPISODES_PER_PAGE) {
		container.style.display = "none";
		return;
	}

	container.style.display = "flex";

	if (episodesVisible >= total) {
		button.textContent = "Mostrar menos";
	} else {
		button.textContent = "Mostrar más";
	}
}

function initEpisodeToggles() {
	const toggles = document.querySelectorAll(".episode-toggle-link");

	toggles.forEach((toggle) => {
		toggle.addEventListener("click", () => {
			const targetId = toggle.getAttribute("aria-controls");
			const target = document.getElementById(targetId);
			if (!target) return;

			const isOpen = toggle.getAttribute("aria-expanded") === "true";

			toggle.setAttribute("aria-expanded", String(!isOpen));
			toggle.textContent = isOpen ? "Ver descripción" : "Ocultar descripción";
			target.hidden = isOpen;
		});
	});
}

function initEpisodeFilters() {
	const searchInput = document.getElementById("searchInput");
	const categorySelect = document.getElementById("categorySelect");

	if (!searchInput && !categorySelect) return;

	function applyEpisodeFilters() {
		const searchTerm = normalizeText(searchInput ? searchInput.value : "");
		const selectedCategory = categorySelect ? categorySelect.value : "";

		const filtered = allEpisodes.filter((ep) => {
			const searchableText = normalizeText([
				ep.numero,
				ep.titulo,
				ep.categoria,
				ep.fecha,
				ep.duracion,
				ep.descripcion,
				ep.invitado
			].join(" "));

			const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
			const matchesCategory = !selectedCategory || ep.categoria === selectedCategory;

			return matchesSearch && matchesCategory;
		});

		episodesFiltered = filtered;
		episodesVisible = EPISODES_PER_PAGE;
		renderEpisodeLibrary(episodesFiltered);
  }

	if (searchInput) searchInput.addEventListener("input", applyEpisodeFilters);
	if (categorySelect) categorySelect.addEventListener("change", applyEpisodeFilters);
}

/* =========================
   FORMULARIOS CON MODAL
   ========================= */

function initAjaxForm({ formId, modalId, closeSelector, errorLabel }) {
	const form = document.getElementById(formId);
	const modal = document.getElementById(modalId);

	if (!form || !modal) return;

	form.addEventListener("submit", async (event) => {
		event.preventDefault();

		const submitButton = form.querySelector('button[type="submit"]');
		const originalText = submitButton ? submitButton.textContent : "";

		if (submitButton) {
			submitButton.disabled = true;
			submitButton.textContent = "Enviando...";
		}

		try {
			await fetch("/", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: encodeFormData(form)
			});

			form.reset();
			openModal(modal);
		} catch (error) {
			console.error(errorLabel, error);

			form.reset();
			openModal(modal);
		} finally {
			if (submitButton) {
				submitButton.disabled = false;
				submitButton.textContent = originalText;
			}
		}
	});

	modal.addEventListener("click", (event) => {
		if (event.target.matches(closeSelector)) {
			closeModal(modal);
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && modal.classList.contains("is-open")) {
			closeModal(modal);
		}
	});
}

function initEpisodeAlertForm() {
	initAjaxForm({
		formId: "episodeAlertForm",
		modalId: "episodeAlertSuccessModal",
		closeSelector: "[data-close-episode-alert-modal]",
		errorLabel: "Error enviando aviso de episodio:"
	});
}

function initSubscribeForm() {
	initAjaxForm({
		formId: "subscribeForm",
		modalId: "subscribeSuccessModal",
		closeSelector: "[data-close-subscribe-modal]",
		errorLabel: "Error enviando suscripción:"
	});
}

function initProposalForm() {
	initAjaxForm({
		formId: "proposalForm",
		modalId: "proposalSuccessModal",
		closeSelector: "[data-close-proposal-modal]",
		errorLabel: "Error enviando propuesta:"
	});
}

function initContactForm() {
	initAjaxForm({
		formId: "contactForm",
		modalId: "contactSuccessModal",
		closeSelector: "[data-close-contact-modal]",
		errorLabel: "Error enviando contacto:"
	});
}

function initUnsubscribeEpisodesForm() {
	initAjaxForm({
		formId: "unsubscribeEpisodesForm",
		modalId: "unsubscribeEpisodesSuccessModal",
		closeSelector: "[data-close-unsubscribe-episodes-modal]",
		errorLabel: "Error enviando baja de avisos de episodios:"
	});
}

function initUnsubscribeForm() {
	initAjaxForm({
		formId: "unsubscribeForm",
		modalId: "unsubscribeSuccessModal",
		closeSelector: "[data-close-unsubscribe-modal]",
		errorLabel: "Error enviando baja del boletín:"
	});
}

function initUnsubscribeReflexionesForm() {
	initAjaxForm({
		formId: "unsubscribeReflexionesForm",
		modalId: "unsubscribeReflexionesSuccessModal",
		closeSelector: "[data-close-unsubscribe-reflexiones-modal]",
		errorLabel: "Error enviando baja de reflexiones:"
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
		if (!res.ok) throw new Error("No se pudo cargar boletines.json");

		allBoletines = (await res.json()).sort(
			(a, b) => getBoletinOrden(b) - getBoletinOrden(a)
		);

		if (!Array.isArray(allBoletines) || allBoletines.length === 0) {
			container.innerHTML = "<p>No hay boletines disponibles.</p>";
			return;
		}

		boletinesFiltered = [...allBoletines];
		boletinesVisible = BOLETINES_PER_PAGE;

		renderBoletines(boletinesFiltered);
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

function formatSpanishDate(value) {
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

	return value;
}


function getBoletinOrden(value) {
	const orden = Number(value && value.orden);
	if (Number.isFinite(orden)) return orden;

	const numero = Number(value && value.numero);
	if (Number.isFinite(numero)) return numero;

	return 0;
}

function renderBoletines(lista) {
  const container = document.getElementById("boletinesResults");
	if (!container) return;

	container.innerHTML = "";

	if (!lista.length) {
		container.innerHTML = "<p>No hay resultados.</p>";
		return;
	}

	lista.slice(0, boletinesVisible).forEach((b) => {
		const card = document.createElement("div");
		const fechaMostrada = formatBoletinDate(b.fecha);

		card.className = "responde-card boletin-card";

		card.innerHTML = `
			<div class="responde-card__content">
				<p class="responde-meta-line">
					<span>
						📄 ${b.especial
							? "Edición Especial"
							: `Boletín ${String(b.numero).padStart(3, "0")}`}
					</span>
					<span aria-hidden="true">|</span>
					<span>${fechaMostrada}</span>
				</p>

				<h2>${b.titulo}</h2>
			</div>

			<a
				href="${b.archivo}"
				class="episode-play-link boletin-download-link"
				target="_blank"
				rel="noopener noreferrer">
				Descargar →
			</a>
		`;

		container.appendChild(card);
	});

	updateBoletinesLoadMoreButton(lista.length);
}

function updateBoletinesLoadMoreButton(total) {
	let container = document.getElementById("boletinesLoadMoreContainer");

	if (!container) {
		container = document.createElement("div");
		container.id = "boletinesLoadMoreContainer";
		container.className = "load-more-container";

		container.innerHTML = `
			<button
				id="loadMoreBoletines"
				class="btn btn-secondary"
				type="button">
				Mostrar más
			</button>
		`;

		const results = document.getElementById("boletinesResults");

		if (results && results.parentNode) {
			results.parentNode.insertBefore(container, results.nextSibling);
		}

		const button = document.getElementById("loadMoreBoletines");

		if (button) {
			button.addEventListener("click", () => {
				const source = boletinesFiltered.length ? boletinesFiltered : allBoletines;

				if (boletinesVisible >= source.length) {
					boletinesVisible = BOLETINES_PER_PAGE;
				} else {
					boletinesVisible += BOLETINES_PER_PAGE;
				}

				renderBoletines(source);
			});
		}
	}

	const button = document.getElementById("loadMoreBoletines");

	if (!button) return;

	if (total <= BOLETINES_PER_PAGE) {
		container.style.display = "none";
		return;
	}

	container.style.display = "flex";
	button.textContent = boletinesVisible >= total ? "Mostrar menos" : "Mostrar más";
	}

	function initBoletinesFilters() {
	const searchInput = document.getElementById("searchBoletines");
	const yearSelect = document.getElementById("yearSelect");

	if (!searchInput && !yearSelect) return;

	if (yearSelect) {
		const years = [
			...new Set(
				allBoletines
					.map((b) => {
						const match = String(b.fecha).match(/\b(20\d{2}|19\d{2})\b/);
						return match ? match[1] : null;
					})
					.filter(Boolean)
			)
		];

		years.sort((a, b) => Number(b) - Number(a));
		yearSelect.innerHTML = '<option value="">Todos los años</option>';

		years.forEach((y) => {
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

			filtered = filtered.filter((b) =>
				b.titulo.toLowerCase().includes(text) ||
				b.descripcion.toLowerCase().includes(text)
			);
		}

		if (yearSelect && yearSelect.value) {
			filtered = filtered.filter((b) => {
				const match = String(b.fecha).match(/\b(20\d{2}|19\d{2})\b/);
				return match && match[1] === yearSelect.value;
			});
		}

		boletinesFiltered = filtered.sort(
			(a, b) => getBoletinOrden(b) - getBoletinOrden(a)
		);
		boletinesVisible = BOLETINES_PER_PAGE;
		renderBoletines(boletinesFiltered);
	}

	if (searchInput) searchInput.addEventListener("input", applyFilters);
	if (yearSelect) yearSelect.addEventListener("change", applyFilters);
}


	/* =========================
	 REFLEXIONES
	 ========================= */

	async function loadReflexiones() {
	const container = document.getElementById("reflexionesResults");
	if (!container) return;

	try {
		const res = await fetch("assets/data/reflexiones.json");
		if (!res.ok) throw new Error("No se pudo cargar reflexiones.json");

		allReflexiones = await res.json();

		if (!Array.isArray(allReflexiones) || allReflexiones.length === 0) {
			container.innerHTML = '<div class="card"><p class="muted">Todavía no hay reflexiones publicadas.</p></div>';
			return;
		}

		allReflexiones.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));

		reflexionesFiltered = [...allReflexiones];
		reflexionesVisible = REFLEXIONES_PER_PAGE;

		renderReflexiones(reflexionesFiltered);
		initReflexionesFilters();
	} catch (err) {
		console.error("Error cargando reflexiones:", err);
		container.innerHTML = '<div class="card"><p class="muted">Error al cargar las reflexiones.</p></div>';
	}
}

	function formatReflexionDate(value) {
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

	return value;
}

function updateReflexionesLoadMoreButton(total) {
	let container = document.getElementById("reflexionesLoadMoreContainer");

	if (!container) {
		container = document.createElement("div");
		container.id = "reflexionesLoadMoreContainer";
		container.className = "load-more-container";

		container.innerHTML = `
			<button
				id="loadMoreReflexiones"
				class="btn btn-secondary"
				type="button">
				Mostrar más
			</button>
		`;

		const results = document.getElementById("reflexionesResults");

		if (results && results.parentNode) {
			results.parentNode.insertBefore(container, results.nextSibling);
		}

		const button = document.getElementById("loadMoreReflexiones");

		if (button) {
			button.addEventListener("click", () => {
				const source = reflexionesFiltered.length ? reflexionesFiltered : allReflexiones;

				if (reflexionesVisible >= source.length) {
					reflexionesVisible = REFLEXIONES_PER_PAGE;
				} else {
					reflexionesVisible += REFLEXIONES_PER_PAGE;
				}

				renderReflexiones(source);
			});
    }
  }

	const button = document.getElementById("loadMoreReflexiones");

	if (!button) return;

	if (total <= REFLEXIONES_PER_PAGE) {
		container.style.display = "none";
		return;
	}

	container.style.display = "flex";

	if (reflexionesVisible >= total) {
		button.textContent = "Mostrar menos";
	} else {
		button.textContent = "Mostrar más";
	}
}

function renderReflexiones(lista) {
	const container = document.getElementById("reflexionesResults");
	if (!container) return;

	container.innerHTML = "";

	if (!lista.length) {
		container.innerHTML = '<div class="card"><p class="muted">No hay reflexiones que coincidan con la búsqueda.</p></div>';
		return;
	}

	lista.slice(0, reflexionesVisible).forEach((item) => {
		const card = document.createElement("article");
		card.className = "responde-card reflexion-card";

		const keywords = Array.isArray(item.palabrasClave) ? item.palabrasClave : [];

		card.innerHTML = `
			<div class="responde-card__content reflexion-card__content">
				<p class="responde-meta-line">
					<span>💭 Reflexión</span>
					<span aria-hidden="true">|</span>
					<span>${formatReflexionDate(item.fecha)}</span>
					<span aria-hidden="true">|</span>
					<span>${item.categoria || "Reflexión"}</span>
					${item.episodioNumero ? `<span aria-hidden="true">|</span> <span>Episodio ${item.episodioNumero}</span>` : ""}
				</p>

				<h2>${item.titulo}</h2>
				<p class="muted">${item.descripcion || ""}</p>

				${keywords.length ? `<p class="reflexion-tags">${keywords.map((tag) => `<span>${tag}</span>`).join("")}</p>` : ""}
			</div>

			<a href="${item.url}" class="episode-play-link reflexion-read-link">
				Leer reflexión →
			</a>
		`;

		container.appendChild(card);		
	});
	
	updateReflexionesLoadMoreButton(lista.length);
	
}

function initReflexionesFilters() {
	const searchInput = document.getElementById("searchReflexiones");
	const categorySelect = document.getElementById("reflexionCategorySelect");

	if (!searchInput && !categorySelect) return;

	if (categorySelect) {
		const categories = [...new Set(allReflexiones.map((r) => r.categoria).filter(Boolean))];
		categories.sort((a, b) => a.localeCompare(b, "es"));

		categorySelect.innerHTML = '<option value="">Todas las categorías</option>';

		categories.forEach((category) => {
			const option = document.createElement("option");
			option.value = category;
			option.textContent = category;
			categorySelect.appendChild(option);
		});
	}

	function applyReflexionesFilters() {
		const searchTerm = normalizeText(searchInput ? searchInput.value : "");
		const selectedCategory = categorySelect ? categorySelect.value : "";

		const filtered = allReflexiones.filter((item) => {
			const searchableText = normalizeText([
				item.titulo,
				item.descripcion,
				item.categoria,
				item.episodioRelacionado,
				item.episodioNumero,
				Array.isArray(item.palabrasClave) ? item.palabrasClave.join(" ") : ""
			].join(" "));

			const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
			const matchesCategory = !selectedCategory || item.categoria === selectedCategory;

			return matchesSearch && matchesCategory;
		});

		reflexionesFiltered = filtered;
		reflexionesVisible = REFLEXIONES_PER_PAGE;
		renderReflexiones(reflexionesFiltered);
	}

	if (searchInput) searchInput.addEventListener("input", applyReflexionesFilters);
	if (categorySelect) categorySelect.addEventListener("change", applyReflexionesFilters);
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
		.map((el) => el.textContent.trim())
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
		.then((response) => {
			if (!response.ok) {
				throw new Error(`No se pudo cargar libros.json: ${response.status}`);
			}

			return response.json();
		})
		.then((data) => {
			const libros = data.libros || [];

			if (!libros.length) {
				contenedorLibros.innerHTML = "<p>No hay libros disponibles.</p>";
				return;
			}

			contenedorLibros.innerHTML = libros.map((libro) => `
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
		.catch((error) => {
			console.error(error);
			contenedorLibros.innerHTML = "<p>Error al cargar las lecturas recomendadas.</p>";
		});
}

/* =========================
   SCROLL HASH
   ========================= */

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
		loadReflexiones(),
		loadLecturas()
	]);

	initNewsbar();
	initEpisodeFilters();
	initEpisodeAlertForm();
	initSubscribeForm();
	initProposalForm();
	initContactForm();
	initUnsubscribeForm();
	initUnsubscribeEpisodesForm();
	initUnsubscribeReflexionesForm();

	const yearEl = document.getElementById("year");
	if (yearEl) yearEl.textContent = new Date().getFullYear();

	if (window.location.hash) {
		requestAnimationFrame(() => {
			setTimeout(scrollToHashWithOffset, 120);
		});
	}
});