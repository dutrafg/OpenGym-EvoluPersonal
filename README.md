# OpenGym EvoluPersonal · Beta 1

PWA estático para personal trainers: alunos, rotinas, sessões, avaliações, agenda, anamnese, acompanhamentos e relatórios.

## Estado da Beta 1

- Catálogo oficial com 500 exercícios.
- 445 exercícios têm GIF próprio associado.
- 25 associações OpenExerciseBase usam 24 arquivos de referência distintos.
- 13 novas associações externas foram adicionadas como candidatas para conferência visual; nenhuma foi marcada automaticamente como aprovada.
- 37 exercícios antes sem mídia receberam ilustrações estáticas originais em duas posições, aprovadas visualmente pelo usuário. Use o filtro **Ilustrações aprovadas (37)** na Biblioteca. O download offline inclui os 37 arquivos locais.

A Beta 1 é adequada para validação. A aprovação visual das 37 ilustrações foi registrada; a conferência das candidatas externas e a validação biomecânica permanecem separadas dessa aprovação.

## Arquivos do PWA

Os arquivos estão separados na raiz para implantação estática:

- `index.html`: interface e lógica do aplicativo.
- `manifest.webmanifest`: identidade, ícones e instalação.
- `sw.js`: cache do aplicativo, mídia offline e atualização.
- `offline-assets.json`: catálogo de mídias para baixar.
- `icons/`: ícones de instalação.
- `training-methods.js`, `insights.js`, `programs.js`: módulos auxiliares.
- `OFFLINE_CREDITS.md`: atribuições.
- `vercel.json`: cabeçalhos PWA e encaminhamento das mídias.

Os GIFs e imagens principais são referenciados pela revisão imutável `b224519ac23473e0e13f4f74e29b6e70e1ce6f01` do repositório EvoluPersonal. O service worker baixa os arquivos para uso offline. As fontes externas permitidas também podem ser baixadas pelo botão da Biblioteca.

## Publicar no Vercel

Importe este repositório e use a raiz do projeto, framework **Other**, sem comando de build e com a saída na raiz. O app deve ser publicado por HTTPS para permitir instalação e uso offline.

Na primeira abertura, conecte-se à internet. Depois, em **Biblioteca**, toque em **Baixar biblioteca offline** e aguarde o término do download. Os dados dos alunos ficam no navegador deste dispositivo; exporte backups JSON regularmente. Instalar o PWA em outro aparelho não transfere os dados.

## Atualizações

O service worker atualiza o shell sem trocar o espaço de cache v3, preservando os arquivos da biblioteca que já foram baixados. Depois de detectar uma nova versão, use **Ajustes → Verificar atualização** e recarregue o app quando solicitado.

## Verificações realizadas

Foram verificados os 12 scripts inline, o service worker, os arquivos JSON do PWA, os dez arquivos de shell e as dimensões/assinaturas dos três ícones PNG. A validação final em dispositivos Android e desktop depende da publicação HTTPS.

## Arquivos históricos

`Fork-OpenGym-Fase2-3.patch` permanece como registro do trabalho anterior. Não é necessário para implantar este PWA.

## Beta 1.5.2 · mídias aprovadas

O lote está em `media/approved-37/`, com IDs MD preservados e manifesto de associação. California Press (md414) e Razor Curl (md240) usam as versões refeitas. O shell foi atualizado sem apagar o cache das mídias anteriores.

## Etapa 3 · Beta 1.6 RC

Em desenvolvimento: favoritos na Biblioteca e no editor de treino, estoque de
anilhas e peso da barra em **Ajustes → Equipamentos**, cálculo de montagem e
compartilhamento por arquivo JSON em **Treinos → Compartilhar/Importar rotinas**.
A importação pede um aluno e adiciona cópias; o histórico e as rotinas existentes
são preservados. Revise as orientações livres antes de compartilhar.

Testes: `node --test tests/routine-tools.test.cjs`.
Validação visual em Android ainda pendente; não é uma etapa encerrada.

## Etapa 4 · Beta 1.7 RC

Primeira entrega em desenvolvimento: **Evolução → Importar histórico CSV** e
**Séries por grupo muscular**, também disponíveis em Ajustes. A importação pede
aluno, associações e unidades antes de gravar; apenas acrescenta sessões e ignora
reimportações idênticas deste importador no mesmo aluno. Datas ISO, kg, segundos
e km; cabeçalhos PT-BR e aliases Strong/Hevy, sem garantia de todos os formatos
regionais desses aplicativos. Consulte `DEVELOPMENT.md` para limites.

Verificação: `node --test tests/*.test.cjs`. Validação real em Android pendente.
