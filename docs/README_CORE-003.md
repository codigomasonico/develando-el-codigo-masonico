# Cartes CORE-003 - Planes y consumo centralizados

## Estado

CORE-003 implementado y validado como base de desarrollo. NO desplegar todavía a producción.

## Objetivo alcanzado

El consumo deja de modelarse por teléfono o por navegador y pasa a modelarse por `user_id`.
El backend central de cuenta vive temporalmente en Cartes Web porque es el punto común que ya consume WhatsApp para acceder al cerebro.

Modelo central:

- Gratuito: 5 consultas por periodo mensual.
- Cartes Plus: 50 consultas por periodo mensual.
- Clave de consumo: `user_id + periodo`.
- Cada consulta registra `request_id`, `channel`, estado y plan utilizado.
- Una reserva pendiente expira a los 10 minutos si no se completa.
- Una consulta fallida se libera.
- Una consulta duplicada no vuelve a consumir.

## Componentes nuevos

### Web

- `web/bot/functions/lib-cartes-account.mjs`
  - Identidad central.
  - Plan central.
  - Uso mensual central.
  - Reserva, completar y liberar consulta.
- `web/bot/functions/cartes-account.mjs`
  - API interna firmada para los adaptadores externos.
- `web/bot/functions/guia-masonico.mjs`
  - Para canal Web, resuelve identidad y consume del contador central antes de llamar al cerebro.
- `web/package.json`
  - Declara `@netlify/blobs` para persistencia central.
- `web/.env.example`
  - Documenta `CARTES_INTERNAL_SECRET`.

### WhatsApp

- `whatsapp/netlify/functions/lib-cartes-account-client.mjs`
  - Cliente HTTP firmado con HMAC-SHA256 para Cartes Account.
- `whatsapp/netlify/functions/lib-uso-unificado-cartes.mjs`
  - Adaptador de migración. Usa la cuenta central cuando existe `CARTES_INTERNAL_SECRET`; en caso contrario mantiene el mecanismo local legado.
- `whatsapp/netlify/functions/cartes-whatsapp.mjs`
  - Resuelve usuario central, sincroniza el plan de Mercado Pago y reserva/completa/libera consumo por `user_id`.

## Web

La cuota local de prueba en `localStorage` fue retirada. La identidad Web sigue persistiendo localmente, pero el contador pasa a ser responsabilidad del servidor.
Cada consulta Web genera un `request_id` único.

## Seguridad

La API `cartes-account` no acepta llamadas internas sin firma.
La firma usa:

`HMAC-SHA256(CARTES_INTERNAL_SECRET, timestamp + "." + body)`

La ventana máxima aceptada es de 5 minutos.

Nunca exponer `CARTES_INTERNAL_SECRET` al navegador.

## Compatibilidad

WhatsApp conserva temporalmente el contador local como fallback mientras CORE-003 no esté activado mediante variables de entorno. Esto permite migrar sin cortar el servicio.

## Validación ejecutada

- 5/5 pruebas específicas de CORE-003 pasaron.
- Suite principal V4 del cerebro Web pasó completa.
- Suite WhatsApp ejecutó 50 pruebas correctamente y 6 no pudieron cargar por ausencia de `@netlify/blobs` en el entorno de trabajo.
- Se intentó instalar dependencias, pero el registro interno no dispone de `@parcel/watcher-wasm@2.6.0`; no es un fallo del código de Cartes.
- Todos los archivos modificados/nuevos superaron `node --check`.

## Próximo bloque

CORE-004: vinculación Web + WhatsApp. Permitirá demostrar que una identidad Web existente y un número de WhatsApp pertenecen a la misma persona y asociarlos al mismo `user_id` central mediante un código temporal de verificación.

## Avance de la arquitectura multicanal inicial

CORE-001: completado
CORE-002: completado
CORE-003: completado
CORE-004: pendiente
CORE-005: pendiente
CORE-006: pendiente

Avance: 3 de 6 bloques, 50%.
