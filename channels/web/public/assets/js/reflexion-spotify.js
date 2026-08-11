(function () {
	"use strict";

	const scriptUrl = document.currentScript ? document.currentScript.src : "";

	function deshabilitarBoton(boton, mensaje) {
		boton.removeAttribute("href");
		boton.setAttribute("aria-disabled", "true");
		boton.setAttribute("tabindex", "-1");
		boton.classList.add("is-disabled");
		if (mensaje) console.error(mensaje);
	}

	function obtenerSlugActual() {
		const archivo = window.location.pathname.split("/").pop() || "";
		return archivo.replace(/\.html$/i, "");
	}

	document.addEventListener("DOMContentLoaded", async function () {
		const boton = document.querySelector(".article-cta a.btn-primary[data-episodio-numero]");
		if (!boton) return;

		const episodioNumero = Number(boton.dataset.episodioNumero);
		const slugActual = obtenerSlugActual();

		const jsonUrl = scriptUrl
			? new URL("../data/reflexiones.json", scriptUrl).href
			: "../assets/data/reflexiones.json";

		try {
			const respuesta = await fetch(jsonUrl, { cache: "no-store" });
			if (!respuesta.ok) {
				throw new Error(`No se pudo cargar reflexiones.json (${respuesta.status})`);
			}

			const reflexiones = await respuesta.json();
			const reflexion = reflexiones.find(item => item.slug === slugActual)
				|| reflexiones.find(item => Number(item.episodioNumero) === episodioNumero);

			if (!reflexion || !reflexion.spotify) {
				deshabilitarBoton(
					boton,
					`No se encontró enlace de Spotify en reflexiones.json para slug "${slugActual}" / episodio ${episodioNumero}.`
				);
				return;
			}

			boton.href = reflexion.spotify;
			boton.target = "_blank";
			boton.rel = "noopener noreferrer";
			boton.removeAttribute("aria-disabled");
			boton.removeAttribute("tabindex");
			boton.classList.remove("is-disabled");
		} catch (error) {
			deshabilitarBoton(boton, "Error cargando Spotify desde reflexiones.json");
			console.error(error);
		}
	});
})();
