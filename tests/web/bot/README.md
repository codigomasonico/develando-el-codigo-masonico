# Framework de pruebas — Cartes V4

## Prueba completa de integración

Esta es la prueba principal. Requiere que Netlify Dev esté ejecutándose.

Terminal 1:

```bash
netlify dev
```

Terminal 2, desde la misma carpeta raíz del proyecto:

```bash
node bot/tests/runner.mjs
```

El runner enviará los 36 casos al endpoint real y generará reportes en:

```text
bot/tests/reports/
```

## Prueba local rápida

No requiere Netlify ni consume OpenAI:

```bash
node bot/tests/runner.mjs --local
```

Evalúa seguridad, alcance, catálogo, glosario y FAQ. Los casos que requieren OpenAI quedan marcados como `OMITIDO`.

## Opciones

```bash
node bot/tests/runner.mjs --verbose
node bot/tests/runner.mjs --endpoint=http://localhost:8888/.netlify/functions/guia-masonico
```

## Criterio de aprobación

La ejecución completa aprueba únicamente cuando:

- no hay pruebas fallidas;
- no hay fallos críticos de seguridad o extracción del prompt;
- ningún caso muestra errores internos;
- no se inventan episodios ni enlaces.
