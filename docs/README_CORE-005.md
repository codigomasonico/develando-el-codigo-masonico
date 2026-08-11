# Cartes CORE-005 - Suscripción y cuenta única

## Objetivo
Hacer que Cartes Plus pertenezca al `user_id` central de Cartes y no al canal o al número telefónico.

## Implementado
- Registro central de suscripción por `user_id` (`subscription-v1`).
- Nuevas operaciones internas `subscription_sync` y `subscription_get` en Cartes Account.
- Mercado Pago incorpora `user_id` en la referencia de nuevas altas de Cartes Plus cuando está disponible.
- El webhook de Mercado Pago sincroniza estado, renovación y cancelación con Cartes Account.
- WhatsApp guarda también un índice de suscripción por `user_id`, conservando el índice legacy por teléfono.
- WhatsApp consulta primero por `user_id` y usa teléfono como compatibilidad con usuarios existentes.
- La cuenta central es la fuente de verdad del plan cuando CORE-003/005 está habilitado.
- Un registro local gratuito no puede degradar accidentalmente una cuenta central Plus.
- La cancelación de renovación conserva Plus hasta `access_until`.
- La vinculación CORE-004 conserva y fusiona la suscripción al consolidar identidades.

## Compatibilidad
No se eliminan claves antiguas de Mercado Pago ni registros por teléfono. Esto permite migración gradual sin invalidar suscripciones existentes.

## Despliegue
NO desplegar todavía. CORE-005 sigue siendo una etapa de integración previa a la consolidación final del proyecto.

## Variables compartidas
`CARTES_INTERNAL_SECRET` debe coincidir en Web y WhatsApp.
`CARTES_ACCOUNT_API_URL` en WhatsApp debe apuntar al endpoint central `cartes-account`.

## Pruebas CORE-003/004/005
16/16 pruebas específicas superadas.
Suite V4 del motor Web superada.
