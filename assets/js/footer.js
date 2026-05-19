document.addEventListener('DOMContentLoaded', () => {
  const footerMount = document.querySelector('[data-footer]');

  if (!footerMount) return;

  fetch('assets/partials/footer.html')
    .then((response) => response.text())
    .then((html) => {
      footerMount.innerHTML = html;

      const year = document.querySelector('#year');

      if (year) {
        year.textContent = new Date().getFullYear();
      }
    })
    .catch((error) => {
      console.error('No se pudo cargar el footer:', error);
    });
});