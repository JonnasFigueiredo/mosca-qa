// Roda uma campanha de treino pela linha de comando, usando o gerenciador (scripts/experimentos.mjs).
// Sobe o gerenciador na porta 8770 se ele não estiver no ar, cria o lote, inicia, mostra o progresso e o resumo.
//
//   node scripts/campanha.mjs --nome piloto-A --sementes 101,202,303,404,505 --variante padrao
//        [--repeticoes 3] [--segundos 15] [--retencao 0] [--paralelas 2] [--limite 20] [--memoria 3] [--porta 8770]
//   --retencoes 60,180: um lote com uma variante por intervalo de retenção (ret60, ret180), além de --variante
//   (T2 de docs/plano-treino-robusto.md). --ponte mbon: a ponte memória -> movimento pelas saídas do corpo cogumelar. --repeticoes-lista 1,6: idem, uma variante por número de repetições (rep1, rep6)
//
// Os resultados ficam em docs/medicoes/lotes/<id>/ (resumo.json, resultados.csv, eventos.ndjson).
// Interromper este script não para o gerenciador: o lote continua, e a interface em http://127.0.0.1:8770 mostra.
import { spawn } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const porta = +arg('porta', 8770), url = `http://127.0.0.1:${porta}`;
const dormir = ms => new Promise(r => setTimeout(r, ms));
const config = {
  nome: arg('nome', 'Campanha'),
  sementes: arg('sementes', '101,202,303,404,505').split(',').map(Number),
  variantes: (() => {
    const base = { repeticoes: +arg('repeticoes', 3), segundos: +arg('segundos', 15), retencao: +arg('retencao', 0), ponte: arg('ponte', 'sinapses') };
    const lista = (k, campo, prefixo) => (arg(k, '') ? arg(k).split(',').map(v => ({ ...base, nome: prefixo + v, [campo]: +v })) : null);
    return lista('retencoes', 'retencao', 'ret') || lista('repeticoes-lista', 'repeticoes', 'rep') || [{ ...base, nome: arg('variante', 'padrao') }];
  })(),
  paralelas: +arg('paralelas', 2), limiteMinutos: +arg('limite', 20), tentativas: 2, memoriaMinGB: +arg('memoria', 3),
};
let token;
async function api(p, dados) {
  const r = await fetch(url + p, dados === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-mosca-token': token }, body: JSON.stringify(dados) });
  const j = await r.json(); if (!r.ok) throw Error(j.erro || r.status); return j;
}
async function gerenciador() {
  try { token = (await api('/api/estado')).token; return; } catch { /* não está no ar */ }
  const p = spawn(process.execPath, ['scripts/experimentos.mjs', '--porta', String(porta)], { detached: true, stdio: 'ignore', windowsHide: true });
  p.unref();
  for (let i = 0; i < 60; i++) { await dormir(500); try { token = (await api('/api/estado')).token; console.log(`gerenciador iniciado em ${url}`); return; } catch { } }
  throw Error('o gerenciador não abriu');
}
await gerenciador();
const lote = await api('/api/lotes', config);
console.log(`lote ${lote.id}: ${lote.jobs.length} sessões (${config.sementes.length} sementes x ${config.variantes.length} variante(s) x A/B x ativa/congelada)`);
await api(`/api/lotes/${lote.id}/acao`, { acao: 'retomar' });
let estado, ultimo = '';
do {
  await dormir(15000);
  estado = await api(`/api/lotes/${lote.id}`);
  const n = s => estado.jobs.filter(j => j.status === s).length;
  const linha = `${new Date().toLocaleTimeString('pt-BR')} ${estado.status}: ${n('concluida')} concluídas, ${n('rodando')} rodando, ${n('falhou')} falharam, ${n('pendente')} pendentes`;
  const chave = linha.slice(linha.indexOf(' ')); if (chave !== ultimo) { console.log(linha); ultimo = chave; }
} while (estado.status === 'rodando');
const resumo = await (await fetch(`${url}/arquivos/${lote.id}/resumo.json`)).json();
for (const par of resumo.pares) console.log(`\n${par.variante}: diferença pareada (ativa - congelada) = ${par.diferencaMedia?.toFixed(3)}, IC95 = ${JSON.stringify(par.intervalo95)}, sementes completas ${par.sementesCompletas}/${par.sementesTotal}`);
for (const g of resumo.grupos) console.log(`  ${g.condicao}: ganho médio ${g.ganho?.toFixed(3)}, preferências ${JSON.stringify(g.preferencias.map(v => v == null ? null : +v.toFixed(2)))}, sem escolha ${JSON.stringify(g.semEscolha)}`);
console.log(`\nresultados em docs/medicoes/lotes/${lote.id}/`);
