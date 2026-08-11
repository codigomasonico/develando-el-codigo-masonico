# Cartes CORE-006 — Conversación y memoria multicanal

## Objetivo
Centralizar el contexto conversacional por `user_id` para que Web y WhatsApp compartan memoria únicamente cuando pertenecen a la misma cuenta de Cartes.

## Reglas
- Sin vinculación, Web y WhatsApp mantienen memorias independientes.
- Con vinculación, ambas interfaces usan el mismo historial central.
- La memoria reside en Netlify Blobs dentro del store `cartes-core`.
- Se conservan como máximo 20 mensajes (10 intercambios usuario/asistente) por usuario.
- Cada intercambio registra el canal y `request_id` para evitar duplicados.
- Al vincular dos identidades, sus memorias previas se fusionan cronológicamente.
- `Limpiar conversación` desde Web limpia la memoria central asociada al `user_id`.
- El historial local del navegador queda solamente como respaldo/migración suave, no como fuente principal del contexto.

## Flujo
Web o WhatsApp → `guia-masonico` → resolver `user_id` → cargar memoria central → Cartes Core → guardar pregunta/respuesta → devolver respuesta.

## Archivos principales
- `web/bot/functions/lib-cartes-account.mjs`: almacenamiento y fusión de memoria.
- `web/bot/functions/guia-masonico.mjs`: carga/guarda memoria alrededor del cerebro central.
- `web/bot/functions/cartes-conversation.mjs`: lectura y limpieza de memoria desde Web.
- `web/bot/guia-masonico.js`: sincroniza visualmente el historial central.
- `web/test/account-core006.test.mjs`: pruebas de aislamiento, deduplicación, limpieza y fusión.

## Estado
CORE-006 completo. No desplegar todavía hasta realizar la fase de consolidación y despliegue controlado del proyecto unificado.
