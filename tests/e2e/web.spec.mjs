import { test, expect } from '@playwright/test';

async function mockCartesBackend(page, overrides = {}) {
  const usage = overrides.usage || {
    plan: 'gratuito',
    limite: 5,
    usadas: 0,
    disponibles: 5,
    periodo: '2026-08'
  };

  await page.route('**/.netlify/functions/cartes-conversation', async route => {
    const body = route.request().postDataJSON?.() || {};
    if (body.action === 'history') return route.fulfill({ json: { messages: [] } });
    if (body.action === 'clear') return route.fulfill({ json: { ok: true } });
    return route.fulfill({ json: {} });
  });

  await page.route('**/.netlify/functions/cartes-link', async route => {
    const body = route.request().postDataJSON?.() || {};

    if (body.action === 'status') {
      return route.fulfill({
        json: {
          linked: Boolean(overrides.linked),
          usage
        }
      });
    }

    return route.fulfill({
      json: {
        linked: false,
        code: '123456',
        instruction: 'VINCULAR 123456'
      }
    });
  });

  await page.route('**/.netlify/functions/cartes-subscription-status', async route => {
    return route.fulfill({
      json: overrides.subscriptionStatus || {
        plan: usage.plan,
        usage,
        subscription: null
      }
    });
  });

  await page.route('**/.netlify/functions/guia-masonico', route => route.fulfill({
    json: {
      answer: 'Respuesta de prueba de Cartes.',
      usage: {
        plan: 'gratuito',
        limite: 5,
        usadas: 1,
        disponibles: 4,
        periodo: '2026-08'
      }
    }
  }));
}

test('sitio principal y lanzador de Cartes cargan', async ({ page }) => {
  await mockCartesBackend(page);
  await page.goto('/');
  await expect(page.locator('.gm-launcher')).toBeVisible();
  await expect(page.locator('body')).toContainText('Develando');
});

test('Cartes abre y muestra bienvenida', async ({ page }) => {
  await mockCartesBackend(page);
  await page.goto('/');
  await page.locator('.gm-launcher').click();
  await expect(page.locator('.gm-shell')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.gm-messages')).toContainText('Hola, soy Cartes');
});

test('consulta web usa el endpoint central y muestra respuesta', async ({ page }) => {
  await mockCartesBackend(page);
  await page.goto('/');
  await page.locator('.gm-launcher').click();
  await page.locator('.gm-input').fill('¿Qué representa la escuadra?');
  await page.locator('.gm-send').click();
  await expect(page.locator('.gm-messages')).toContainText('Respuesta de prueba de Cartes.');
});

test('Cartes muestra y actualiza las consultas disponibles X de Y', async ({ page }) => {
  await mockCartesBackend(page);
  await page.goto('/');
  await page.locator('.gm-launcher').click();

  await expect(page.locator('.gm-header__usage'))
    .toHaveText('Consultas disponibles: 5 de 5');

  await page.locator('.gm-input').fill('¿Qué representa la escuadra?');
  await page.locator('.gm-send').click();

  await expect(page.locator('.gm-header__usage'))
    .toHaveText('Consultas disponibles: 4 de 5');
});

test('estado vinculado se refleja en la Web', async ({ page }) => {
  await mockCartesBackend(page, { linked: true });
  await page.goto('/');
  await page.locator('.gm-launcher').click();
  await expect(page.locator('.gm-link')).toHaveText('Vinculado');
});

test('limpiar conversación llama a memoria central', async ({ page }) => {
  await mockCartesBackend(page);

  let cleared = false;

  await page.unroute('**/.netlify/functions/cartes-conversation');

  await page.route('**/.netlify/functions/cartes-conversation', async route => {
    const body = route.request().postDataJSON?.() || {};
    if (body.action === 'clear') cleared = true;

    return route.fulfill({
      json: body.action === 'history'
        ? { messages: [] }
        : { ok: true }
    });
  });

  page.on('dialog', dialog => dialog.accept());

  await page.goto('/');
  await page.locator('.gm-launcher').click();
  await page.locator('.gm-clear').click();

  await expect.poll(() => cleared).toBe(true);
  await expect(page.locator('.gm-messages')).toContainText('Hola, soy Cartes');
});

test('aliases de Mi suscripción muestran estado sin consumir consulta', async ({ page }) => {
  let consultasAlMotor = 0;

  const usage = {
    plan: 'plus',
    limite: 50,
    usadas: 2,
    disponibles: 48,
    periodo: '2026-08'
  };

  await mockCartesBackend(page, {
    linked: true,
    usage,
    subscriptionStatus: {
      plan: 'plus',
      usage,
      subscription: {
        provider: 'paypal',
        status: 'cancelled',
        renovacion_cancelada: true,
        access_until: '2026-09-14T00:00:00.000Z',
        next_payment_date: '2026-09-14T00:00:00.000Z'
      }
    }
  });

  await page.unroute('**/.netlify/functions/guia-masonico');

  await page.route('**/.netlify/functions/guia-masonico', async route => {
    consultasAlMotor += 1;
    return route.fulfill({
      json: {
        answer: 'No debería llamarse.',
        usage
      }
    });
  });

  await page.goto('/');
  await page.locator('.gm-launcher').click();

  for (const comando of [
    'suscripcion',
    'suscripción',
    'mi suscripcion',
    'mi suscripción'
  ]) {
    await page.locator('.gm-input').fill(comando);
    await page.locator('.gm-send').click();

    await expect(page.locator('.gm-messages')).toContainText('Plan: Cartes Plus');
    await expect(page.locator('.gm-messages')).toContainText('Medio de pago: PayPal');
    await expect(page.locator('.gm-messages')).toContainText('Consultas usadas: 2 de 50');
    await expect(page.locator('.gm-messages')).toContainText('Renovación: Cancelada');

    await expect(page.locator('.gm-header__usage'))
      .toHaveText('Consultas disponibles: 48 de 50');
  }

  expect(consultasAlMotor).toBe(0);
});

test('Vincular ofrece apertura y copia como respaldo en escritorio', async ({ page }) => {
  await mockCartesBackend(page);

  await page.addInitScript(() => {
    window.__openedWhatsAppUrl = null;
    window.open = (url) => {
      window.__openedWhatsAppUrl = String(url);
      return null;
    };
  });

  await page.goto('/');
  await page.locator('.gm-launcher').click();
  await page.locator('.gm-link').click();

  await expect(page.locator('.gm-messages'))
    .toContainText('Envía desde el WhatsApp que deseas vincular: VINCULAR 123456');

  await expect(page.locator('.gm-messages'))
    .toContainText('compartirán plan, consultas, suscripción y conversación');
  await expect(page.getByRole('button', { name: 'Abrir chat con Cartes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar código' })).toBeVisible();

  const openedUrl = await page.evaluate(() => window.__openedWhatsAppUrl);

  expect(openedUrl).toContain('https://wa.me/523322338888');
  expect(openedUrl).toContain('VINCULAR%20123456');
});