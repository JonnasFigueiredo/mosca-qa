import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const Q = createRequire(import.meta.url)('../web/qa/pedidos.js');
const o = JSON.parse(readFileSync('docs/medicoes/qa-curiosidade-oraculo.json', 'utf8'));
const VAL = o.valencias.treinada, T = 0.15, RUIDO = 0.15, H = 2.5;
const g = s => () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const sm = (x, r) => { const e = x.map(v => Math.exp(v / T)), t = e.reduce((a, b) => a + b, 0); let u = r() * t, k = 0; while (k < e.length - 1 && (u -= e[k]) > 0) k++; return k; };
const cur = (op, r, n) => op[sm(op.map(a => VAL[a.id] + RUIDO * gauss(r) - H * (n[a.id] || 0)), r)];
const nov = (op, r, n) => { const m = Math.min(...op.map(a => n[a.id] || 0)); const c = op.filter(a => (n[a.id] || 0) === m); return c[Math.floor(r() * c.length)]; };
const vis = r => Array.from({ length: 30 }, () => { const ids = [...Q.ACOES]; for (let k = 14; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; } return ids.slice(0, 3); });
const ep = (d, v, f, r) => { const s = Q.criar(d, { bancada: 2 }), n = {}; for (let p = 0; p < 30; p++) { const a = f(v[p], r, n); n[a.id] = (n[a.id] || 0) + 1; s.executar(a.id); if (Q.verificar(s).length) return p + 1; } return 31; };
for (const K of [1, 2, 3]) for (const NS of [16, 24]) {
  let sup = 0, ni = 0; const REP = 400;
  for (let x = 0; x < REP; x++) {
    const dif = [];
    for (let s = 0; s < NS; s++) { let a = 0, b = 0, c = 0; for (const d of Q.VERSOES2.teste) for (let k = 0; k < K; k++) { const seed = (x * 1000 + s) * 10 + k; const v = vis(g(seed * 7 + d[0].length)); a += ep(d, v, cur, g(seed * 3 + 1)); b += ep(d, v, nov, g(seed * 3 + 2)); c++; } dif.push((a - b) / c); }
    const rr = g(x + 9), bs = []; for (let k = 0; k < 1000; k++) { let t = 0; for (let i = 0; i < NS; i++) t += dif[Math.floor(rr() * NS)]; bs.push(t / NS); } bs.sort((p, q) => p - q);
    if (bs[974] < 0) sup++; if (bs[974] < 1.5) ni++;
  }
  console.log('repeticoes', K, 'sementes', NS, 'poder superioridade', (sup / REP).toFixed(2), 'nao-inferioridade(+1,5)', (ni / REP).toFixed(2));
}
