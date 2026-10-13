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
import matplotlib.text
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


def conferir_texto(fig, limites=()):
    """Falha se algum texto sair da figura ou de uma caixa declarada (x0, y0, x1, y1 em dados).

    Evita o erro mais comum destas figuras: legenda que vaza do contorno ou do canvas.
    """
    fig.canvas.draw()
    figura = fig.bbox
    for texto in fig.findobj(matplotlib.text.Text):
        if not texto.get_text().strip() or not texto.get_visible():
            continue
        caixa = texto.get_window_extent(fig.canvas.get_renderer())
        if (caixa.x0 < -1 or caixa.y0 < -1 or caixa.x1 > figura.x1 + 1 or caixa.y1 > figura.y1 + 1):
            raise ValueError(f'texto fora da figura: {texto.get_text()[:60]!r}')
    for eixo, x0, y0, x1, y1, conteudo in limites:
        for texto in conteudo:
            caixa = texto.get_window_extent(fig.canvas.get_renderer())
            px0, py0 = eixo.transData.transform((x0, y0))
            px1, py1 = eixo.transData.transform((x1, y1))
            if caixa.x0 < px0 - 1 or caixa.x1 > px1 + 1 or caixa.y0 < py0 - 1 or caixa.y1 > py1 + 1:
                raise ValueError(f'texto fora da caixa: {texto.get_text()[:60]!r}')


def desenhar_protocolo(idioma):
    """Figura 2: o protocolo. Treino e teste só se ligam pela característica premiada."""
    en = idioma == 'en'
    from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 12})
    fig, ax = plt.subplots(figsize=(11.4, 5.4))
    fig.patch.set_facecolor('#fafbf9')
    ax.set_facecolor('#fafbf9')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 45.5)
    ax.axis('off')

    def caixa(x, y, l, a, cor, fundo):
        ax.add_patch(FancyBboxPatch((x, y), l, a, boxstyle='round,pad=0,rounding_size=1.4',
                                    facecolor=fundo, edgecolor=cor, linewidth=1.8, zorder=2))

    dentro = []

    def bloco(x, titulo, subtitulo, familias, nota, cor, fundo):
        caixa(x, 12, 37, 30, cor, fundo)
        textos = [ax.text(x + 2.6, 38.6, titulo, fontsize=15, weight='bold', color=cor, va='top'),
                  ax.text(x + 2.6, 34.6, subtitulo, fontsize=10.5, color='#53636b', va='top',
                          linespacing=1.45)]
        for i, (familia, acao, destaque) in enumerate(familias):
            y = 29.6 - i * 5.2
            ax.add_patch(FancyBboxPatch((x + 2.6, y - 3.5), 31.8, 4.4,
                                        boxstyle='round,pad=0,rounding_size=.9',
                                        facecolor='#ffffff', edgecolor='#d9e0e2', linewidth=1, zorder=3))
            textos.append(ax.text(x + 4.2, y - 1.3, familia, fontsize=11, color='#263947', va='center', zorder=4))
            textos.append(ax.text(x + 34.0, y - 1.3, acao, fontsize=10.5, weight='bold',
                          color=CORES[0] if destaque else CORES[1], ha='right', va='center', zorder=4))
        textos.append(ax.text(x + 2.6, 13.3, nota, fontsize=10, color='#53636b', va='bottom'))
        dentro.append((ax, x + 1.2, 12, x + 35.8, 42, textos))

    reps = 'repeated' if en else 'repetida'
    bloco(3, 'TREINO' if not en else 'TRAINING',
          ('6 versions × 20 trials\nNew bug = sugar + dopamine' if en else
           '6 versões × 20 tentativas\nBug novo = açúcar + dopamina'),
          [('Payment' if en else 'Pagamento', reps, True), ('Cancellation' if en else 'Cancelamento', reps, True)],
          'Learns: this feature means bugs' if en else 'Aprende: essa característica dá bug',
          CORES[0], '#eef5f3')
    bloco(60, 'TESTE' if not en else 'TEST',
          ('3 new versions\nNo reward' if en else '3 versões novas\nSem recompensa'),
          [('Coupon' if en else 'Cupom', reps, True), ('Stock' if en else 'Estoque', reps, True),
           ('Quantity' if en else 'Quantidade', 'negative' if en else 'negativa', False)],
          ('Transfer · the third is the control' if en else
           'Transferência · a terceira é o controle'),
          '#2f5d70', '#eef2f5')

    ax.add_patch(FancyArrowPatch((40.4, 27), (58.6, 27), arrowstyle='-|>', mutation_scale=26,
                                 linewidth=2.2, color='#8b979d', zorder=3))
    ax.text(49.5, 29.6, 'Families it has never seen' if en else 'Famílias que ela nunca viu',
            fontsize=11, color='#53636b', ha='center')
    ax.add_patch(FancyBboxPatch((16, 3.2), 68, 6.4, boxstyle='round,pad=0,rounding_size=1.3',
                                facecolor='#fdf3e6', edgecolor=CORES[2], linewidth=1.6, zorder=2))
    elo = ax.text(50, 6.4, ('The only link: the "repeated" feature — the same odor'
                            if en else 'O único elo: a característica "repetida" — o mesmo cheiro'),
                  fontsize=12, weight='bold', color='#8a5312', ha='center', va='center', zorder=4)
    dentro.append((ax, 17, 3.2, 83, 9.6, [elo]))
    for x in (21.5, 78.5):
        ax.plot([x, x], [9.6, 12], color=CORES[2], lw=1.6, ls=(0, (3, 3)), zorder=1)

    fig.suptitle('Training and test share only one feature' if en else
                 'Treino e teste só compartilham uma característica',
                 x=.028, ha='left', y=.965, fontsize=19, weight='bold', color='#163b44')
    fig.text(.028, .875, ('Orders system · each action is an odor: family + input' if en else
                          'Sistema de Pedidos · cada ação é um cheiro: família + entrada'), color='#53636b')
    fig.subplots_adjust(left=.02, right=.98, top=.845, bottom=.02)
    conferir_texto(fig, dentro)
    destino = SAIDA / ('protocolo' + ('.en' if en else '') + '.png')
    fig.savefig(destino, dpi=240, facecolor=fig.get_facecolor())
    plt.close(fig)
    print(destino)


def escolha_arena(prefixo='qa-mundo-arena2'):
    """Fração das tentativas de teste em que ela escolheu a característica premiada, entre as
    tentativas em que havia uma visível. Mesmo cálculo de scripts/qa_mundo_resumo.mjs."""
    resumo = ler(DADOS / f'{prefixo}-resumo.json')
    arquivos = sorted(p for p in DADOS.iterdir()
                      if re.fullmatch(re.escape(prefixo) + r'(-p\d+)?\.json', p.name))
    sessoes = {}
    for arquivo in arquivos:
        for sessao in ler(arquivo)['sessoes']:
            if not sessao.get('erro'):
                sessoes[sessao['semente'], sessao['condicao']] = sessao   # a última da semente vale
    valores = {}
    for condicao in ('ativa', 'congelada'):
        valores[condicao] = []
        for semente in resumo['sementes']:
            sessao = sessoes[semente, condicao]
            premiada = ':' + sessao.get('caracteristica', 'repetida')
            tentativas = [t for versao in sessao['teste'] for t in versao['tentativas']
                          if t['escolha'] and any(a.endswith(premiada) for a in t['opcoes'])]
            valores[condicao].append(
                sum(t['escolha'].endswith(premiada) for t in tentativas) / len(tentativas))
        conferir(mean(valores[condicao]), resumo['por_condicao'][condicao]['escolha_premiada'], condicao)
    diferencas = [a - b for a, b in zip(valores['ativa'], valores['congelada'])]
    par = resumo['ativa_menos_congelada']['escolha_premiada']
    conferir(mean(diferencas), par['media'], 'diferença pareada')
    for obtido, esperado in zip(bootstrap(diferencas), par['ic95']):
        conferir(obtido, esperado, 'IC95 pareado')
    return {'fontes': [p.name for p in arquivos] + [f'{prefixo}-resumo.json'],
            'sementes': resumo['sementes'], 'diferenca_pareada': par,
            'favoraveis': sum(d > 0 for d in diferencas), 'n': len(diferencas),
            'condicoes': {c: {'media': mean(v), 'por_semente': v} for c, v in valores.items()}}


def desenhar_escolha(dados, idioma):
    """Figura 5: um ponto por semente (congelada no x, treinada no y) e a linha y = x."""
    en = idioma == 'en'
    virgula = (lambda t: t) if en else (lambda t: t.replace('.', ','))
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 12, 'axes.spines.top': False,
                         'axes.spines.right': False, 'axes.spines.left': True})
    fig, ax = plt.subplots(figsize=(8.8, 9.2))
    fig.patch.set_facecolor('#fafbf9')
    ax.set_facecolor('#fafbf9')
    x = dados['condicoes']['congelada']['por_semente']
    y = dados['condicoes']['ativa']['por_semente']
    limite = (0, max(max(x), max(y)) * 1.2)
    ax.plot(limite, limite, color='#9aa7ae', lw=1.3, ls='--', zorder=2)
    ax.text(limite[1] * .98, limite[1] * .98, 'y = x', color='#7b8a92', ha='right', va='bottom',
            fontsize=11, rotation=45)
    acima = [(a, b) for a, b in zip(x, y) if b > a]
    resto = [(a, b) for a, b in zip(x, y) if b <= a]
    ax.scatter(*zip(*acima), s=100, color=CORES[0], edgecolor='white', linewidth=1.2, zorder=4,
               label=('Trained chose more' if en else 'Treinada escolheu mais') + f' ({len(acima)})')
    if resto:
        ax.scatter(*zip(*resto), s=100, color=CORES[1], edgecolor='white', linewidth=1.2, zorder=4,
                   label=('Frozen chose more' if en else 'Congelada escolheu mais') + f' ({len(resto)})')
    ax.scatter([mean(x)], [mean(y)], marker='D', s=150, color=CORES[2], edgecolor='#2b3b45',
               linewidth=1.4, zorder=5,
               label=('Mean' if en else 'Média') + virgula(f' ({mean(x):.2f} → {mean(y):.2f})'))
    ax.set_xlim(limite)
    ax.set_ylim(limite)
    ax.set_aspect('equal')
    ax.grid(color='#e4e9ea', zorder=0)
    ax.tick_params(axis='both', length=0)
    ax.set_xlabel('Frozen' if en else 'Congelada', labelpad=10)
    ax.set_ylabel('Trained' if en else 'Treinada', labelpad=10)
    ax.legend(loc='lower right', frameon=False, fontsize=11)
    par = dados['diferenca_pareada']
    ax.text(.03, .96, virgula(
        (f"Trained − frozen: +{par['media']:.2f}\n95% CI [{par['ic95'][0]:.2f}; {par['ic95'][1]:.2f}]"
         f" · p < 0.001 · dz {par['dz']:.2f}") if en else
        (f"Treinada − congelada: +{par['media']:.2f}\nIC95 [{par['ic95'][0]:.2f}; {par['ic95'][1]:.2f}]"
         f" · p < 0,001 · dz {par['dz']:.2f}")),
        transform=ax.transAxes, va='top', fontsize=12, color='#263947')
    fig.suptitle('Memory changes the embodied fly’s choices' if en else
                 'A memória muda as escolhas da mosca com corpo',
                 x=.05, ha='left', y=.978, fontsize=18, weight='bold', color='#163b44')
    fig.text(.05, .925, 'Choice of the rewarded feature when visible · Arena, 20 pairs' if en else
             'Escolha da característica premiada quando visível · Arena, 20 pares',
             color='#53636b', fontsize=12.5)
    rodape = (f"Each point is one seed: the same brain trained (y) and with frozen weights (x), paired.\n"
              f"Points above the line are seeds where the trained fly chose the rewarded type more often "
              f"({dados['favoraveis']} of {dados['n']}).\n"
              f"Source: qa-mundo-arena2. Test without reward, in parts of the system never seen before." if en else
              f"Cada ponto é uma semente: o mesmo cérebro treinado (y) e com os pesos congelados (x), pareados.\n"
              f"Pontos acima da linha são as sementes em que a treinada escolheu mais o tipo premiado "
              f"({dados['favoraveis']} de {dados['n']}).\n"
              f"Fonte: qa-mundo-arena2. Teste sem recompensa, em partes do sistema que ela nunca viu.")
    fig.text(.05, .028, rodape, fontsize=10, color='#53636b', linespacing=1.5)
    fig.subplots_adjust(left=.115, right=.985, top=.845, bottom=.16)
    conferir_texto(fig)
    destino = SAIDA / ('escolha-com-corpo' + ('.en' if en else '') + '.png')
    fig.savefig(destino, dpi=240, facecolor=fig.get_facecolor())
    plt.close(fig)
    print(destino)


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
    conferir_texto(fig)
    destino=SAIDA / ('resultado-principal' + ('.en' if en else '') + '.png')
    fig.savefig(destino,dpi=240,facecolor=fig.get_facecolor())
    plt.close(fig)
    print(destino)


def main():
    SAIDA.mkdir(parents=True,exist_ok=True)
    series=[serie('qa-b2'),serie('qa-b2-replica')]
    for idioma in ('pt','en'):
        desenhar(series,idioma)
    escolha = escolha_arena()
    for idioma in ('pt', 'en'):
        desenhar_escolha(escolha, idioma)
        desenhar_protocolo(idioma)
    (DADOS / 'figuras-escolha-com-corpo.json').write_text(json.dumps(
        {'metodo': 'Fração das tentativas de teste com uma ação da característica premiada visível em que ela foi '
                   'escolhida, por semente; mesmo cálculo de scripts/qa_mundo_resumo.mjs. Média por condição, '
                   'diferença pareada e IC95 bootstrap conferidos com qa-mundo-arena2-resumo.json.',
         'escolha': escolha}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    registro={'metodo':'Médias por semente nas duas versões de transferência; bootstrap percentil das sementes, 2000 reamostragens, LCG e índices iguais a scripts/qa_resumo.mjs. Médias e IC95 pareados conferidos com resumos originais; os IC95 individuais das barras são calculados dos dados brutos. Sem achado em 30 ações = 31.', 'series':series}
    (DADOS/'figuras-resultado-principal.json').write_text(json.dumps(registro,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Médias e IC95 pareados conferidos com os dois resumos.')

if __name__ == '__main__':
    main()
