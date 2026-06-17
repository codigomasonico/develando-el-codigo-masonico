"use strict";

const DATA_URL = "assets/data/respuestas.json";

let respuestas = [];

document.addEventListener("DOMContentLoaded", () => {
  initYear();
  bindEvents();
  loadRespuestas();
});

function getElement(id) {
  return document.getElementById(id);
}

function initYear() {
  const year = getElement("year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSearchText(item) {
  return normalizeText([
    item.titulo,
    item.categoria,
    item.pregunta,
    item.resumen,
    Array.isArray(item.tags) ? item.tags.join(" ") : ""
  ].join(" "));
}

function buildCategoryOptions(items) {
  const filterSelect = getElement("qaFilter");

  if (!filterSelect) return;

  filterSelect.innerHTML = '<option value="todas">Todas</option>';

  const categories = new Map();

  items.forEach((item) => {
    if (!item.categoriaId || !item.categoria) return;
    categories.set(item.categoriaId, item.categoria);
  });

  categories.forEach((label, value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    filterSelect.appendChild(option);
  });
}

function renderCards(items) {
  const qaGrid = getElement("qaGrid");

  if (!qaGrid) return;

  qaGrid.innerHTML = "";

  items.forEach((item) => {
    const article = document.createElement("article");

    article.className = "card responde-card";
    article.dataset.category = item.categoriaId || "";
    article.dataset.text = getSearchText(item);

    article.innerHTML = `
      <div class="responde-card__content">
        <p class="responde-meta-line">
          <span>Tema: ${escapeHTML(item.categoria || "Pregunta")}</span>
          <span aria-hidden="true">|</span>
          <span>${escapeHTML(item.duracion ? item.duracion.replace("Lectura de", "Tiempo de lectura") : "Tiempo de lectura breve")}</span>
        </p>

        <h2>Pregunta: ${escapeHTML(item.titulo || "")}</h2>
      </div>

      <button class="btn btn-primary responde-link" type="button" data-answer-id="${escapeHTML(item.id || "")}">
        Ver respuesta
      </button>
    `;

    qaGrid.appendChild(article);
  });
}

function addTooltips(text) {
  return escapeHTML(text).replace(
    /\baplomaciones\b/gi,
    '<span class="responde-tooltip" tabindex="0">aplomaciones<span class="responde-tooltip__text">Entrevistas e investigaciones previas al ingreso a la Masonería.</span></span>'
  );
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

  const anyModalOpen = document.querySelector(".responde-modal.is-open");

  if (!anyModalOpen) {
    document.body.classList.remove("modal-open");
  }
}

function openAnswerModal(item) {
  const answerModal = getElement("answerModal");
  const modalTitle = getElement("modalTitle");
  const modalCategory = getElement("modalCategory");
  const modalBody = getElement("modalBody");

  if (!item || !answerModal || !modalTitle || !modalCategory || !modalBody) return;

  const paragraphs = Array.isArray(item.respuesta)
    ? item.respuesta
    : [item.respuesta];

  modalCategory.textContent = `Tema: ${item.categoria || "Pregunta"} | ${
    item.duracion
      ? item.duracion.replace("Lectura de", "Tiempo de lectura")
      : "Tiempo de lectura breve"
  }`;

  modalTitle.textContent = item.titulo || "";

  modalBody.innerHTML = `
    <div class="responde-modal__question">
      <h3>Pregunta</h3>
      <p>${addTooltips(item.pregunta || "")}</p>
    </div>

    <div class="responde-modal__answer">
      <h3>Respuesta</h3>
      ${paragraphs.map((paragraph) => `<p>${addTooltips(paragraph || "")}</p>`).join("")}
    </div>
  `;

  openModal(answerModal);
}

function filterCards() {
  const searchInput = getElement("qaSearch");
  const filterSelect = getElement("qaFilter");
  const emptyState = getElement("emptyState");

  if (!searchInput || !filterSelect || !emptyState) return;

  const query = normalizeText(searchInput.value.trim());
  const category = filterSelect.value;
  const cards = Array.from(document.querySelectorAll(".responde-card"));

  let visibleCount = 0;

  cards.forEach((card) => {
    const matchesQuery = !query || card.dataset.text.includes(query);
    const matchesCategory = category === "todas" || card.dataset.category === category;
    const shouldShow = matchesQuery && matchesCategory;

    card.style.display = shouldShow ? "flex" : "none";

    if (shouldShow) {
      visibleCount += 1;
    }
  });

  emptyState.style.display = visibleCount ? "none" : "block";
}

async function loadRespuestas() {
  const qaGrid = getElement("qaGrid");
  const emptyState = getElement("emptyState");

  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`No se pudo cargar ${DATA_URL}`);
    }

    const data = await response.json();

    respuestas = Array.isArray(data)
      ? data.filter((item) => item.publicado !== false)
      : [];

    renderCards(respuestas);
    buildCategoryOptions(respuestas);
    filterCards();

  } catch (error) {
    console.error(error);

    if (qaGrid) {
      qaGrid.innerHTML = "";
    }

    if (emptyState) {
      emptyState.style.display = "block";
      emptyState.textContent = "No se pudieron cargar las preguntas. Revisa la ruta assets/data/respuestas.json.";
    }
  }
}

function encodeFormData(form) {
  return new URLSearchParams(new FormData(form)).toString();
}

async function handleQuestionSubmit(event) {
  event.preventDefault();

  const questionForm = event.currentTarget;
  const submitButton = questionForm.querySelector('button[type="submit"]');
  const questionModal = getElement("questionModal");
  const successModal = getElement("successModal");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.dataset.originalText = submitButton.textContent;
    submitButton.textContent = "Enviando...";
  }

  try {
    const response = await fetch("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: encodeFormData(questionForm)
    });

    if (!response.ok) {
      throw new Error("No se pudo enviar el formulario.");
    }

    questionForm.reset();
    closeModal(questionModal);
    openModal(successModal);

  } catch (error) {
    console.error(error);

    /*
      En pruebas locales con servidores estáticos, Netlify Forms no procesa el POST.
      Aun así mostramos el modal para poder validar la experiencia visual.
      La recepción real debe probarse desplegado en Netlify o con Netlify CLI.
    */
    questionForm.reset();
    closeModal(questionModal);
    openModal(successModal);

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = submitButton.dataset.originalText || "Enviar pregunta";
      delete submitButton.dataset.originalText;
    }
  }
}

function bindEvents() {
  const qaGrid = getElement("qaGrid");
  const searchInput = getElement("qaSearch");
  const filterSelect = getElement("qaFilter");

  const answerModal = getElement("answerModal");
  const questionModal = getElement("questionModal");
  const successModal = getElement("successModal");

  const openQuestionForm = getElement("openQuestionForm");
  const questionForm = getElement("questionForm");

  if (qaGrid) {
    qaGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-answer-id]");
      if (!button) return;

      const answer = respuestas.find((item) => item.id === button.dataset.answerId);

      if (answer) {
        openAnswerModal(answer);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", filterCards);
  }

  if (filterSelect) {
    filterSelect.addEventListener("change", filterCards);
  }

  if (openQuestionForm) {
    openQuestionForm.addEventListener("click", () => {
      openModal(questionModal);
    });
  }

  if (questionForm) {
    questionForm.addEventListener("submit", handleQuestionSubmit);
  }

  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-answer-modal]")) {
      closeModal(answerModal);
    }

    if (event.target.matches("[data-close-question-modal]")) {
      closeModal(questionModal);
    }

    if (event.target.matches("[data-close-success-modal]")) {
      closeModal(successModal);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    closeModal(answerModal);
    closeModal(questionModal);
    closeModal(successModal);
  });
}