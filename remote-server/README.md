# Serviço remoto — Beta 1.8 RC

Este é um serviço opcional para **um personal e seus alunos**. O PWA do personal
continua funcionando localmente sem ele. O acesso do aluno é uma página separada
em `/student/`, servida pelo próprio serviço.

## Executar e testar

Testado com Node.js 24. O servidor usa apenas módulos nativos; não precisa instalar
dependências para iniciar. Na raiz do projeto:

```sh
node --test tests/*.test.cjs
```

Para os testes adicionais de interface em DOM simulado:

```sh
npm ci
npm run test:dom
```

Defina as variáveis de ambiente antes de executar `npm run start:remote`:

| Variável | Finalidade |
| --- | --- |
| `REMOTE_COACH_TOKEN` | Segredo aleatório do personal, mínimo de 32 caracteres; letras, números, `_` e `-`. Não coloque no código ou no Git. |
| `REMOTE_DATA_FILE` | Caminho absoluto do arquivo persistente de dados. O padrão local é `remote-server/data/state.json`. |
| `REMOTE_ALLOWED_ORIGINS` | Origens HTTPS exatas do PWA do personal, separadas por vírgula, sem caminho nem barra final. |
| `HOST` | Padrão `127.0.0.1`. Configure conforme o proxy do servidor. |
| `PORT` | Porta local; padrão `8787`. |

Em Ajustes do PWA, abra **Acesso remoto**, informe a origem do serviço e a
credencial. Escolha o aluno, publique a prescrição e crie o convite. O botão de
convite apenas apresenta o link; o aplicativo não envia mensagens ao aluno.
Depois, **Receber sessões** acrescenta os registros enviados ao histórico local.

## Publicação

É necessário hospedar este processo em um servidor com disco persistente e HTTPS
por proxy reverso. Execute **uma única instância por arquivo de dados**. Não use
este armazenamento em um serviço com disco temporário ou várias réplicas.
O deploy estático do PWA na Vercel não inicia este servidor.

Mantenha o arquivo de dados fora de diretórios públicos e faça backups dele.
As gravações usam substituição atômica e arquivo com permissão restrita no sistema
operacional; o conteúdo não é criptografado em repouso por este módulo. Não copie
`remote-server/data/` para uma hospedagem estática. A pasta está no `.gitignore`.

Nenhum servidor de produção foi provisionado por esta entrega. HTTPS real,
restauração de backup do servidor e uso em Android ainda precisam de homologação.

## Dados e controles

- Publica somente nome, prescrição e orientações livres do treino. Revise as
  orientações antes de enviar; elas podem conter dados digitados pelo personal.
- Não publica contatos, fotos, anamnese, avaliações ou dados financeiros.
- Credencial do personal fica na memória da aba; não entra no backup local.
- Convites são individuais, aleatórios, válidos por 14 dias e revogáveis. Criar
  outro convite substitui o anterior. O servidor guarda apenas seu resumo hash.
- O link de convite é uma credencial. O aluno o recebe no fragmento da URL, que
  é retirado da barra depois da abertura. O acesso da aba usa `sessionStorage`.
- Revogar impede novas consultas e envios; não apaga cópias já baixadas no aparelho.
- O aluno registra séries completas ou uma sessão parcial. Rascunhos e fila são
  locais. Após receber a página uma vez, o service worker prepara o shell offline;
  a disponibilidade real deve ser conferida no navegador de destino.
- Cada sessão tem um ID estável. Reenvio igual é aceito uma vez; o mesmo ID com
  conteúdo diferente retorna conflito e preserva a fila.
- Prescrições anteriores permanecem no servidor para receber sessões iniciadas
  antes de uma atualização. O serviço não altera a prescrição do personal por
  registros recebidos e não sincroniza exclusões ou edições de histórico.
- Recebimento é aditivo. Recibos locais impedem importar novamente uma sessão
  remota que já tenha sido recebida e depois removida localmente.
- **Apagar cópia remota** remove prescrição, convites e sessões desse aluno do
  serviço; os dados locais não são apagados. Receba as sessões desejadas antes.

## Limites desta RC

Não há cadastro de vários personais, recuperação de conta, autenticação biométrica,
notificações push nem publicação automática. Não substitui a homologação de
segurança e de dispositivos antes de uso real com alunos. O arquivo JSON deve ser
substituído por um banco transacional apropriado se o serviço precisar de múltiplas
instâncias ou de volume elevado de dados.
