# Cartes unificado - Quality Gate pre-deploy

## Criterio aprobado

- Calidad global mínima: 98%.
- Pruebas críticas: 100% aprobadas.
- Smoke tests del deploy draft: 100% aprobados antes de producción.
- Defectos críticos o altos abiertos: 0.
- El máximo 2% residual sólo puede corresponder a defectos menores, conocidos y documentados, sin impacto en seguridad, dinero, datos, límites de uso o experiencia principal.

## Preparación local

```bash
npm install
npx playwright install chromium
```

## Ejecución

Pruebas críticas:

```bash
npm run test:critical
```

E2E:

```bash
npm run test:e2e
```

Quality Gate local completo:

```bash
npm run test:predeploy
```

El reporte se genera en `reports/predeploy-quality-report.json`.

## Interpretación

`QUALITY GATE: PASS` habilita el paso a deploy draft, no a producción. La promoción a producción requiere además 100% del smoke test del draft y cero defectos críticos/altos.
