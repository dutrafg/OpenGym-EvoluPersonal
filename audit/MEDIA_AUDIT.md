# Auditoria das mídias — catálogo de 500 exercícios

Verificação estrutural completa do catálogo da main, blob index.html ea606b6969e44318dc2fb87a5fb32c2a2090526f. Esta auditoria não aprova visualmente movimentos.

## Resultado

- 500 IDs conferidos, de 1 a 500.
- 445 exercícios possuem GIF vinculado; 442 arquivos GIF distintos.
- 25 exercícios possuem referência OpenExerciseBase, usando 24 PNGs distintos. Esses 25 também têm GIF; os números não se somam.
- 18 exercícios sem mídia direta possuem candidato externo.
- 37 exercícios não possuem mídia direta nem candidato.
- 155 vínculos de GIF continuam marcados para revisão no código.
- Todos os 466 arquivos internos referenciados existem, são blobs não vazios na revisão imutável abaixo.
- Todos os quadros dos candidatos GymBells e Workout Guide existem, sem arquivos vazios nos caminhos consultados.

## O que a interface efetivamente escolhe

A prioridade é fonte externa aprovada → referência OpenExerciseBase → GIF → candidato para revisão → pendência.

| Exibição | Exercícios |
| --- | ---: |
| Sequência externa com aprovação já registrada | 11 |
| Referência estática OpenExerciseBase | 23 |
| GIF | 411 |
| Somente candidato externo | 18 |
| Sem mídia/candidato | 37 |

A aprovação externa é um estado já existente no aplicativo, não uma aprovação desta auditoria.

## Arquivos compartilhados que exigem revisão

| IDs | Arquivo | Motivo |
| --- | --- | --- |
| 135 / 341 | e171.gif | Variações de crucifixo inverso no cabo; conferir execução/pegada. |
| 140 / 340 | e110.gif | Variações no peck deck; conferir escápulas e pegada. |
| 301 / 302 | e112.gif | Uma mesma mídia para pegada pronada aberta e neutra fechada. |
| 405 / 406 | EX-cable-triceps-pressdown…/image_1.png | Uma mesma referência para barra e corda. A imagem tem prioridade sobre os GIFs diferentes já vinculados. |

Repetição de arquivo não prova erro. Pegadas e equipamentos diferentes precisam de revisão antes da aprovação.

## Exercícios sem mídia nem candidato

| ID | Exercício |
| --- | --- |
| 171 | Leg Press Articulado (Iso-Lateral) |
| 173 | Leg Press Horizontal Unilateral |
| 214 | RDL na Máquina de Hack / V-Squat Invertido |
| 219 | Bom Dia na Máquina (Hack Squat ou Pendulum) |
| 228 | Flexora Ajoelhada na Máquina (Kneeling Leg Curl) |
| 240 | Razor Curl no Aparelho de GHR |
| 250 | Elevação Pélvica na Cadeira Extensora / Mesa Flexora (Adaptação) |
| 269 | Coice no Smith (Empurrando a barra com a sola do pé em 4 apoios) |
| 275 | Cadeira Abdutora em Pé (Sem sentar no banco) |
| 278 | Abdução de Quadril Deitado de Lado na Polia Baixa |
| 290 | Máquina Multiquadril (4-Way Hip Machine - Extensão, Flexão, Abdução, Adução) |
| 308 | Viking Press (No acessório específico ou Landmine) |
| 311 | Bradford Press (Passando a barra da frente para trás da cabeça sem trancar os cotovelos) |
| 346 | Powell Raise (Crucifixo inverso unilateral deitado de lado no banco) |
| 372 | Rosca na Máquina (Sentado, braços na horizontal) |
| 381 | Rosca Inclinada na Polia Baixa (Banco a 45° posicionado no crossover) |
| 396 | Pronação e Supinação de Antebraço com Halter ou Barra unilateral |
| 397 | Flexão Radial e Ulnar de Punho (Movimento de martelada em pé com halter) |
| 413 | JM Press com Barra ou no Smith (Híbrido entre Supino Fechado e Testa) |
| 414 | California Press |
| 427 | Tríceps Francês Sentado na Máquina Específica |
| 428 | PJR Pullover (Híbrido de Pullover com Francês usando Halter pesado) |
| 440 | Pin Press Fechado (Empurrada final do supino saindo dos pinos de segurança) |
| 451 | Panturrilha no V-Squat / Pêndulo |
| 456 | Panturrilha Agachado (Squat Calf Raise / Iso-Hold) |
| 457 | Caminhada na Ponta dos Pés com Halteres (Farmer's Walk on Toes) |
| 459 | Elevação Tibial com Barra Tibial ou Kettlebell (Weighted Tib Raise) |
| 477 | Abdominal GHD (Glute-Ham Developer Sit-up) |
| 478 | Abdominal Janda (Janda Sit-up - contraindo posteriores para anular o psoas) |
| 480 | L-Sit (Sustentação isométrica em L nas paralelas ou argolas) |
| 487 | Lenhador Horizontal na Polia Média |
| 489 | Rotação de Tronco no Landmine em Pé (Landmine 180s / Rainbow) |
| 490 | Elevação de Pernas Oblíqua na Barra Fixa (Windshield Wipers / Para-brisa) |
| 492 | Flexão Lateral de Tronco no Banco Romano (45°) |
| 494 | Prancha Dinâmica na Bola Suíça (Stir the Pot) |
| 495 | Prancha RKC (Contração máxima de glúteos, quadríceps e dorsais) |
| 500 | Vacuum Abdominal (Contração isométrica do Transverso do Abdômen) |

Os itens 275 e 278 mostrados na captura são ausência de associação no catálogo, e não apenas falha de carregamento.

## Evidência técnica

- EvoluPersonal: b224519ac23473e0e13f4f74e29b6e70e1ce6f01.
- GymBells: 24ea56171034fc7f2b5d766c1bb482e523fa2afe.
- Workout Guide: aac599224bb9780305239607ef98540b7e0ce389.
- As três árvores Git foram retornadas sem truncamento.
- CSV e JSON ao lado listam os 500 exercícios. JSON inclui hashes e tamanhos dos arquivos internos.

## Limites e pendências

O ambiente de execução ficou indisponível nesta sessão. Portanto, não foi possível baixar e decodificar os arquivos, reproduzir todos os GIFs, abrir a grade completa no navegador nem testar o cache/PWA no Android. A existência de um blob não prova que o arquivo decodifica ou que o exercício corresponde à imagem.

Não foram substituídas mídias por variações aproximadas nem marcadas como aprovadas imagens não revisadas. A revisão visual dos 500 movimentos permanece pendente. As árvores externas consultadas são revisões pontuais; as URLs externas que usam main ainda podem mudar.
