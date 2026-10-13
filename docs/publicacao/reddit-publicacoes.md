# Publicações do Mosca QA no Reddit

Rascunhos preparados em 12/10/2026. Nenhum foi publicado. Confirmar a acessibilidade dos links em uma janela sem login antes de postar; não foi criada uma demonstração hospedada por esta tarefa.

## r/threejs

Primeiro post sugerido. Anexar o MP4 escuro de 24 s. Abrir com a mosca já se movendo; não usar introdução longa. Foco: renderização e integração com worker.

### Título

How I trained a simulated fruit fly to hunt software bugs, with all 166,700 neurons running in the browser

### Texto

I trained a fruit fly to find bugs in software. Not a real one: a simulation of a fly brain built from the MaleCNS connectome, rewarded whenever it uncovered a planted defect. The fly, its neural activity and the readouts in this clip all run together in the browser.

Three.js draws the world and the brain. A Web Worker runs a simplified spiking-neuron model using MaleCNS connectivity: about 166,700 neurons and 6.2 million connections after filtering. The brain viewer lights up from the model's actual spikes.

In the arena, software actions are represented by scented plaques. The fly samples them, and discovering a planted defect during training triggers a reward. Movement and parts of the navigation use explicit rules; the clip is a short, sped-up view of the interface in action.

One useful optimization was updating active neurons and propagating events rather than scanning the entire network at every step.

Would you keep the three views together, or make the neural readouts appear only when the fly samples a plaque?

A note on how it was validated, since a simulation like this is easy to make look convincing. Every behavior in the project is labeled as either coming from the connectivity data or being a rule I wrote. For the learning claims, the success criterion was written and committed before each measurement run, the comparison is a frozen-learning control paired by seed, the statistics use bootstrap confidence intervals with Holm correction across endpoints, and every effect was replicated with new seeds. The negative results stayed in the writeup.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

A referência do celular teve a maior pontuação indexada entre os cinco exemplos (+308). A ação familiar e absurda é entendida imediatamente. O autor explica a construção procedural e declara que não usa conectoma real. Aproveitar a clareza visual, sem copiar a alegação biológica.

## r/SideProject

Vídeo de 24 s + texto curto. Não prometer SaaS, produto pronto ou teste automático de sites arbitrários. A pergunta final busca feedback da interface.

### Título

How I trained a simulated fruit fly to find bugs in my software

### Texto

I trained a simulated fruit fly to find bugs. The premise is odd on purpose: turn each action of a piece of software into a smell, reward the fly when an action it sampled reveals a defect, and see whether it learns which kind of action is worth trying.

The video shows the fly moving between plaques, the simulated neurons firing, and the memory and activity panels updating together.

The software under test is a small, deliberately buggy order system. During training, finding a new defect triggers a reward. Testing uses new versions without reward, including bugs in other action families.

The results were mixed in an interesting way. Without a moving body, the trained model found the learned kind of defect about 5–7 actions earlier than the frozen-learning comparison. In the 3D arena it chose the rewarded kind more often, but did not find the first bug measurably faster.

This is an experiment with simplified neurons and explicit movement rules, not a replacement for a QA engineer.

Is the connection between the plaques, the memory panel and the software actions clear from the clip?

A note on how it was validated, since a simulation like this is easy to make look convincing. Every behavior in the project is labeled as either coming from the connectivity data or being a rule I wrote. For the learning claims, the success criterion was written and committed before each measurement run, the comparison is a frozen-learning control paired by seed, the statistics use bootstrap confidence intervals with Holm correction across endpoints, and every effect was replicated with new seeds. The negative results stayed in the writeup.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

O jogo de reflexo tinha pontuação indexada 0. Isso não prova rejeição da ideia: não temos impressões nem taxa de votos. Não usar esse post como caso comprovado de sucesso. Diferenciar Mosca QA pela pergunta experimental e pelo resultado concreto.

## r/neuro

Vídeo acompanhado do artigo em inglês. Dar destaque aos controles e ao resultado negativo com corpo. Confirmar que o link do artigo pode ser aberto por outra pessoa.

### Título

How I trained a MaleCNS-based fly model to find software bugs, and what actually transferred

### Texto

I trained a connectome-based fly model to find software bugs, to test one narrow question: can reward-driven plasticity bias its choices toward a learned odor feature in task contexts it has never seen?

The model uses MaleCNS connectivity, simplified leaky integrate-and-fire neurons, and dopamine-modulated plasticity at Kenyon-cell-to-mushroom-body-output connections. Software actions in a deliberately faulty order system are encoded as odors. Training rewards newly detected defects; test versions use new action families without reward.

In the body-free task, trained models found defects of the learned kind about 5–7 actions earlier than a frozen-learning comparison, with independent replication. With a moving body in the arena, the rewarded-feature choice fraction increased by about 0.10 (95% CI 0.05–0.15; 16/20 seeds), but time to the first defect did not improve measurably.

The anatomy constrains the model; neuron dynamics, odor encoding, action selection and movement include modeling choices and authored rules. The video shows a short interface demonstration, not the experiment's full evidence.

Which control would most help separate generalization of the rewarded odor feature from an effect of the task encoding?

On bias control, since the task encoding is mine and could easily carry the result. The success criterion and the analysis plan were written and committed before each measurement run, with an oracle and a power estimate computed first. The comparison condition freezes plasticity and is paired by seed, so both conditions see the same versions and the same action order. Confidence intervals are percentile bootstrap, multiple endpoints get Holm correction, and each effect was rerun with new seeds. Every behavior is documented as either derived from connectivity or an authored rule, and the failed primary endpoint is reported as a failure rather than reframed.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

FlyLab tinha +26 no retrato indexado. O texto explica entrada, processamento e saída e delimita o papel do controlador. É boa referência de clareza técnica; a pontuação isolada não demonstra validação científica.

## r/compmathneuro

Publicação técnica, depois de revisar artigo e dados. Anexar gráfico de resultado e usar o vídeo como contexto. Não apresentar escolha como sucesso do critério principal.

### Título

How I trained a connectome-based fly to find software bugs: choice transferred, first-defect latency did not

### Texto

I trained a MaleCNS-based model to find defects in a synthetic software system, and I would appreciate methodological feedback on it. The headline is split: the choice measure transferred, the primary endpoint did not.

The browser model has about 166,700 leaky integrate-and-fire neurons and 6.2 million retained connections (5+ anatomical synapses per connection). Reward modulates Kenyon-cell-to-MBON plasticity. Actions in a synthetic order system are encoded with odor components for action family and shared features, including repetition.

Training exposes payment and cancellation defects. Testing includes new families such as coupons and stock reservation, without reward. The comparison condition freezes learning. The body-free task reads out valence and samples actions; the embodied arena adds sampling, travel and authored movement rules.

Body-free transfer improved by roughly 5–7 actions to the first defect of the learned kind across the reported series. In the arena dataset, rewarded-feature choice increased by 0.10 (95% CI 0.05–0.15; 16/20 seeds), while the primary endpoint, time to first defect, did not improve measurably. I treat the choice effect as a secondary result needing confirmation with choice preregistered as the primary endpoint.

The repository documents the encoding, model assumptions and negative results. This does not establish that the biological animal understands software.

For a follow-up, which matched control would be most informative: shuffled connectivity, randomized odor-feature assignments, or a simpler learner using the same inputs and readout?

On bias control, since the task encoding is mine and could easily carry the result. The success criterion and the analysis plan were written and committed before each measurement run, with an oracle and a power estimate computed first. The comparison condition freezes plasticity and is paired by seed, so both conditions see the same versions and the same action order. Confidence intervals are percentile bootstrap, multiple endpoints get Holm correction, and each effect was rerun with new seeds. Every behavior is documented as either derived from connectivity or an authored rule, and the failed primary endpoint is reported as a failure rather than reframed.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

O post de Skyrim tinha +18, com uma crítica a exageros recebendo +12 na consulta indexada. A discussão é o dado mais útil: o leitor quer saber o que é realmente neural e quais controles sustentam as conclusões. Receber votos não equivale a convencer esse público.

## r/brdev

Usar TAG Projetos somente se compatível com as regras atuais e aberto à colaboração. Texto técnico, sem chamada para seguir perfil ou dar estrelas.

### Título

Como treinei uma mosca simulada para achar bugs no meu sistema

### Texto

Treinei uma mosca para achar bugs. Não uma de verdade: uma simulação do cérebro de uma mosca montada a partir do conectoma, em que cada ação de um sistema de Pedidos vira um cheiro e encontrar um defeito plantado gera recompensa durante o treino.

A parte que queria discutir aqui é a implementação. A interface renderiza o mundo 3D, a mosca, o cérebro e os painéis, enquanto um Web Worker executa neurônios integra-e-dispara. São cerca de 166.700 neurônios e 6,2 milhões de conexões após o filtro dos dados anatômicos.

O gargalo era percorrer a rede inteira. O simulador passou a acompanhar os neurônios ativos e propagar eventos, além de manter os dados de cada neurônio juntos na memória. Isso reduziu o trabalho por passo sem depender de um LLM para decidir as ações durante a simulação.

O vídeo mostra a interface em funcionamento. A aplicação separa as saídas neurais das regras que escrevemos para movimentação e navegação. A caça acontece num sistema fictício com defeitos conhecidos, não em sites arbitrários.

Para quem já integrou simulação pesada com renderização: como vocês organizariam a frequência das mensagens do worker e as atualizações da interface para evitar que a visualização vire o gargalo?

Sobre a validação, porque uma simulação assim é fácil de deixar convincente sem ser honesta. Cada comportamento do projeto está marcado como vindo do conectoma ou como regra escrita por mim. Nos resultados de aprendizado, o critério de sucesso foi escrito e commitado antes de cada medição, a comparação é um controle com aprendizado congelado pareado por semente, a estatística usa intervalo de confiança por bootstrap com correção de Holm, e cada efeito foi replicado com sementes novas. Os resultados negativos continuam no texto, inclusive o critério principal que não melhorou com corpo.

Projeto e documentação: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

A referência é um comunicado de moderação, não um post de sucesso. A regra pede colaboração e discussão técnica. O texto foi organizado em torno de uma decisão de arquitetura e uma pergunta específica.

## r/webdev

Publicar no sábado com a flair correta; conferir requisitos da conta. Anexar vídeo, não apenas link. Não afirmar compatibilidade móvel ou desempenho universal.

### Título

[Showoff Saturday] How I trained a simulated fruit fly to find bugs, running live in the browser

### Texto

For Showoff Saturday: I trained a simulated fruit fly to find bugs in software. The brain is a connectome-based spiking-neuron model in a Web Worker, the world and the panels are Three.js, and the whole thing runs in a browser tab.

The clip shows three synchronized views: the fly in a 3D arena, the brain's simulated spikes, and the memory/activity panels. Software actions are represented by scented plaques in a synthetic bug-hunting task.

The worker handles the neural computation while the main thread handles the world and interface. Processing active neurons and propagating events reduced the simulation workload. The browser still has to balance simulation progress, rendering and frequent readout updates, so the clip is sped up rather than a claim of guaranteed real-time performance.

The app includes close and overhead cameras, a kitchen environment, neural readouts and separate training/test controls. Body movement includes authored rules; the neural visualization receives actual events from the model.

I'd like feedback on the interface: can you follow the relationship between the fly's current action and the panels without already knowing the project?

A note on how it was validated, since a simulation like this is easy to make look convincing. Every behavior in the project is labeled as either coming from the connectivity data or being a rule I wrote. For the learning claims, the success criterion was written and committed before each measurement run, the comparison is a frozen-learning control paired by seed, the statistics use bootstrap confidence intervals with Holm correction across endpoints, and every effect was replicated with new seeds. The negative results stayed in the writeup.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

A referência é uma remoção que esclarece o formato exigido: detalhes técnicos ou feedback específico. Serve para adequação às regras, não para medir engajamento.

## r/ClaudeAI

Conferir Rule 7. A megathread oficial informa karma total mínimo de 50 para showcase no feed; abaixo disso, usar a megathread. Preparar um relato fiel, sem inventar prompts, custos ou horas de trabalho.

### Título

How I trained a simulated fruit fly to find software bugs, using Claude and Codex to build it

### Texto

I trained a simulated fruit fly to find bugs in software, and built the whole thing with Claude and Codex. Software actions become smells for a neural model based on a fruit fly connectome, and finding a planted defect during training is the reward.

The result is in the clip: a moving fly, a 3D view of the simulated spikes, and memory and activity panels. The runtime is JavaScript and a neural-simulation worker; Claude isn't choosing the fly's actions during the experiment.

The development loop involved implementation, simulator checks, inspecting the actual 3D behavior, and revising the visuals. Even the presentation needed concrete fixes: the walking clip intersected scenery, so it was redone; the flight camera moved behind the fly; and the neural readouts stayed visible beside the body.

The experimental result was less tidy than a success demo: learning helped in the body-free task, while the embodied version changed choice preferences without measurably reducing time to the first defect.

The part I want to compare with other builders is validation. When an AI-assisted simulation looks convincing on screen, what checks do you use to verify that the intended mechanism is actually producing the behavior?

The part I was strict about was not letting an agent-built demo stand in for a result. Each behavior is documented as either coming from the connectivity data or being a rule we wrote, the success criterion was written and committed before each measurement run, the comparison is a frozen-learning control paired by seed, statistics use bootstrap confidence intervals with Holm correction, and effects were replicated with new seeds. The endpoint that failed is reported as failed.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

O post dos tanques tinha +52 no retrato indexado e comentários bem-humorados. Ele combina ação visual específica, explicação do mecanismo e relato de desenvolvimento. A resposta do autor de que os bots ainda venciam a mosca ajudava a manter expectativas proporcionais.

## r/fruitflybrain

Conferir atividade e regras antes de postar. Apresentar o modelo, a tarefa e os limites.

### Título

How I trained a MaleCNS fly model to find software bugs

### Texto

I trained a fly model to find software bugs. It runs in the browser on MaleCNS connectivity: about 166,700 neurons and 6.2 million connections after filtering, simulated with simplified spiking neurons.

The task is unusual: actions in a deliberately buggy order system are represented by smells. Finding defects during training triggers a reward, and testing asks whether the learned preference transfers to new action families.

The clip shows the fly, simulated neural activity and memory panels together. Body movement and parts of navigation use explicit rules; this is not a complete biological replica.

Learning helped in the body-free task. In the embodied arena, choice preference changed, but time to the first defect did not improve.

For others working with fly models: how do you separate effects of connectivity from effects introduced by sensory encoding and the controller?

On bias control, since the task encoding is mine and could easily carry the result. The success criterion and the analysis plan were written and committed before each measurement run, with an oracle and a power estimate computed first. The comparison condition freezes plasticity and is paired by seed, so both conditions see the same versions and the same action order. Confidence intervals are percentile bootstrap, multiple endpoints get Holm correction, and each effect was rerun with new seeds. Every behavior is documented as either derived from connectivity or an authored rule, and the failed primary endpoint is reported as a failure rather than reframed.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

Convite para reunir projetos de moscas nos comentários da referência. Não foi possível confirmar atividade atual; é uma opção de nicho, sem estimativa de alcance.

[Post de referência](https://www.reddit.com/r/SideProject/comments/1wavl6z/)

## r/OpenSourceAI

Usar apenas com código e licença acessíveis. Conferir regras atuais; pontuação não equivale a validação científica.

### Título

How I trained a connectome-based fly to find software bugs (open source, negative result included)

### Texto

I trained a fly model to find software bugs, to see whether a neural model based on fruit fly connectivity can learn which kind of software action tends to reveal a defect. The code and the measurements are open.

It runs in the browser: Three.js for the world and visualization, and a Web Worker for a simplified spiking-neuron model. The runtime does not use an LLM to choose actions.

Actions in a synthetic order system become odors. Training rewards newly discovered defects; testing uses new versions without reward. Plasticity in the mushroom-body model is compared with a frozen control.

In the body-free task, the trained model found defects of the learned type around 5–7 actions earlier. In the embodied arena, preference for the rewarded type increased, but time to the first defect did not improve. These are separate experiments.

Body movement and parts of navigation are authored rules. The video is a short, sped-up view of the interface, not evidence that the model understands software.

Which baseline would you prioritize next: a shuffled-connectivity model, a simpler learner with the same odor encoding, or both?

On bias control, since the task encoding is mine and could easily carry the result. The success criterion and the analysis plan were written and committed before each measurement run, with an oracle and a power estimate computed first. The comparison condition freezes plasticity and is paired by seed, so both conditions see the same versions and the same action order. Confidence intervals are percentile bootstrap, multiple endpoints get Holm correction, and each effect was rerun with new seeds. Every behavior is documented as either derived from connectivity or an authored rule, and the failed primary endpoint is reported as a failure rather than reframed.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

FlyLab teve +111 no resultado indexado consultado. O tema é próximo, mas comentários misturam curiosidade, humor e crítica; não é aprovação científica.

[Post de referência](https://www.reddit.com/r/OpenSourceAI/comments/1wkotdc/)

## r/ClaudeCode

Relatar somente o processo real com Claude e Codex. Não inventar prompts, custos ou ganhos de produtividade. Regras ainda não confirmadas.

### Título

How I trained a simulated fruit fly to find bugs, and how I checked it wasn't fooling me

### Texto

I trained a simulated fruit fly to find bugs in software, developing it with Claude and Codex. Software actions become smells for a connectome-based neural model, and a planted defect found during training is the reward.

The short clip shows the fly moving, simulated spikes lighting up, and memory/activity panels updating together. The runtime is JavaScript; an LLM is not selecting the fly's actions.

A useful part of the development loop was checking what the visual actually showed. An early movement clip intersected scenery and had to be redone. Camera angles also needed revision so flight and grooming could be inspected clearly.

For the learning experiments, an attractive animation wasn't enough. We compared learning with a frozen control and kept negative results: the embodied arena changed choice preference without reducing time to the first defect.

The model uses measured connectivity, simplified neurons and explicit body/navigation rules. It is an experimental system, not a digital copy of an entire living fly.

How do you structure verification when using coding agents on simulations where a plausible-looking output can hide a wrong mechanism?

The part I was strict about was not letting an agent-built demo stand in for a result. Each behavior is documented as either coming from the connectivity data or being a rule we wrote, the success criterion was written and committed before each measurement run, the comparison is a frozen-learning control paired by seed, statistics use bootstrap confidence intervals with Holm correction, and effects were replicated with new seeds. The endpoint that failed is reported as failed.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

O post do DOOM tinha +58 no resultado indexado. Explica a camada treinada e distingue mapa neural de cérebro vivo. Aproveitar a transparência sobre componentes e verificações.

[Post de referência](https://www.reddit.com/r/ClaudeCode/comments/1wgq7vc/)

## r/codex

Focar nas revisões, testes e limites do uso dos agentes. Conferir regras da comunidade antes da publicação.

### Título

How I trained a simulated fruit fly to find software bugs with Claude and Codex

### Texto

I trained a simulated fruit fly to find bugs in software, using Claude and Codex to build it. The brain is a model based on fruit fly neural connectivity; the software under test is a deliberately faulty order system.

The interface combines a 3D fly, simulated neural activity, and memory/readout panels. The experiment represents actions in a deliberately buggy software system as odors and tests reward-driven learning.

Some very concrete revisions happened during presentation work: a movement clip crossed scenery and was redone, the flight camera moved behind the fly, and the grooming view needed a close frontal angle. The final overview is a short dark-mode clip showing the interface in action.

The important distinction is between making the behavior visible and validating the experiment. Body-free learning results were positive; with embodiment, choice preference changed but time to the first defect did not improve. The visual doesn't replace those measurements.

The runtime uses a simplified spiking-neuron model and authored body rules, not an LLM choosing each action.

What review or testing practices have helped you catch convincing-looking mistakes in agent-assisted simulation projects?

The part I was strict about was not letting an agent-built demo stand in for a result. Each behavior is documented as either coming from the connectivity data or being a rule we wrote, the success criterion was written and committed before each measurement run, the comparison is a frozen-learning control paired by seed, statistics use bootstrap confidence intervals with Holm correction, and effects were replicated with new seeds. The endpoint that failed is reported as failed.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

Um corpo digital de mosca teve +8 no retrato indexado. É precedente temático, não evidência de grande alcance. O relato de desenvolvimento é mais adequado que um anúncio genérico.

[Post de referência](https://www.reddit.com/r/codex/comments/1uy7ko3/)

## r/Simulated

Vídeo curto em primeiro plano. Dizer o que é simulado e o que é regra; conferir formato e regras atuais.

### Título

How I trained a simulated fruit fly to find software bugs, shown next to its neural activity

### Texto

I trained a simulated fruit fly to find bugs in software. This is the fly exploring the arena, with the simulated spikes and its memory shown beside it: a 3D body, a simplified spiking-neuron model based on MaleCNS connectivity, and live panels.

The arena plaques represent actions in a synthetic software-testing task. They emit modeled odors; discovering a planted defect during training produces a reward signal.

The neural display shows spikes from the running model. Locomotion and parts of navigation use authored rules, so the movement should not be read as an entirely emergent biological behavior.

This is a short, sped-up interface clip. It shows how the components run together rather than demonstrating a learning advantage on its own.

Is the connection between the fly's action and the neural/memory views readable, or would a single view with occasional close-ups make the simulation easier to follow?

A note on how it was validated, since a simulation like this is easy to make look convincing. Every behavior in the project is labeled as either coming from the connectivity data or being a rule I wrote. For the learning claims, the success criterion was written and committed before each measurement run, the comparison is a frozen-learning control paired by seed, the statistics use bootstrap confidence intervals with Holm correction across endpoints, and every effect was replicated with new seeds. The negative results stayed in the writeup.

Project and documentation: https://github.com/JonnasFigueiredo/mosca-qa

### Por que este formato

ALIEN teve +261 no resultado indexado, em 2022. É uma referência visual histórica; seu método de vida artificial é diferente e não prevê a recepção atual do Mosca QA.

[Post de referência](https://www.reddit.com/r/Simulated/comments/u0o3b7/)
