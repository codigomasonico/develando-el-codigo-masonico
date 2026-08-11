# Cartes CORE-004 - Vinculación Web + WhatsApp

Estado: COMPLETADO
Fecha: 2026-08-08

## Objetivo
Unir la identidad anónima persistente de Cartes Web con la identidad WhatsApp del mismo usuario sin contraseñas y sin crear un segundo sistema de autenticación.

## Flujo implementado
1. En Cartes Web aparece el botón `Vincular`.
2. La Web solicita un código temporal al endpoint `/.netlify/functions/cartes-link`.
3. El código tiene 6 dígitos y una vigencia de 10 minutos.
4. La Web abre el WhatsApp oficial de Cartes con el mensaje `VINCULAR 123456` preparado.
5. El webhook de WhatsApp reconoce ese comando antes de procesarlo como consulta.
6. WhatsApp resuelve su `user_id` y llama de forma interna y firmada a Cartes Account.
7. Cartes Account fusiona la identidad Web dentro del usuario WhatsApp.
8. El consumo del periodo actual se conserva y se combina, sin regalar consultas ni reiniciar el contador.
9. La identidad Web queda apuntando al mismo `user_id` de WhatsApp.

## Seguridad
- Código aleatorio de 6 dígitos.
- Vigencia de 10 minutos.
- El código sólo se completa desde el canal WhatsApp autenticado por el webhook existente.
- La llamada WhatsApp -> Cartes Account usa HMAC-SHA256 con `CARTES_INTERNAL_SECRET`.
- Un navegador ya vinculado no puede generar un nuevo código para reasignar la cuenta.
- El endpoint público de estado no expone el `user_id`.

## Archivos principales nuevos o modificados
### Web
- `bot/functions/lib-cartes-account.mjs`
- `bot/functions/cartes-account.mjs`
- `bot/functions/cartes-link.mjs` NUEVO
- `bot/guia-masonico.js`
- `bot/guia-masonico.css`
- `bot/tests/runner.mjs`
- `test/account-core004.test.mjs` NUEVO

### WhatsApp
- `netlify/functions/lib-cartes-account-client.mjs`
- `netlify/functions/cartes-whatsapp.mjs`
- `test/account-link-core004.test.mjs` NUEVO

## Variables de entorno
CORE-004 no agrega secretos nuevos. Reutiliza:
- `CARTES_INTERNAL_SECRET`
- `CARTES_ACCOUNT_API_URL` en WhatsApp cuando corresponda

El número público de Cartes usado por la Web para abrir WhatsApp es 52 33 2233 8888.

## Validación
- Pruebas específicas CORE-003 + CORE-004: 11/11.
- Suite principal del motor Web: 18/18.
- Suite WhatsApp: 50 pruebas ejecutables aprobadas. 6 pruebas no cargan en este entorno por ausencia de `@netlify/blobs`, la misma limitación ya observada en CORE-003.

## Despliegue
NO desplegar todavía. Esta entrega continúa siendo una base de integración. La activación coordinada de Web + WhatsApp se hará cuando los bloques siguientes estén cerrados y se prepare un procedimiento de migración/deploy controlado.
