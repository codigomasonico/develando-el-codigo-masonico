const footerScript = document.currentScript;
const footerScriptUrl = footerScript ? footerScript.src : '';

document.addEventListener('DOMContentLoaded', () => {
  const footerMount = document.querySelector('[data-footer]');
  if (!footerMount) return;

  const footerUrl = footerScriptUrl
    ? new URL('../partials/footer.html', footerScriptUrl).href
    : 'assets/partials/footer.html';

  fetch(footerUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar el footer: ${response.status}`);
      }
      return response.text();
    })
    .then((html) => {
      footerMount.innerHTML = html;

      const year = document.querySelector('#year');
      if (year) {
        year.textContent = new Date().getFullYear();
      }
    })
    .catch((error) => {
      console.error(error);
    });
});