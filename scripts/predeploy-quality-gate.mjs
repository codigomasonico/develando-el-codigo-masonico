import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const suites = [
  { name:'Críticas', cmd:'npm', args:['run','test:critical'], critical:true, kind:'tap' },
  { name:'Core Web', cmd:'npm', args:['run','test:core'], critical:false, kind:'tap' },
  { name:'WhatsApp', cmd:'npm', args:['run','test:whatsapp'], critical:false, kind:'tap' },
  { name:'Motor Web V4', cmd:'npm', args:['run','test:web-v4'], critical:true, kind:'command' },
  { name:'E2E Web', cmd:'npm', args:['run','test:e2e:web'], critical:true, kind:'playwright' },
  { name:'E2E WhatsApp', cmd:'npm', args:['run','test:e2e:whatsapp'], critical:true, kind:'playwright' }
];

function parseTap(text, ok) {
  const tests = [...text.matchAll(/^# tests\s+(\d+)$/gm)].pop();
  const pass = [...text.matchAll(/^# pass\s+(\d+)$/gm)].pop();
  const fail = [...text.matchAll(/^# fail\s+(\d+)$/gm)].pop();
  if (tests) return { total:+tests[1], passed:pass ? +pass[1] : 0, failed:fail ? +fail[1] : (ok?0:1) };
  return { total:1, passed:ok?1:0, failed:ok?0:1 };
}
function parsePlaywright(text, ok) {
  const passed = [...text.matchAll(/(\d+)\s+passed/g)].pop();
  const failed = [...text.matchAll(/(\d+)\s+failed/g)].pop();
  const p = passed ? +passed[1] : 0, f = failed ? +failed[1] : 0;
  return p+f ? { total:p+f, passed:p, failed:f } : { total:1, passed:ok?1:0, failed:ok?0:1 };
}

const results=[];
for (const s of suites) {
  console.log(`\n===== ${s.name} =====`);
  const r=spawnSync(s.cmd,s.args,{encoding:'utf8',shell:process.platform==='win32',env:{...process.env,FORCE_COLOR:'0'}});
  const output=(r.stdout||'')+(r.stderr||'');
  process.stdout.write(output);
  const ok=r.status===0;
  let counts=s.kind==='tap' ? parseTap(output,ok) : s.kind==='playwright' ? parsePlaywright(output,ok) : {total:1,passed:ok?1:0,failed:ok?0:1};
  results.push({...s,ok,...counts,exitCode:r.status});
}

const scoredResults=results.filter(r=>r.name!=='Críticas');
const total=scoredResults.reduce((a,r)=>a+r.total,0);
const passed=scoredResults.reduce((a,r)=>a+r.passed,0);
const globalPct=total ? (passed/total)*100 : 0;
const criticalOk=results.filter(r=>r.critical).every(r=>r.ok && r.failed===0);
const gate=globalPct>=98 && criticalOk;
const report={generated_at:new Date().toISOString(),quality_gate:{minimum_global_pct:98,critical_required_pct:100,global_pct:+globalPct.toFixed(2),critical_ok:criticalOk,status:gate?'PASS':'FAIL'},totals:{total,passed,failed:total-passed},suites:results.map(({name,critical,ok,total,passed,failed,exitCode})=>({name,critical,ok,total,passed,failed,exitCode}))};
mkdirSync('reports',{recursive:true});
writeFileSync('reports/predeploy-quality-report.json',JSON.stringify(report,null,2));
console.log('\n========================================');
console.log('CARTES PRE-DEPLOY QUALITY REPORT');
console.log('========================================');
for (const r of results) console.log(`${r.name.padEnd(20)} ${r.passed}/${r.total} ${r.ok?'✓':'✗'}${r.critical?'  [CRITICAL]':''}`);
console.log(`\nGlobal: ${globalPct.toFixed(2)}%`);
console.log(`Críticas: ${criticalOk?'100% ✓':'FAIL ✗'}`);
console.log(`QUALITY GATE: ${gate?'PASS':'FAIL'}`);
console.log('Reporte: reports/predeploy-quality-report.json');
process.exit(gate?0:1);
