# Cosmos AI

Base de um estúdio nodal de criação, com React, TypeScript, React Flow e Firebase. Interface em português. O editor funciona sem conta e sem chamadas pagas.

## Projeto conectado

Projeto Firebase: `cosmosai-1e2d6`. App Web: `Cosmos AI Web`. Site: https://cosmosai-1e2d6.web.app. A configuração pública está em `.env.local`, ignorada pelo Git. Login Google e e-mail/senha já foram provisionados pelo Firebase CLI. `.firebaserc` seleciona este projeto. A configuração administrativa de Authentication, com e-mail de suporte, fica em `.firebase-auth.local.json`, ignorada pelo Git, e pode ser reaplicada com `npx -y firebase-tools@latest deploy --only auth --config .firebase-auth.local.json`.

Para comandos Firebase, use `npx -y firebase-tools@latest` (não é necessário instalar globalmente). A autenticação do CLI fica no perfil do sistema, fora do repositório. Não copie códigos de autorização ou credenciais de conta de serviço para os arquivos do app.

## O que funciona

- Login com visual espacial, painel de workflows, pastas/álbuns e galeria.
- Canvas com zoom, pan, nodes arrastáveis, duplicação, exclusão e menu pesquisável via botão +, clique direito ou Ctrl+K.
- Nodes de prompt, upload de imagem, geração Runware, upscale demonstrativo e resultado para download.
- Conexões tipadas, entradas separadas para prompt e referência e bloqueio de ciclos.
- Execução em ordem de dependência, com validação das entradas.
- Vários workflows salvos no navegador por conta; exportação/importação JSON e migração do projeto local da versão anterior.
- Resultados de geração persistidos no workflow e exibidos na galeria.
- Login Google, cadastro/entrada por e-mail e recuperação de senha via Firebase Authentication.
- Gravação e listagem de projetos no Firestore; sincronização da nuvem ao entrar na conta.
- CI no GitHub e workflow manual de publicação no Firebase Hosting.

Geração real de imagens e vídeos via Runware, com chave exclusiva guardada como segredo no Cloudflare Worker. Modelos: Nano Banana Pro, GPT Image 2.5 Sunburst/Flare, Seedream 5.0 Pro, Seedance 2.5 e VEO 3.1. Upscale permanece demonstrativo e não pode integrar um fluxo pago; Apple está indisponível. Uploads ficam no JSON local (até 1,5 MB); projetos na nuvem têm limite de 650 KB. URLs de resultados dependem da retenção do provedor: baixe os arquivos importantes.

## Desenvolvimento

Node.js 22+ e pnpm 11.25.0:

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Abra o endereço informado pelo Vite. A demo não precisa de `.env`.

## Conectar Firebase

1. Crie ou escolha um projeto no console Firebase e registre um app Web.
2. Copie `.env.example` para `.env.local` e preencha os quatro campos com a configuração pública do app Web.
3. Em Authentication, ative o provedor Google e autorize `localhost` e o domínio de produção.
4. Crie o banco Cloud Firestore e publique as regras deste repositório **antes de usar o app na nuvem**.
5. Autentique o Firebase CLI com `npx -y firebase-tools@latest login` e execute, substituindo `SEU_PROJECT_ID`:

```sh
npx -y firebase-tools@latest deploy --only firestore:rules --project SEU_PROJECT_ID
pnpm build
npx -y firebase-tools@latest deploy --only hosting --project SEU_PROJECT_ID
```

Os projetos são isolados em `users/{uid}/projects/{projectId}`. As regras permitem acesso apenas ao dono autenticado. A compilação das regras foi validada pelo Firebase CLI com `deploy --only firestore --dry-run` no projeto remoto. Essa validação de sintaxe não substitui testes de autorização com Emulator Suite antes de uma abertura ampla ao público.

## GitHub → Firebase Hosting

Repositório pretendido: https://github.com/kayquedeleonai-droid/cosmosai

O workflow `Validate app` testa e compila cada push/PR. O workflow `Publish to Firebase Hosting` é acionado manualmente em Actions depois de configurar:

- Environment `production` e suas proteções.
- Repository variables: os quatro campos `VITE_FIREBASE_*` e `VITE_RUNWARE_API_URL` do `.env.example`.
- Environment secret `FIREBASE_SERVICE_ACCOUNT`: credencial JSON de uma conta de serviço autorizada a publicar Hosting no projeto. Cadastre diretamente nos Secrets do GitHub, nunca em arquivos versionados ou no chat.

O workflow publica somente Hosting. Regras do Firestore são publicadas separadamente conforme acima. GitHub Actions não foi executado até haver push e configuração da conta.

## Backend Runware

Worker: https://cosmos-runware.kayquedeleonai.workers.dev. Firebase continua responsável por login, projetos e Hosting; não é necessário ativar Blaze para este executor.

O Worker valida o ID token Firebase (conta com e-mail verificado), origem, modelo, prompt e referências. D1 reserva a cota atomicamente e registra cada taskUUID, evitando reenviar uma criação em caso de resposta perdida. O cliente salva a tarefa antes de enviá-la e permite consultar pendências após recarregar. Segredos nunca usam prefixo VITE_ nem entram no Git.

Limites iniciais por dia UTC: 10 unidades por usuário, 20 no total. Imagem custa 1 unidade; vídeo, 10. Esses limites controlam quantidade, não dólares; Runware cobra seus créditos conforme o modelo. Erros também reservam a cota para evitar novas cobranças em situações ambíguas.

```sh
pnpm dlx wrangler login
pnpm dlx wrangler d1 execute cosmos-runware --remote --file worker/schema.sql --config worker/wrangler.jsonc
pnpm dlx wrangler secret put RUNWARE_API_KEY --config worker/wrangler.jsonc
pnpm dlx wrangler deploy --config worker/wrangler.jsonc
```

Na reprodução em outra conta, crie seu D1 e substitua database_id em worker/wrangler.jsonc. Cadastre a chave diretamente no prompt seguro do Wrangler ou no painel Cloudflare como Secret. Configure VITE_RUNWARE_API_URL antes de compilar o frontend. Os testes usam um banco SQLite e provedor simulado, sem créditos reais.

## Custos e limitações

Cloudflare Workers/D1 estão no plano gratuito e sujeitos às respectivas cotas. Runware continua pago por uso. Não ativamos plano pago de infraestrutura. Documentação: https://developers.cloudflare.com/workers/platform/limits/ e https://developers.cloudflare.com/d1/platform/pricing/.

O salvamento automático é local; Salvar na nuvem envia o workflow ao Firestore. Pastas vazias e feedback ficam no navegador. Sem colaboração simultânea, cobrança de usuários, histórico de versões ou armazenamento próprio de mídia. Limites globais evitam consumo ilimitado, mas qualquer conta verificada pode consumir a cota disponível. Administração de usuários não está implementada.

## Identidade visual

Interface escura com ciano e conexões magenta, baseada nas referências fornecidas. O fundo espacial é um SVG original gerado por `node scripts/create-universe.mjs`. A marca usa Orbitron; interface usa Inter, com fontes de fallback locais. Nenhuma imagem de referência é carregada de servidores externos.


## Administração e confiabilidade

- O administrador é determinado pelo UID verificado no Worker (`ADMIN_UID`), nunca por dados enviados pelo navegador. Contas novas ficam pendentes para geração. Aprovação/bloqueio afeta novas gerações; não desativa o login Firebase nem impede exportação dos workflows.
- Admin controla orçamento diário global/por conta e pausa geral. Limites em unidades existentes continuam válidos. Dia UTC. A reserva em USD é atômica no D1 e conciliada com o custo retornado pela Runware; preços tokenizados podem exceder a reserva. Não equivale a um limite de faturamento garantido pelo provedor.
- Histórico guarda parâmetros, identificação e custo das tarefas. Um cron a cada 2 minutos consulta até 10 tarefas pendentes das últimas 48 horas; nunca reenvia uma criação. Após 48 horas a consulta manual continua disponível.
- Salvamento automático na nuvem após 2,5 segundos sem alterações, com verificação transacional de conflitos. Até 10 versões em slots de 5 minutos. Versões e projetos são privados ao proprietário. Restauração exporta primeiro uma cópia local.
- Gerar um node reutiliza resultados existentes dos nodes de entrada. Gerar fluxo executa o fluxo completo. Desfazer/refazer guarda até 20 edições nesta sessão.
- Não há armazenamento permanente de mídia: os links Runware podem expirar. Baixe resultados importantes. R2 não foi ativado.
- Implantação existente: executar `worker/migration-002.sql` **uma única vez**, depois publicar Worker e regras Firestore antes do frontend. Instalação nova usa `worker/schema.sql` diretamente.
- Tarifas de referência: `src/pricing.mjs`, conferidas na documentação Runware em 2026-10-10. Rever quando o fornecedor alterar valores; exemplos típicos de GPT não são cotações garantidas.
