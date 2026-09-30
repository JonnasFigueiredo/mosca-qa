// Recalcula o resumo de um lote do gerenciador com a análise atual (scripts/experimentos/core.mjs), sem rodar nada.
//   node scripts/resumir_lote.mjs <id do lote>
import { readFileSync, writeFileSync } from 'node:fs';
import { medir, resumir } from './experimentos/core.mjs';
const id = process.argv[2], pasta = 'docs/medicoes/lotes/' + id;
const l = JSON.parse(readFileSync(pasta + '/estado.json', 'utf8'));
for (const j of l.jobs) if (j.status === 'concluida') { const dado = JSON.parse(readFileSync(`${pasta}/resultados/${j.id}.json`, 'utf8')); j.metricas = medir(dado.relatorio, j.alvo); }
const r = resumir(l.jobs);
writeFileSync(pasta + '/resumo.json', JSON.stringify(r, null, 2) + '\n');
for (const p of r.pares) console.log(`${l.config?.nome || id} / ${p.variante}: DEPOIS (principal) dif ${p.depois.diferencaMedia?.toFixed(3)} IC95 ${JSON.stringify(p.depois.intervalo95?.map(v => +v.toFixed(3)))} sementes ${p.depois.sementesCompletas}/${p.sementesTotal} | ganho dif ${p.diferencaMedia?.toFixed(3)} (${p.sementesCompletas} sementes)`);
