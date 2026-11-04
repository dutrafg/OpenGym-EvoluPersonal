# OpenGym EvoluPersonal · Alpha 0.21

Aplicativo web instalável para personal trainer: alunos, rotinas, sessões, avaliações, agenda, anamnese, acompanhamentos e relatórios.

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

Os GIFs e imagens ficam no repositório EvoluPersonal e são referenciados pela revisão de origem `b224519ac23473e0e13f4f74e29b6e70e1ce6f01`. O service worker os baixa diretamente para o cache offline. Assim, este repositório mantém o app separado da biblioteca de mídia, sem depender de uma pasta local `assets/` no Vercel.

## Publicar no Vercel

Importe este repositório. Use a raiz do projeto, framework **Other**, sem comando de build e com a saída na raiz. O app precisa ser publicado por HTTPS para permitir instalação e uso offline.

Na primeira abertura, conecte-se à internet. Depois, em **Biblioteca**, toque em **Baixar biblioteca offline** e aguarde o término do download. Os dados dos alunos ficam no navegador deste dispositivo; exporte backups regularmente.

## Arquivos históricos

`Fork-OpenGym-Fase2-3.patch` permanece como registro do trabalho anterior. O bundle de origem citado nas instruções antigas não está na `main`; nenhum dos dois arquivos é necessário para implantar o PWA estático.
