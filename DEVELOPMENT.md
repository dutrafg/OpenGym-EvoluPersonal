# Integração de funções — cinco etapas

Antes de implementar cada etapa, consultar novamente o código do OpenGym,
registrar a revisão e os arquivos consultados e conferir a adaptação ao modelo
de alunos, rotinas e registros do EvoluPersonal.

1. Execução — cardio, duração, técnicas avançadas e consistência dos registros.
2. Histórico e evolução — edição de sessões e gráficos por exercício.
3. Equipamentos, favoritos e compartilhamento de rotinas.
4. Importadores e análise muscular.
5. Acesso remoto do aluno e sincronização.

## Etapa 1 — Beta 1.4

Referência consultada em DuarteSantos8/openGym,
revisão 8fb98b16861a2728652302a7e6e30c50548493a0:

- frontend/src/lib/history.js — distinção entre repetições, tempo e cardio.
- frontend/src/lib/cardio-reps.test.js — preservar o modo dos registros antigos.
- frontend/src/lib/per-set.js — separar aquecimento, trabalho e blocos adicionais.
- frontend/src/lib/finish-workout.js — persistência da execução concluída.
- frontend/src/components/RestTimer.jsx — organização do descanso.

Implementação própria em execution.js para os registros planos do EvoluPersonal.
Duração em segundos e distância em km são explícitas. A velocidade é calculada.
O cronômetro usa timestamp salvo no rascunho, com limite de 24 horas.
Quedas e mini-séries possuem carga e repetições individuais.
CSV inclui duração, distância e blocos. Cardio e tempo não geram volume de força
ou 1RM. Aquecimento e preparatórias ficam fora dos indicadores de trabalho.
Históricos legados continuam aceitos.

Testes locais cobrem cálculos, validação, rollback ao falhar armazenamento,
cronômetro, exportação e cache. A validação visual e do fluxo completo em
navegadores Android continua pendente.

## Etapa 2 — Beta 1.5

Referência consultada novamente antes da implementação, revisão OpenGym
8fb98b16861a2728652302a7e6e30c50548493a0:

- frontend/src/lib/session-edit.js — editar cópia, substituir por ID, detectar conflito.
- frontend/src/lib/workout-date.js — efeito da data no histórico e nos recordes.
- frontend/src/lib/per-set.js — dados históricos e exclusão dos aquecimentos.

Implementação independente em history-tools.js. O histórico completo permite
abrir uma sessão e corrigir título, data/hora, esforço, observações, cargas,
repetições, duração, distância, lados, RIR e blocos adicionais. Também permite
remover séries, mantendo ao menos uma. A correção é validada antes de salvar,
detecta mudanças concorrentes na sessão e preserva outros dados já gravados.
Cancelar mantém o registro anterior. O editor de correção não persiste campos
ainda não enviados: fechar/recarregar descarta as alterações do formulário.

Gráficos por aluno e exercício com carga, volume, repetições, 1RM, duração e
distância. A tabela abaixo permite consultar cada ponto. Unidades de carga
separadas. Os indicadores são lidos do histórico corrigido, sem cache de PRs.
Sugestões antigas da sessão corrigida são removidas.

Corrigida a leitura de duração/cardio sem carga e a validação de exercícios
com modo por tempo que ainda conservam configuração de progressão antiga.
Validação visual completa em navegadores Android permanece pendente.
