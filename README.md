# Cartes

Proyecto unificado de Cartes, con un solo núcleo y múltiples interfaces.

## Estructura

- `core/ai/`: motor de Cartes, identidad, cuentas, consumo, suscripción y memoria.
- `core/knowledge/`: conocimiento local del motor masónico.
- `api/`: contratos HTTP del Core.
- `channels/web/public/`: sitio Web y cliente Web de Cartes.
- `channels/whatsapp/`: adaptador, webhook, Mercado Pago y herramientas de WhatsApp.
- `netlify/functions/`: únicos puntos de entrada desplegables de Netlify.
- `tests/`: pruebas Web/Core y WhatsApp.
- `docs/`: historial técnico CORE-002 a CORE-006.

## Principio arquitectónico

Web y WhatsApp no contienen cerebros separados. Ambos consumen el mismo Core y comparten, cuando el usuario vincula sus identidades, `user_id`, plan, consumo, suscripción y memoria conversacional.

## Deploy

No desplegar sin completar la validación integral y configurar las variables de `.env.example` en Netlify.
