# OpenGym EvoluPersonal · Beta 1

PWA estático para personal trainers: alunos, rotinas, sessões, avaliações, agenda, anamnese, acompanhamentos e relatórios.

## Estado da Beta 1

- Catálogo oficial com 500 exercícios.
- 445 exercícios têm GIF próprio associado.
- 25 associações OpenExerciseBase usam 24 arquivos de referência distintos.
- 13 novas associações externas foram adicionadas como candidatas para conferência visual; nenhuma foi marcada automaticamente como aprovada.
- 37 exercícios ainda não têm mídia nem candidato ativo. Use o filtro **Sem mídia vinculada** na Biblioteca.

A Beta 1 é adequada para validação. Os 37 casos sem mídia e a conferência visual das candidatas continuam pendentes antes de uma versão estável.

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
