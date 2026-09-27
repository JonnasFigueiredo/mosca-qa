# Plano: buscar comida pelo cheiro ao longo do tempo (passo 1 do que falhou no modo só sentidos)

Pedido do usuário (27/09/2026). Leia antes o `AGENTS.md` e o resultado negativo em `docs/plano-sentidos-e-medicao.md`
(seção "P1.5 concluído, resultado negativo"): sem a lista de objetos (`?sentidos=1`), em 5 rodadas de 300 s ela não
achou nenhuma fruta. Um dos motivos: andando, o cheiro não a leva à fruta. Com as antenas na distância real
(0,28 mm), a comparação entre elas é fraca, e ela não compara o cheiro ao longo do tempo, que é o que as moscas reais
fazem.

**Atualize a seção "Onde parei" a cada passo** (o que fez, números, o que falta). Quem continuar começa por ela.

## Onde parei

`[x]` feito e medido; `[~]` começado; `[ ]` não começado.

- [ ] B1 Sonda de busca pelo cheiro (`scripts/cheiro_sonda.js`, via `andar_medida.mjs --sonda-cheiro`) e linha de base
- [ ] B2 A regra como função pura em `web/corpo-natural.js` (`CorpoNatural.buscaCheiro`) com testes
- [ ] B3 Ligar a regra em `stepBody` (corpo simples da Cozinha 3D, só com `?sentidos=1` no começo)
- [ ] B4 Medir: sonda antes/depois, andar livre, e as 5 rodadas de 300 s do modo só sentidos com o mesmo critério
- [ ] B5 (depois) Pouso e decolagem pelos sentidos (passos 2 e 3 do resultado negativo)
- [ ] B6 README, texto da página, `AGENTS.md`, commit

Notas de cada passo, em ordem (a mais recente é a última):

(vazio)

## O que as moscas fazem (base da regra)

| O que | Referência | Uso aqui |
|---|---|---|
| Durante o cheiro, aumentam a velocidade no chão e se orientam contra o vento; depois de perder o cheiro, reduzem a velocidade e viram mais. Só o olfato já basta para as mudanças de velocidade e de viradas; a direção contra o vento precisa do vento (antenas) | Álvarez-Salvado et al. 2018, eLife 7:e37815, https://elifesciences.org/articles/37815 | A Cozinha não tem vento: usar só as partes de velocidade e de viradas |
| Num gradiente, sobem comparando as duas antenas; ao sair da zona de cheiro, a maior parte das viradas vem da queda de velocidade | Tao, Ozarkar e Bhandawat 2020, PLoS Comput Biol, https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1007718 | A comparação entre antenas continua (`chemo`); a queda de velocidade na perda do cheiro entra na regra |
| Em ar parado, a velocidade angular depende da frequência e da intermitência dos encontros com o cheiro, não da duração | Jayaram et al. 2023, eLife, https://pmc.ncbi.nlm.nih.gov/articles/PMC10205008/ | As viradas da busca respondem à perda (o fim de um encontro), não ao tempo dentro |
| Encontros com o cheiro mudam as taxas de parar e de voltar a andar | Demir et al. 2020, eLife 9:e57524, https://elifesciences.org/articles/57524 | Com o cheiro bom presente, menos pausas |

Nada disso é circuito do conectoma no nível de ligação: é **regra do corpo**, baseada em comportamento medido, e vai
declarada assim no README e na página. O cérebro não muda.

## B1 Sonda de busca pelo cheiro

Mesmo formato da sonda do mofo (`scripts/mofo_sonda.js`, rodada por `andar_medida.mjs --sonda-mofo --segundos 0`):
um arquivo `scripts/cheiro_sonda.js` avaliado na página já preparada, e a opção `--sonda-cheiro` no medidor (copiar
o tratamento de `--sonda-mofo`: não usar com `--fisico`; guardar o resultado na medida).

- Largadas: banana, pêssego, morango e uvas; a 20 mm e a 35 mm da borda da forma (use `sbAlturaObjeto`/`SB.formas`
  só para montar e medir, nunca para comandar); rumo sorteado com semente fixa (mesma sequência nos dois modos);
  voo inibido (`voarCd = 1e9` a cada tique); fome 1; 20 s de cérebro por largada.
- Métricas por largada: chegou (borda a menos de 1 mm, ou `f.patasEl` na fruta), tempo até chegar, distância mínima
  à borda, fração do tempo com cheiro bom presente (acima do limiar escolhido em B2), número de sacadas.
- Aviso na saída: o cérebro não é reiniciado entre largadas (não são réplicas independentes), como na sonda do mofo.
- Linha de base **antes de B3**, nos dois modos (`--sentidos` e sem), olhos reais (sem `--sem-olhos`). A caminhada
  pelo cheiro é a mesma nos dois; a visão difere (sem a novidade escondida no modo só sentidos).

## B2 A regra como função pura

Em `web/corpo-natural.js`, para testar em Node (`scripts/corpo_natural_teste.mjs`):

```js
// estado: objeto guardado em f (ex.: f.busca); c: concentração do cheiro bom nas antenas (média, sem saturar)
// devolve { velocidade: fator, semPausa: bool, giro: rad a somar ao giro acumulado (0 quase sempre), ruido: fator }
function buscaCheiro(estado, dt, c, aleatorio = Math.random) { ... }
```

Proposta (ajustar pelos números de B1 e B4, e registrar cada ajuste):
- **Sinal:** `c` = média de `ina.aL` e `ina.aR` (cheiro de fruta e fermentação, antes de multiplicar pela fome e
  antes de saturar), suavizado em ~0,2 s; tendência `dc` = derivada suavizada em ~0,3 s. Limiar de presença a
  escolher em B1 (a distribuição de `c` a 20 e 35 mm das frutas).
- **Dentro do cheiro** (`c` acima do limiar e `dc` ≥ −ε): velocidade × ~1,3, sem pausas sorteadas, ruído de virada
  × ~0,3 (anda mais reto). Base: Álvarez-Salvado 2018 (acelera no cheiro), Demir 2020 (menos paradas).
- **Perdeu o cheiro** (estava acima do limiar e agora cai: `dc` < −ε, ou passou para baixo do limiar): por ~1,5 s,
  velocidade × ~0,6 e giros de busca de 60–150° a cada 0,4–0,8 s, para o lado da antena com mais cheiro quando a
  diferença for mensurável, senão sorteado. Base: Álvarez-Salvado 2018 (desacelera e vira mais depois da perda),
  Tao 2020, Jayaram 2023.
- **Fora do cheiro** por mais de ~3 s: nada muda (a caminhada e as pausas de sempre).
- A fuga do mofo tem prioridade sobre a busca (se `f.fleeDir`, a busca não age).
- Testes em `corpo_natural_teste.mjs`: subindo o cheiro → mais rápida, sem pausa; perdendo → mais lenta e com giro;
  sem cheiro → neutra; com `aleatorio` fixo, o giro sai do lado da antena mais forte.

## B3 Ligar em `stepBody`

- Só no corpo simples da Cozinha 3D (`sacadas` verdadeiro) e só com `soSentidos()` no começo, para comparar com a
  série anterior sem mexer no padrão. Depois de B4, decidir se vale também para o modo com atalhos.
- Onde: perto da fuga do mofo em `web/index.html` (`stepBody`): o fator de velocidade entra em `f.speed`, `semPausa`
  como a fuga já faz com `marcha`, o giro somado a `f.giroAcum` (sai em sacada pelo mecanismo existente), o ruído
  multiplica o termo `(Math.random() - 0.5) * ...` de `turn`.
- Guardar em `f` o estado da busca para o medidor (`f.busca.estado`: 'fora', 'dentro', 'perdeu'). Acrescentar ao
  registro do medidor a fração do tempo em cada estado.
- Corpo físico: deixar para depois (as viradas dele vêm do controlador; seria um pulso em `turnCmd`).

## B4 Medir

1. Sonda de B1 depois de B3, nos dois modos; comparar chegadas e tempos com a linha de base.
2. `andar_medida.mjs --sentidos --segundos 90` livre: conferir que o andar sem cheiro não mudou (velocidade, pausas,
   viradas dentro das faixas da parte 2).
3. As 5 rodadas de 300 s do modo só sentidos (`python -X utf8 _rodadas_longas.py sentidos` se o arquivo ainda
   existir; senão, 5 × `node scripts/andar_medida.mjs --segundos 300 --sentidos --rotulo longa-sentidos-N`), resumo
   com `node scripts/resumir_sentidos.mjs`. **Atenção:** o resumo pega a última medida de cada rótulo; use rótulos
   novos (ex.: `longa-sentidos-b-1..5`) e ajuste o script, para não misturar com a série anterior.
4. Mesmo critério de antes: fruta ≥ 3/5, pouso em fruta ≥ 2/5, refeições ≥ metade do modo com atalhos. Só a busca
   pelo cheiro talvez não baste (o pouso e a decolagem também falharam): registrar o que melhorou e o que não.
5. Rodar `node scripts/corpo_natural_teste.mjs` e `node scripts/realismo_sandbox_teste.mjs`.

## B5 (depois) Pouso e decolagem

Da mesma análise: (a) pousar quando os olhos veem uma coisa embaixo e o cheiro bom está presente e **crescendo**, em
vez de exigir `f.atrInata > 0,35` na altura do voo (o cheiro fica fraco a 60 px acima); ou amostrar o cheiro na
altura em que ela desceria; (b) com fome e sem cheiro bom crescendo por um tempo (a comida por perto acabou), subir
a chance de decolar. Medir cada um separadamente, com a mesma série e o mesmo critério.

## Lembretes

- Um servidor por porta (`netstat -ano | grep -E ":876[56]"`); um navegador de teste por vez; temporários com `_`.
- `index.html` usa CRLF; editar com o Edit ou gravar com `newline='\r\n'`; conferir caracteres de controle depois.
- Commit só quando o usuário pedir ou antes de mudança grande; autor só o Jonnas, sem `Co-Authored-By`.
