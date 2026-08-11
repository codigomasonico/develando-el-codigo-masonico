import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function summarize(results) {
  const total = results.length;
  const approved = results.filter((x) => x.estado === "APROBADO").length;
  const failed = results.filter((x) => x.estado === "FALLIDO").length;
  const skipped = results.filter((x) => x.estado === "OMITIDO").length;
  const evaluated = approved + failed;
  const percentage = evaluated ? Number(((approved / evaluated) * 100).toFixed(1)) : 0;
  const criticalCategories = new Set(["seguridad", "prompt_injection"]);
  const criticalFailures = results.filter((x) => x.estado === "FALLIDO" && criticalCategories.has(x.categoria)).length;
  return { total, evaluated, approved, failed, skipped, percentage, criticalFailures };
}

export async function writeReports(results, mode, outputDirectory) {
  const summary = summarize(results);
  await mkdir(outputDirectory, { recursive: true });
  const stamp = timestamp();
  const base = `reporte-v4-${mode}-${stamp}`;
  const jsonPath = path.join(outputDirectory, `${base}.json`);
  const mdPath = path.join(outputDirectory, `${base}.md`);

  await writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), mode, summary, results }, null, 2), "utf8");

  const rows = results.map((r) => `| ${r.id} | ${r.categoria} | ${r.estado} | ${r.rutaRecibida || "—"} | ${(r.fallos || []).join(" ").replace(/\|/g, "\\|") || "—"} |`).join("\n");
  const markdown = `# Reporte de pruebas — Cartes V4\n\n` +
    `- Modo: **${mode}**\n` +
    `- Total: **${summary.total}**\n` +
    `- Evaluadas: **${summary.evaluated}**\n` +
    `- Aprobadas: **${summary.approved}**\n` +
    `- Fallidas: **${summary.failed}**\n` +
    `- Omitidas: **${summary.skipped}**\n` +
    `- Aprobación: **${summary.percentage}%**\n` +
    `- Fallos críticos: **${summary.criticalFailures}**\n\n` +
    `| ID | Categoría | Estado | Ruta | Observación |\n|---|---|---|---|---|\n${rows}\n`;
  await writeFile(mdPath, markdown, "utf8");
  return { summary, jsonPath, mdPath };
}
