document.addEventListener('DOMContentLoaded', () => {
  const headerMount = document.querySelector('[data-header]');

  if (!headerMount) return;

  fetch('assets/partials/header.html')
    .then((response) => response.text())
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

		const currentPage = window.location.pathname
			.split('/')
			.pop()
			.replace('.html', '') || 'index';

		const pageMap = {
			suscribirse: 'boletines'
		};

		const activePage = pageMap[currentPage] || currentPage;

      document.querySelectorAll('.nav-link').forEach((link) => {
				if (link.dataset.page === activePage) {
					link.classList.add('active');
				}
      });
    })
    .catch((error) => {
      console.error('No se pudo cargar el header:', error);
    });
});