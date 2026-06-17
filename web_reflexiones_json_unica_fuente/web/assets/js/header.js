const headerScript = document.currentScript;
const headerScriptUrl = headerScript ? headerScript.src : '';

document.addEventListener('DOMContentLoaded', () => {
  const headerMount = document.querySelector('[data-header]');
  if (!headerMount) return;

  const headerUrl = headerScriptUrl
    ? new URL('../partials/header.html', headerScriptUrl).href
    : 'assets/partials/header.html';

  fetch(headerUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar el header: ${response.status}`);
      }
      return response.text();
    })
    .then((html) => {
      headerMount.innerHTML = html;

      const menuToggle = document.querySelector('.menu-toggle');
      const siteNav = document.querySelector('.site-nav');

      if (menuToggle && siteNav) {
        menuToggle.addEventListener('click', () => {
          const isOpen = siteNav.classList.toggle('is-open');
          menuToggle.classList.toggle('is-open', isOpen);
          menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        siteNav.querySelectorAll('a').forEach((link) => {
          link.addEventListener('click', () => {
            siteNav.classList.remove('is-open');
            menuToggle.classList.remove('is-open');
            menuToggle.setAttribute('aria-expanded', 'false');
          });
        });
      }

      const path = window.location.pathname;
      const currentPage = path.split('/').pop().replace('.html', '') || 'index';

      const pageMap = {
        suscribirse: 'boletines'
      };

      let activePage = pageMap[currentPage] || currentPage;

      if (path.includes('/reflexiones/') || path.includes('/archivo-reflexiones/')) {
        activePage = 'reflexiones';
      }

      document.querySelectorAll('.nav-link').forEach((link) => {
        if (link.dataset.page === activePage) {
          link.classList.add('active');
        }
      });
    })
    .catch((error) => {
      console.error(error);
    });
});