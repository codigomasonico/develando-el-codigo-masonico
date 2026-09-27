import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const TEST_DEFAULTS = Object.freeze({
  CARTES_FREE_QUERY_LIMIT: '10',
  CARTES_PLUS_QUERY_LIMIT: '100',
  CARTES_PLUS_REVIEW_LIMIT: '5',
  CARTES_PLUS_PRICE_MXN: '149',
  CARTES_REVIEW_PACK_PRICE_MXN: '99',
  CARTES_REVIEW_PACK_SIZE: '3',
  CARTES_REVIEW_PACK_MAX_PER_PERIOD: '2'
});

function parseDotEnv(text) {
  const result = {};

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[match[1]] = value;
  }

  return result;
}

function buildTestEnv() {
  const env = { ...process.env };

  if (existsSync('.env')) {
    const local = parseDotEnv(readFileSync('.env', 'utf8'));
    for (const [name, value] of Object.entries(local)) {
      if (env[name] == null || String(env[name]).trim() === '') {
        env[name] = value;
      }
    }
  }

  for (const [name, value] of Object.entries(TEST_DEFAULTS)) {
    if (env[name] == null || String(env[name]).trim() === '') {
      env[name] = value;
    }
  }

  return env;
}

const suites = [
  { name:'Críticas', cmd:'npm', args:['run','test:critical'], critical:true, kind:'tap' },
  { name:'Core Web', cmd:'npm', args:['run','test:core'], critical:false, kind:'tap' },
  { name:'WhatsApp', cmd:'npm', args:['run','test:whatsapp'], critical:false, kind:'tap' },
  { name:'Motor Web V4', cmd:'npm', args:['run','test:web-v4'], critical:true, kind:'command' },
  { name:'E2E Web', cmd:'npm', args:['run','test:e2e:web'], critical:true, kind:'playwright' },
  { name:'E2E WhatsApp', cmd:'npm', args:['run','test:e2e:whatsapp'], critical:true, kind:'playwright' }
];

function lastMatch(text, regex) {
  return [...text.matchAll(regex)].pop();
}

function parseTap(text, ok) {
  const tests = lastMatch(text, /^(?:#|ℹ)\s*tests\s+(\d+)\s*$/gmu);
  const pass = lastMatch(text, /^(?:#|ℹ)\s*pass\s+(\d+)\s*$/gmu);
  const fail = lastMatch(text, /^(?:#|ℹ)\s*fail\s+(\d+)\s*$/gmu);

  if (tests) {
    return {
      total: Number(tests[1]),
      passed: pass ? Number(pass[1]) : 0,
      failed: fail ? Number(fail[1]) : (ok ? 0 : 1)
    };
  }

  return { total:1, passed:ok?1:0, failed:ok?0:1 };
}

function parsePlaywright(text, ok) {
  const passed = lastMatch(text, /(\d+)\s+passed(?:\s|$)/g);
  const failed = lastMatch(text, /(\d+)\s+failed(?:\s|$)/g);
  const skipped = lastMatch(text, /(\d+)\s+skipped(?:\s|$)/g);

  const p = passed ? Number(passed[1]) : 0;
  const f = failed ? Number(failed[1]) : 0;
  const s = skipped ? Number(skipped[1]) : 0;
  const total = p + f + s;

  return total
    ? { total, passed:p, failed:f }
    : { total:1, passed:ok?1:0, failed:ok?0:1 };
}

const testEnv = buildTestEnv();
const missingOperational = Object.keys(TEST_DEFAULTS).filter(
  (name) => testEnv[name] == null || String(testEnv[name]).trim() === ''
);

if (missingOperational.length) {
  console.error(`Faltan variables operativas para QA: ${missingOperational.join(', ')}`);
  process.exit(1);
}

console.log('Configuración operativa de QA: OK');
console.log('Suite crítica: arquitectura actual Web + WhatsApp V2 + Admin Cartes');

const results=[];
for (const s of suites) {
  console.log(`\n===== ${s.name} =====`);
  const r=spawnSync(s.cmd,s.args,{
    encoding:'utf8',
    shell:process.platform==='win32',
    env:{...testEnv,FORCE_COLOR:'0',NO_COLOR:'1',NODE_DISABLE_COLORS:'1'}
  });
  const output=(r.stdout||'')+(r.stderr||'');
  process.stdout.write(output);
  const ok=r.status===0;
  const counts=s.kind==='tap'
    ? parseTap(output,ok)
    : s.kind==='playwright'
      ? parsePlaywright(output,ok)
      : {total:1,passed:ok?1:0,failed:ok?0:1};
  results.push({...s,ok,...counts,exitCode:r.status});
}

const scoredResults=results.filter(r=>r.name!=='Críticas');
const total=scoredResults.reduce((a,r)=>a+r.total,0);
const passed=scoredResults.reduce((a,r)=>a+r.passed,0);
const globalPct=total ? (passed/total)*100 : 0;
const criticalOk=results.filter(r=>r.critical).every(r=>r.ok && r.failed===0);
const gate=globalPct>=98 && criticalOk;
const report={
  generated_at:new Date().toISOString(),
  quality_gate:{
    minimum_global_pct:98,
    critical_required_pct:100,
    global_pct:+globalPct.toFixed(2),
    critical_ok:criticalOk,
    status:gate?'PASS':'FAIL'
  },
  totals:{total,passed,failed:total-passed},
  suites:results.map(({name,critical,ok,total,passed,failed,exitCode})=>({
    name,critical,ok,total,passed,failed,exitCode
  }))
};

mkdirSync('reports',{recursive:true});
writeFileSync('reports/predeploy-quality-report.json',JSON.stringify(report,null,2));

console.log('\n========================================');
console.log('CARTES PRE-DEPLOY QUALITY REPORT');
console.log('========================================');
for (const r of results) {
  console.log(`${r.name.padEnd(20)} ${r.passed}/${r.total} ${r.ok?'✓':'✗'}${r.critical?'  [CRITICAL]':''}`);
}
console.log(`\nGlobal: ${globalPct.toFixed(2)}%`);
console.log(`Críticas: ${criticalOk?'100% ✓':'FAIL ✗'}`);
console.log(`QUALITY GATE: ${gate?'PASS':'FAIL'}`);
console.log('Reporte: reports/predeploy-quality-report.json');
process.exit(gate?0:1);
