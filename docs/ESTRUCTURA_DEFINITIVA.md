# Cartes - Estructura definitiva

Fecha de consolidación: 8 de agosto de 2026.

## Resultado

Cartes dejó de estar organizado como dos proyectos independientes (`web` y `web-cartes-whatsapp`). La base maestra contiene un solo proyecto, una sola configuración Netlify y una sola definición de dependencias.

## Estructura

```text
Cartes/
├── core/
│   ├── ai/
│   └── knowledge/
├── api/
├── channels/
│   ├── web/
│   │   └── public/
│   └── whatsapp/
│       ├── functions/
│       ├── tools/
│       └── e2e/
├── netlify/
│   └── functions/
├── tests/
│   ├── web/
│   └── whatsapp/
├── docs/
├── package.json
├── netlify.toml
└── .env.example
```

## Responsabilidades

- `core/ai`: cerebro, cuentas, consumo, identidad, suscripción, vinculación y memoria.
- `core/knowledge`: conocimiento local del motor masónico.
- `api`: contratos HTTP que exponen el Core.
- `channels/web/public`: sitio Web y cliente Web.
- `channels/whatsapp/functions`: lógica específica de WhatsApp, Mercado Pago, documentos y menús.
- `netlify/functions`: únicos entrypoints que Netlify despliega.
- `tests`: pruebas organizadas por canal y Core.

## Rutas unificadas

- Web: `/`
- Cartes API: `/.netlify/functions/guia-masonico`
- Cartes Account: `/.netlify/functions/cartes-account`
- Vinculación: `/.netlify/functions/cartes-link`
- Conversación: `/.netlify/functions/cartes-conversation`
- WhatsApp webhook: `/.netlify/functions/cartes-whatsapp`
- Mercado Pago: `/.netlify/functions/mercadopago-*`
- Acceso a WhatsApp: `/cartes-whatsapp`
- Términos: `/cartes-whatsapp/terminos.html`
- Privacidad: `/cartes-whatsapp/privacy.html`
- Retorno de suscripción: `/cartes-whatsapp/suscripcion.html`

## Validación de consolidación

- `package.json`: 1
- `netlify.toml`: 1
- `.env.example`: 1
- entrypoints Netlify: 9
- pruebas Core CORE-003 a CORE-006: 12/12
- pruebas V4: correctas
- pruebas WhatsApp ejecutables: 54/54
- sintaxis de módulos: correcta

Las pruebas que dependen de `@netlify/blobs` requieren instalar las dependencias. En el entorno de construcción usado para esta consolidación el registro de paquetes devuelve 404 para `@netlify/blobs`, por lo que no fue posible ejecutar esas pruebas adicionales aquí. La dependencia permanece declarada en `package.json` para el entorno real de despliegue.

## Estado

Esta carpeta es la nueva base maestra de desarrollo. No sustituir producción hasta completar la validación integral de despliegue y la migración controlada de variables, webhook de Meta y Mercado Pago.
