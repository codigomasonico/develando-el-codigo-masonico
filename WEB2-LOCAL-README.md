# Cartes WEB2 - baseline local

Carpeta de trabajo acordada en Windows:

`D:\01 Logia\_Podcast\1000 - Desarrollo\01 - Desarrollo\web2`

## Regla arquitectónica

Web y WhatsApp usan el mismo Core y la misma cuenta central. WhatsApp es solo un adaptador de canal.
Mercado Pago y PayPal sincronizan la misma suscripción/plan central, compartida con Web.

## WhatsApp V2

La implementación anterior de `channels/whatsapp` fue sustituida por una capa V2 mínima y testeable.
No usa llamadas HTTP internas a `CARTES_API_URL` o `CARTES_ACCOUNT_API_URL` para procesar mensajes WhatsApp.

Flujo:

Meta -> cartes-whatsapp -> core/ai/guia-masonico -> core/ai/lib-cartes-account -> Meta

Pagos:

WhatsApp -> Mercado Pago / PayPal -> webhook de proveedor -> core/ai/lib-cartes-account -> mismo plan para Web y WhatsApp

## Pruebas locales sin credenciales reales

Ejecutar:

`npm run test:local-web2`

Cubre:

- Core/Web compartido
- vínculo Web + WhatsApp al mismo user_id
- límites 5/50 compartidos
- verificación GET del webhook Meta
- firma HMAC de Meta sobre bytes crudos
- recepción y deduplicación de mensajes
- uso del phone_number_id real del webhook
- llamada al mismo Core
- flujo legal de suscripción
- selección Mercado Pago / PayPal
- checkout MP simulado
- checkout PayPal Sandbox simulado
- webhook MP simulado -> Plus central
- webhook PayPal simulado -> Plus central
- notificación WhatsApp de activación

Las APIs externas están simuladas en estas pruebas. Las credenciales reales se validarán después, una plataforma por vez, sin desplegar a Producción.
