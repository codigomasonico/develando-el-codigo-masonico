CARTES WEB - CORRECCIÓN DEL CONTADOR DE CONSULTAS
Fecha: 2026-08-11

ARCHIVO A REEMPLAZAR
channels\web\public\bot\guia-masonico.js

DEFECTO CORREGIDO
El encabezado podía permanecer en:
Consultas disponibles: …

CAUSA EN EL CLIENTE
1. El estado de uso se solicitaba principalmente al abrir Cartes.
2. Si la primera llamada de estado fallaba, no existía reintento.
3. La sincronización de conversación no aprovechaba usage si el backend lo devolvía.
4. El placeholder podía quedar visible indefinidamente.

CAMBIOS
- Consulta de estado inmediatamente al cargar Cartes.
- Reintentos acotados del endpoint cartes-link.
- cache: no-store en consultas de estado.
- Aprovecha usage devuelto por cartes-conversation.
- Actualiza usage también en el flujo de vinculación.
- El encabezado muestra explícitamente:
  Consultas disponibles: X de Y
- Si el backend no devuelve uso válido después de los reintentos, no deja "…":
  muestra "Consultas disponibles: no disponibles" y conserva el detalle del error en title.
- La siguiente apertura o consulta vuelve a intentar sincronizar.

IMPORTANTE
Este ZIP modifica únicamente el cliente Web relacionado con el contador.
No modifica Core, WhatsApp, pagos, HTML general, CSS ni configuración Netlify.
