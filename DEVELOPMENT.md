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

## Revisão de entrada da etapa 3 — Beta 1.5.1

Foram encontradas e corrigidas pendências de execução da etapa 1:
reverter alterações de carga/repetições quando a gravação falha, rejeitar valores
não numéricos e impedir conclusão com metas em faixa em vez de repetições reais.
Testes de regressão das etapas 1 e 2 passaram após a correção.

A validação visual e do fluxo completo em Android das etapas anteriores continua pendente. A tentativa de instalar Chromium no ambiente de testes retornou
download inválido. Testes com mocks e Node não equivalem à validação no Android.

Código de referência da etapa 3 já consultado preliminarmente: favourites.js,
plates.js e plan-share.js da revisão OpenGym 8fb98b1. A implementação da etapa 3 está descrita abaixo; sua homologação em Android permanece pendente.


## Etapa 3 — Beta 1.6 RC (em homologação)

Código OpenGym consultado novamente na revisão
`8fb98b16861a2728652302a7e6e30c50548493a0`:
`frontend/src/lib/favourites.js`, `plates.js` e `plan-share.js`.
Nenhuma mídia nem biblioteca de exercícios do OpenGym foi incorporada.

Implementação própria em `routine-tools.js`:

- Favoritos persistidos por ID MD, filtro exclusivo e prioridade estável na
  Biblioteca e no seletor do editor de treino. Preferências não são compartilhadas.
- Equipamentos em kg: peso da barra e estoque de pares por tamanho. A calculadora
  monta cargas simétricas sem ultrapassar o estoque ou a carga desejada; informa
  a diferença quando a meta não é possível. Não altera prescrições ou registros.
- Arquivo JSON de rotinas versão 1 com apenas título, orientações e prescrição
  selecionada. Sem alunos, contatos, avaliações, sessões ou preferências.
- Importação com prévia, escolha de aluno e IDs novos; adiciona cópias sem
  substituir rotinas, agenda ou histórico. Limite de 1 MB e validação integral
  pelo validador atual antes de gravar. Falha de armazenamento desfaz alterações.
- Módulo incluído no shell offline com chave nova para a versão RC.

Verificação: `node --test tests/routine-tools.test.cjs` (sete testes, incluindo
mil estoques comparados com busca exaustiva). Integração adicional em DOM simulado:
carregamento de todos os scripts sem exceções, favorito/filtro, formulário de
estoque, calculadora, importação com prévia e confirmação, preservação de alunos,
rollback em falha de gravação e rejeição de prescrição avançada inválida.

Pendente: validação visual e fluxo em navegador real, em especial Android, antes
de declarar a etapa concluída. DOM simulado não comprova layout, download do
arquivo, instalação PWA ou cache real. A RC fica em branch de desenvolvimento;
a main permanece na Beta 1.5.2 das 37 mídias aprovadas.


## Etapa 4 — Beta 1.7 RC (primeira entrega)

Referência OpenGym consultada antes da implementação:
`8fb98b16861a2728652302a7e6e30c50548493a0`, arquivos
`frontend/src/lib/import-csv.js`, `muscles.js` e `muscle-targets.js`.
Implementação independente em `import-analysis.js`; nenhum catálogo muscular ou
arquivo de mídia do OpenGym foi incorporado.

### Importador de histórico CSV

- Cabeçalhos PT-BR do EvoluPersonal e aliases Strong/Hevy. Apenas datas ISO,
  carga em kg/unidades explícitas do EvoluPersonal, duração em segundos e
  distância em km. Não converte libras nem adivinha datas regionais.
- Aspas, escape de aspas, campos com quebra de linha, BOM, CRLF e separador
  vírgula/ponto e vírgula. Rejeita arquivo incompleto ou linhas deslocadas.
- Limites: 2 MB, 5.000 séries e 100 nomes de exercícios distintos por lote.
- Prévia, escolha de aluno e associação manual dos exercícios não reconhecidos.
  Associação automática só por ID MD existente ou nome normalizado exato e único.
- Preserva unidades declaradas e cargas não informadas (null). Rejeita valores
  fora de limites, metas de repetições no lugar de execução, tipos desconhecidos
  e blocos adicionais inválidos. Arquivo inteiro validado antes de gravar.
- Acrescenta sessões com IDs novos, sem alterar rotinas ou sessões existentes.
  Assinatura exata por aluno evita reimportação de sessões deste importador;
  sessões manuais anteriores não são consideradas duplicatas automaticamente.
- Falha de armazenamento desfaz a alteração. Cancelar não altera o histórico.
- CSV do EvoluPersonal agora inclui ID do exercício, unidade, tipo e ID da sessão.

### Distribuição muscular

Em Evolução/Ajustes, selecionar aluno e intervalo de datas para consultar séries
concluídas por grupo cadastrado no catálogo. Separa aquecimento/preparatórias,
cardio e exercícios sem grupo. Série unilateral conta uma vez; blocos de técnica
não multiplicam séries. O resultado é por grupos amplos (Peito, Costas, Pernas,
Ombros, Braços, Core), sem inventar músculos secundários ou pesos de participação.
Não oferece faixas ideais nem diagnóstico de desequilíbrio.

### Verificação e limites

Treze testes automatizados das etapas 3/4 passaram, incluindo 1.000 estoques de
anilhas. Teste de DOM adicional: importação CSV pela tela, associação exata,
reimportação sem duplicação, rollback de gravação, validação do banco completo,
análise por período e releitura do CSV exportado. Recursos da etapa 3 passaram
na regressão. Corrigida também a preservação de superséries nos arquivos de rotinas.

A etapa 4 está iniciada, não encerrada. Permanecem a homologação visual em Android,
o fluxo de arquivos em navegador real, o cache offline real e testes com arquivos
reais de terceiros (os testes atuais usam exemplos controlados). A pendência de
Android da etapa 3 não foi considerada concluída para iniciar esta implementação.
A main permanece na Beta 1.5.2; o trabalho das etapas 3/4 está em branches.


## Etapa 5 — Beta 1.8 RC e revisão posterior

Referência OpenGym consultada na revisão
`8fb98b16861a2728652302a7e6e30c50548493a0`:
`frontend/src/lib/remote.js` e `sync-merge.js`. Implementação própria em
`remote-tools.js` e `remote-server/`, sem copiar a biblioteca de exercícios.

### Implementado

- Configuração de serviço HTTPS, credencial do personal somente em memória,
  publicação por aluno e controle de revisão otimista; conflito retorna 409 e
  não sobrescreve a versão remota automaticamente.
- Convites individuais aleatórios, hash no servidor, expiração de 14 dias,
  renovação que invalida o anterior, revogação e exclusão da cópia remota.
- Página própria do aluno com séries por repetições, tempo ou cardio, registro
  por lado e blocos de técnicas; preserva a prescrição publicada por revisão.
- Rascunho local restaurável, fila local de sessões e envio idempotente. Registros
  de revisão anterior continuam aceitos. A confirmação precisa corresponder ao ID
  enviado antes de retirar o registro da fila.
- Recebimento aditivo pelo personal; valida o banco antes de gravar e desfaz a
  alteração em falha de armazenamento. Recibos impedem reimportação após exclusão
  local. O vínculo com a rotina local é preservado quando ela ainda existe.
- API HTTP implementada e testada com persistência em arquivo; cabeçalhos CORS
  restritos, comparação de credenciais, limites de solicitação e de taxa.
- Shell separado do aluno, sem cache de respostas da API. Somente a prescrição,
  rascunho e fila próprios ficam no armazenamento local do navegador.

### Bugs corrigidos na revisão

1. Importação de rotinas aceitava campos avançados inconsistentes até chegar ao
   validador global. A leitura agora valida plano, contagem de séries, unidade,
   modo, referências, técnicas e progressão antes de importar ou publicar.
2. Resumo de evolução somava unidades incompatíveis. O resumo, recordes e gráfico
   semanal agora usam uma unidade selecionada; CSV e PDF identificam as unidades.
3. Séries concluídas sem carga conhecida eram omitidas dos indicadores. Elas
   permanecem no histórico e na contagem, sem inventar volume ou estimativa de 1RM.
4. A cópia externa `insights.js` estava divergindo do código inline. O módulo passou
   a ser a fonte única carregada pelo PWA, com teste de regressão para CSV e unidades.
5. No novo fluxo remoto, foram corrigidos troca de convite com dados antigos,
   proteção de rascunho, recuperação de dados locais ilegíveis, validação de
   recibos, vínculo da sessão à rotina e preservação de acesso durante operações.

### Verificação

`npm test`: 17 testes automatizados, incluindo 1.000 estoques de anilhas comparados
com busca exaustiva. API HTTP real testada para autenticação, origem rejeitada,
isolamento entre alunos, expiração/revogação, revisão concorrente, replay igual,
replay divergente, datas inválidas, séries fora do plano e gravação persistente.

`npm run test:dom`: fluxo em DOM simulado do PWA do personal com publicação,
convite e recebimento pela API HTTP local; regressão de favoritos, equipamentos,
CSV e rotinas. Fluxo do aluno testado com restauração de rascunho, perda de rede,
fila persistida, reconexão e envio sem duplicação. Credencial do personal não
aparece no backup. Os testes usam exclusivamente dados fictícios.

### Pendências preservadas

Não foi provisionado servidor público. Faltam domínio HTTPS, armazenamento
persistente/backup homologado, teste real dos service workers e validação visual
em Android. O servidor desta RC exige uma única instância por arquivo e não faz
criptografia em repouso. Não há sincronização de exclusões/edições ou multi-personal.
As pendências de dispositivos das etapas 3 e 4 continuam abertas.

A etapa 5 está implementada para homologação local, não declarada concluída em
produção. A main permanece na Beta 1.5.2; esta entrega fica em branch própria.
