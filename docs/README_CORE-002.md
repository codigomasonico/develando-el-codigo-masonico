# Cartes CORE-002 - Identidad unificada

## Estado

CORE-002 introduce una identidad interna estable para Cartes sin cambiar todavía planes, cobros ni límites productivos.

## Estructura de trabajo

- `web/`: interfaz Web y Cartes Core actual.
- `whatsapp/`: interfaz WhatsApp, pagos, uso, documentos y servicios operativos.

Esta carpeta única es el workspace de transición hacia el proyecto completamente unificado. Todavía NO debe desplegarse como un solo sitio en producción.

## Cambios principales

### WhatsApp

Se añadió `netlify/functions/lib-identidad-cartes.mjs`.

Cada WhatsApp puede resolverse a un identificador interno estable:

`usr_<uuid>`

El registro permite asociar varias identidades al mismo usuario y evita que una identidad quede vinculada a dos usuarios distintos.

La consulta al cerebro ahora transmite:

- `channel`
- `external_user_id`
- `user_id`
- `request_id`

### Web

`bot/guia-masonico.js` crea una identidad anónima persistente del navegador:

`web_<uuid>`

La envía al Core como `client.external_user_id` con `channel: web`.

No hay login todavía y no se centralizó aún el saldo. El límite Web actual se conserva sin cambios en CORE-002.

## Compatibilidad

CORE-002 NO modifica:

- 5 consultas gratuitas de WhatsApp.
- 50 consultas de Cartes Plus.
- Mercado Pago.
- Revisiones DOCX.
- Consentimientos legales.
- Menús y textos aprobados.
- Endpoint público actual de Cartes Core.

## Pruebas

Pruebas nuevas de identidad: 4/4 OK.
Contrato Cartes Core client: 1/1 OK.
Pruebas V4 principales del motor Web: OK.

La batería completa de WhatsApp no puede ejecutarse en este entorno sin instalar `@netlify/blobs`; las pruebas que no dependen de esa librería continúan pasando. El nuevo módulo de identidad usa carga dinámica para permitir sus pruebas unitarias con almacenamiento en memoria.

## Próximo paso

CORE-003 centralizará planes y consumo bajo `user_id`, manteniendo compatibilidad temporal con los registros históricos por teléfono. Ese será el paso que permitirá que Web y WhatsApp comiencen a compartir realmente el mismo saldo.
