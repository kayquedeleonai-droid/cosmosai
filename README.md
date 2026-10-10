# Cosmos AI

Base de um estúdio nodal de criação, com React, TypeScript, React Flow e Firebase. Interface em português. O editor funciona sem conta e sem chamadas pagas.

## Projeto conectado

Projeto Firebase: `cosmosai-1e2d6`. App Web: `Cosmos AI Web`. Site: https://cosmosai-1e2d6.web.app. A configuração pública está em `.env.local`, ignorada pelo Git. Login Google e e-mail/senha já foram provisionados pelo Firebase CLI. `.firebaserc` seleciona este projeto. A configuração administrativa de Authentication, com e-mail de suporte, fica em `.firebase-auth.local.json`, ignorada pelo Git, e pode ser reaplicada com `npx -y firebase-tools@latest deploy --only auth --config .firebase-auth.local.json`.

Para comandos Firebase, use `npx -y firebase-tools@latest` (não é necessário instalar globalmente). A autenticação do CLI fica no perfil do sistema, fora do repositório. Não copie códigos de autorização ou credenciais de conta de serviço para os arquivos do app.

## O que funciona

- Login com visual espacial, painel de workflows, pastas/álbuns e galeria.
- Canvas com zoom, pan, nodes arrastáveis, duplicação, exclusão e menu pesquisável via botão +, clique direito ou Ctrl+K.
- Nodes de prompt, upload de imagem, geração demonstrativa, upscale demonstrativo e resultado para download.
- Conexões tipadas, uma entrada por node e bloqueio de ciclos.
- Execução em ordem de dependência, com validação das entradas.
- Vários workflows salvos no navegador por conta; exportação/importação JSON e migração do projeto local da versão anterior.
- Resultados de demonstração persistidos no workflow e exibidos na galeria.
- Login Google, cadastro/entrada por e-mail e recuperação de senha via Firebase Authentication.
- Gravação e listagem de projetos no Firestore; sincronização da nuvem ao entrar na conta.
- CI no GitHub e workflow manual de publicação no Firebase Hosting.

**Geração e upscale são demonstrações.** A geração retorna uma ilustração SVG fixa; upscale repassa a imagem sem ampliá-la. Nano Banana Pro é uma identificação visual de integração futura, não uma chamada real. Os nodes Seedance/VEO armazenam a etapa de vídeo, mas bloqueiam a execução enquanto não houver API. Login Apple está desabilitado e identificado como indisponível. Nenhuma API de IA está conectada. Uploads ficam no JSON e no armazenamento local (até 1,5 MB por imagem); projetos na nuvem têm limite conservador de 650 KB. Para produção, mover mídias para armazenamento de objetos e persistir referências.

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
- Repository variables: os quatro campos `VITE_FIREBASE_*` do `.env.example`.
- Environment secret `FIREBASE_SERVICE_ACCOUNT`: credencial JSON de uma conta de serviço autorizada a publicar Hosting no projeto. Cadastre diretamente nos Secrets do GitHub, nunca em arquivos versionados ou no chat.

O workflow publica somente Hosting. Regras do Firestore são publicadas separadamente conforme acima. GitHub Actions não foi executado até haver push e configuração da conta.

## Próxima etapa: APIs reais

Adicionar um executor no servidor (por exemplo Firebase Cloud Functions) com verificação de Firebase ID token, App Check, lista permitida de modelos, validação de inputs, quotas por usuário, limite de concorrência e idempotência por execução. As chaves privadas dos provedores ficam em Secret Manager. O frontend envia o grafo e acompanha a execução, sem conter chaves de IA em `VITE_*` ou localStorage. Este backend **ainda não foi implementado**.

## Custos

Firebase Hosting e Firestore oferecem cotas gratuitas. O subdomínio do Firebase permite começar sem domínio próprio. Cloud Functions exige plano Blaze; armazenamento, tráfego, banco e processamento podem gerar custos conforme o uso. Não é possível garantir que domínio e APIs serão os únicos custos em produção. Configure alertas de orçamento e limites no executor; alertas não são bloqueio de gastos.

Fontes oficiais: https://firebase.google.com/pricing e https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## Limitações desta base

O salvamento automático é local; o botão Salvar na nuvem envia o workflow ao Firestore. Pastas vazias e notas de feedback ficam apenas neste navegador; a pasta atribuída a um workflow acompanha seu JSON na nuvem. Sem colaboração simultânea, fila de geração, cobrança, histórico de versões, armazenamento de mídia externo ou provedores de IA reais. Administração de usuários não foi implementada; não há privilégio de administrador concedido apenas pela interface. Resultados grandes podem exceder a cota de armazenamento local; exporte um backup quando o aplicativo avisar.

## Identidade visual

Interface escura com ciano e conexões magenta, baseada nas referências fornecidas. O fundo espacial é um SVG original gerado por `node scripts/create-universe.mjs`. A marca usa Orbitron; interface usa Inter, com fontes de fallback locais. Nenhuma imagem de referência é carregada de servidores externos.
