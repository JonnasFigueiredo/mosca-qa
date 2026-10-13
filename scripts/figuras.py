"""Figuras reproduzíveis da publicação, a partir das medições versionadas.

Uso: .venv/Scripts/python.exe -X utf8 scripts/figuras.py
Dependência: matplotlib. Não baixa dados nem altera as medições originais.
"""
import json
import os
import re
from pathlib import Path
from statistics import mean

RAIZ = Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR', str(RAIZ / '_tmp' / 'matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

DADOS = RAIZ / 'docs' / 'medicoes'
SAIDA = RAIZ / 'docs' / 'publicacao' / 'figuras'
CONDICOES = ['ativa', 'congelada', 'aleatoria', 'novidade']
CORES = ['#168579', '#68768a', '#d58a31', '#7163a9']


def ler(caminho):
    return json.loads(caminho.read_text(encoding='utf-8'))


def bootstrap(valores):
    """Mesmo LCG, 2000 reamostragens e percentis de qa_resumo.mjs."""
    estado = 982451653
    medias = []
    for _ in range(2000):
        soma = 0
        for _ in valores:
            estado = (estado * 1664525 + 1013904223) & 0xffffffff
            soma += valores[int(estado / 4294967296 * len(valores))]
        medias.append(soma / len(valores))
    medias.sort()
    return [medias[49], medias[1949]]


def conferir(obtido, esperado, contexto):
    if abs(obtido - esperado) > 0.0051:
        raise ValueError(f'{contexto}: {obtido} difere do resumo {esperado}')


def serie(prefixo):
    resumo = ler(DADOS / f'{prefixo}-resumo.json')
    arquivos = sorted(p for p in DADOS.iterdir()
                      if re.fullmatch(re.escape(prefixo) + r'(-p\d+)?\.json', p.name))
    rodadas = {}
    for arquivo in arquivos:
        for rodada in ler(arquivo)['rodadas']:
            rodadas[rodada['semente'], rodada['condicao']] = rodada
    valores = {}
    for condicao in CONDICOES:
        valores[condicao] = []
        for semente in resumo['sementes']:
            r = rodadas[semente, condicao]
            # Reconstrói as duas versões de transferência, sem incluir o controle.
            passos = [bugs[0]['passo'] if bugs else r['orcamento'] + 1
                      for versao, bugs in zip(r['teste_versoes'], r['teste'])
                      if versao in ('cupom-duplo', 'reserva-dupla')]
            if len(passos) != 2:
                raise ValueError('Esperadas duas versões de transferência por rodada')
            valor = mean(passos)
            conferir(valor, r['resumo_b2']['primeiro_bug_transferencia'], 'rodada')
            valores[condicao].append(valor)
        conferir(mean(valores[condicao]), resumo['por_condicao'][condicao]['transferencia_media'], condicao)
        assert len(valores[condicao]) == resumo['por_condicao'][condicao]['sementes']
    diferencas = [a-b for a,b in zip(valores['ativa'], valores['congelada'])]
    par = resumo['pares']['ativa_menos_congelada']['transferencia']
    conferir(mean(diferencas), par['media'], 'diferença pareada')
    for a,b in zip(bootstrap(diferencas), par['ic95']):
        conferir(a,b,'IC95 pareado')
    return {'fontes': [p.name for p in arquivos] + [f'{prefixo}-resumo.json'],
            'sementes': resumo['sementes'], 'diferenca_pareada': par,
            'condicoes': {c: {'media': mean(v), 'ic95': bootstrap(v), 'por_semente': v}
                          for c,v in valores.items()}}


def desenhar(series, idioma):
    en = idioma == 'en'
    nomes = ['Trained', 'Frozen', 'Random', 'Novelty'] if en else ['Treinada', 'Congelada', 'Aleatória', 'Novidade']
    titulos = ['Main series', 'Replication'] if en else ['Série principal', 'Replicação']
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 12, 'axes.spines.top': False,
                         'axes.spines.right': False, 'axes.spines.left': False})
    fig, eixos = plt.subplots(1, 2, figsize=(12, 6.8), sharey=True)
    fig.patch.set_facecolor('#fafbf9')
    for ax, dados, titulo in zip(eixos, series, titulos):
        ax.set_facecolor('#fafbf9')
        medias = [dados['condicoes'][c]['media'] for c in CONDICOES]
        ic = [dados['condicoes'][c]['ic95'] for c in CONDICOES]
        erros = [[m-v[0] for m,v in zip(medias,ic)], [v[1]-m for m,v in zip(medias,ic)]]
        ax.bar(range(4), medias, color=CORES, width=.62, zorder=3,
               yerr=erros, capsize=5, error_kw={'ecolor':'#253340','elinewidth':1.4})
        ax.set_xticks(range(4), nomes)
        ax.set_ylim(0, 24)
        ax.set_yticks(range(0,25,5))
        ax.grid(axis='y', color='#dee4e5', zorder=0)
        ax.tick_params(axis='both', length=0)
        ax.set_title(titulo + ' · n = 16', loc='left', fontsize=15, weight='bold', pad=18)
        for i,m in enumerate(medias):
            texto = f'{m:.1f}' if en else f'{m:.1f}'.replace('.', ',')
            ax.text(i, .65, texto, color='white', ha='center', fontsize=13, weight='bold')
        par=dados['diferenca_pareada']
        texto = (f"Trained − frozen: {par['media']:.2f} actions\nPaired 95% CI [{par['ic95'][0]:.2f}; {par['ic95'][1]:.2f}]" if en else
                 f"Treinada − congelada: {par['media']:.2f} ações\nIC95 pareado [{par['ic95'][0]:.2f}; {par['ic95'][1]:.2f}]".replace('.', ','))
        ax.text(.02, .94, texto, transform=ax.transAxes, va='top', fontsize=11, color='#263947')
    eixos[0].set_ylabel('Actions until the first bug ↓' if en else 'Ações até o primeiro defeito ↓', labelpad=12)
    fig.suptitle('Learning transfers to new action families' if en else 'O aprendizado transfere para famílias novas',
                 x=.075, ha='left', y=.97, fontsize=21, weight='bold', color='#163b44')
    fig.text(.075,.885, 'Brain without a body · Defects of the rewarded type · Lower is better' if en else
             'Cérebro sem corpo · Defeitos do tipo recompensado · Menor é melhor', color='#53636b')
    rodape = ('Bars: means across seeds; whiskers: 95% bootstrap CI (2,000 resamples).\nMean of coupon and stock tests; 31 actions if no bug was found within 30.\nSources: qa-b2 and qa-b2-replica. The different-type control is excluded.' if en else
              'Barras: médias entre sementes; hastes: IC95 bootstrap (2.000 reamostragens).\nMédia dos testes de cupom e estoque; 31 ações quando nenhum defeito foi encontrado em 30.\nFontes: qa-b2 e qa-b2-replica. O controle de outro tipo de defeito não entra neste gráfico.')
    fig.text(.075,.04,rodape,fontsize=10,color='#53636b',linespacing=1.5)
    fig.subplots_adjust(left=.075,right=.985,top=.79,bottom=.24,wspace=.14)
    destino=SAIDA / ('resultado-principal' + ('.en' if en else '') + '.png')
    fig.savefig(destino,dpi=240,facecolor=fig.get_facecolor())
    plt.close(fig)
    print(destino)


def main():
    SAIDA.mkdir(parents=True,exist_ok=True)
    series=[serie('qa-b2'),serie('qa-b2-replica')]
    for idioma in ('pt','en'):
        desenhar(series,idioma)
    registro={'metodo':'Médias por semente nas duas versões de transferência; bootstrap percentil das sementes, 2000 reamostragens, LCG e índices iguais a scripts/qa_resumo.mjs. Médias e IC95 pareados conferidos com resumos originais; os IC95 individuais das barras são calculados dos dados brutos. Sem achado em 30 ações = 31.', 'series':series}
    (DADOS/'figuras-resultado-principal.json').write_text(json.dumps(registro,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Médias e IC95 pareados conferidos com os dois resumos.')

if __name__ == '__main__':
    main()
