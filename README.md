# Estagia CG — back-end

API da plataforma de vagas de estágio: estudantes se candidatam, responsáveis publicam vagas por suas empresas e administradores mantêm cursos, modalidades e contas.

Node 22 · TypeScript 5.9 · Express 5 · TypeORM · PostgreSQL 15 · Vitest

O documento de requisitos está em [`docs/`](docs/), e o plano de tarefas em [`docs/TASKS.md`](docs/TASKS.md).

---

## Subindo o projeto

A aplicação roda **dentro do Docker**. O `.env` aponta `DB_HOST` para o nome do serviço do compose (`db-vagas`), que não resolve a partir da sua máquina — por isso `npm run dev` direto no host não funciona sem alterar o `.env`.

```bash
cp .env.example .env     # preencha as senhas
docker compose up -d --build
```

| Serviço | No host | No container |
|---|---|---|
| API | http://localhost:3001 | `3000` |
| Swagger | http://localhost:3001/api-docs | — |
| Postgres (dev) | `localhost:5436` | `db-vagas:5432` |

As portas do host são 3001 e 5436 para não conflitarem com outros projetos da máquina. A porta interna é sempre a padrão — quem traduz é o mapeamento `host:container` no `docker-compose.yml`.

> O log da aplicação imprime `http://0.0.0.0:3000`, que é a visão de dentro do container. No navegador, use a porta do host.

### Criando o schema

`synchronize` é `false` em todos os ambientes: o schema vem sempre de migration.

```bash
docker exec -it api_estagio_vagas npm run migration:run
```

### Primeiro administrador

Não há cadastro público de admin. O primeiro é criado por script, com as credenciais vindas do ambiente:

```bash
docker exec -it api_estagio_vagas env \
  ADMIN_NAME="Nome Sobrenome" \
  ADMIN_EMAIL="admin@exemplo.com" \
  ADMIN_PASSWORD="uma-senha-de-10-a-64-chars" \
  npm run seed:admin
```

A senha segue a RN-A5 (10 a 64 caracteres, limite de 72 bytes do bcrypt).

---

## Rotas

| Prefixo | Quem acessa |
|---|---|
| `/api/v1/auth` | público (login) |
| `POST /api/v1/students` | público (cadastro) |
| `/api/v1/students/me/*` | candidatos apenas |
| `GET /api/v1/courses` | público (lista de cursos) |
| `POST /api/v1/advertisers` | público (cadastro de anunciante) |
| `/api/v1/advertisers/me/*` | responsáveis apenas |
| `/api/v1/admin/*` | administradores apenas |

Rotas do próprio perfil:

| rota | o que faz |
|---|---|
| `GET /api/v1/students/me` | perfil próprio, **com CPF completo** (Anexo A) |
| `PATCH /api/v1/students/me` | nome, telefones, cidade, escolaridade, visibilidade, perfil profissional |
| `PATCH /api/v1/students/me/password` | troca de senha; exige a atual e **encerra todas as sessões** (RN-A3) |
| `GET/POST /api/v1/students/me/formations` | formações do candidato (RF11) |
| `PATCH/DELETE /api/v1/students/me/formations/:id` | edita ou remove uma formação |

As formações ficam sob `/me` de propósito: o dono vem da sessão, então **não existe caminho para alcançar a formação de outra pessoa**. A posse é filtro de banco (`WHERE student_id = :sessão`), não checagem no service — e por isso a formação alheia responde 404, não 403: dentro do escopo `/me` ela não existe, e um 403 confirmaria que aquele id existe em algum lugar.

Trocar o e-mail **não** passa pelo perfil: tem fluxo próprio, com confirmação.

Recuperação de senha e troca de e-mail:

| rota | sessão | o que faz |
|---|---|---|
| `POST /api/v1/auth/password-recovery` | não | pede o link. **Sempre 204**, exista ou não o e-mail |
| `POST /api/v1/auth/password-recovery/confirm` | não | redefine a senha e encerra todas as sessões |
| `POST /api/v1/auth/email-change` | sim | pede a troca; o link vai para o **endereço novo** |
| `POST /api/v1/auth/email-change/confirm` | não | conclui a troca e encerra todas as sessões |

Duas coisas que parecem detalhe e não são:

- O link da troca de e-mail vai para o **novo** endereço, nunca para o atual. É o que prova que a pessoa controla a caixa para a qual a conta vai passar — sem isso, quem achasse um navegador logado tomaria a conta e o dono perderia até o caminho de recuperação.
- A unicidade do e-mail (RN-A7) é conferida **no pedido e de novo na confirmação**. Entre os dois momentos, outra conta pode ter registrado o endereço.

### Autenticação

A API **não usa JWT**. O login devolve um token opaco de 256 bits, e a sessão vive no banco — é o que permite o logout encerrar de verdade e a desativação de uma conta cortar o acesso na requisição seguinte (RF01, RF20, RNF02).

Para o cliente, o uso é idêntico ao de um JWT:

```http
Authorization: Bearer <token>
```

O token não é decodificável: `accountId`, `role` e `idleTimeoutMinutes` vêm no corpo da resposta do login.

A sessão expira por **dois limites independentes** (RN-A3): 30 minutos **sem uso** e 8 horas desde o login. O segundo garante que uma sessão usada sem parar termine algum dia. Sair, trocar a senha ou ter a conta desativada encerra a sessão na hora.

Após **5 falhas seguidas** no mesmo e-mail, o login fica bloqueado por 15 minutos (RN-A4). A resposta do bloqueio é idêntica à de senha errada — qualquer diferença confirmaria ao atacante que o e-mail existe.

| variável | padrão | regra |
|---|---|---|
| `SESSION_IDLE_MS` | `1800000` (30 min) | RN-A3 |
| `SESSION_MAX_AGE_MS` | `28800000` (8 h) | RN-A3 |
| `LOGIN_MAX_ATTEMPTS` | `5` | RN-A4 |
| `LOGIN_BLOCK_MS` | `900000` (15 min) | RN-A4 |
| `RECOVERY_TOKEN_TTL_MS` | `1800000` (30 min) | RN-A6 |
| `INVITE_TOKEN_TTL_MS` | `259200000` (72 h) | RF22 |

### Tokens de uso único e e-mail

Links enviados por e-mail — recuperação de senha, convite de responsável e confirmação de troca de e-mail — usam a tabela `single_use_tokens`. Como nas sessões, **só o hash SHA-256 é guardado**: um banco vazado não entrega nenhum link utilizável.

Duas garantias que valem conhecer antes de mexer:

- **O token é consumido na mesma transação da ação que ele autoriza.** Se a ação falhar, o rollback desfaz a marcação e o link continua válido. Se der certo, ele morre junto. A linha é travada com `pessimistic_write`, então dois cliques no mesmo link não executam a ação duas vezes.
- **Um pedido novo invalida o anterior** do mesmo tipo e destinatário (RN-A6). Token inexistente, já usado e expirado são indistinguíveis para quem chama — qualquer diferença viraria um oráculo.

O envio passa por `IEmailSender`. Sem `SMTP_HOST` e `SMTP_USER` configurados, o container escolhe o `ConsoleEmailSender`, que escreve o e-mail no log — assim o primeiro `npm run dev` numa máquina nova não quebra no fluxo de recuperação. Os testes injetam o `TestEmailSender`, que guarda em memória.

---

### Anunciante e responsável

O **anunciante não faz login** — quem entra no sistema são seus **responsáveis** (um anunciante pode ter vários; cada responsável pertence a um só). Por isso as rotas são `/advertisers/me`: o vínculo vem da sessão do responsável.

- O documento é validado pelo dígito verificador — CNPJ para PJ, CPF para PF — e é único. Isso é o que impede a mesma empresa de ter dois cadastros e usar a vaga gratuita duas vezes (RN-P1).
- Todo anunciante nasce **pendente** de verificação (RN-V1) e, até ser verificado, só publica a vaga gratuita (RN-V4).
- **Trocar o nome de exibição ou a razão social de um anunciante verificado o devolve para pendente** (RF23): o selo foi dado àquele nome, senão bastaria ser verificado como padaria e virar financeira.
- O anunciante precisa ter sempre ao menos um responsável ativo (RN-VG8). Para encerrar, desativa-se o anunciante.

## Documentação da API

O Swagger fica em http://localhost:3001/api-docs e cobre as 24 rotas.

**Os corpos de requisição são gerados dos mesmos schemas Zod que validam**, via `z.toJSONSchema` (Zod 4, alvo `openapi-3.0`), registrados em [`src/shared/docs/components.ts`](src/shared/docs/components.ts). Documentação escrita à mão mente em silêncio — alguém muda o validator, o comentário fica para trás, e o front confia no que está errado. Gerando da mesma fonte, a divergência deixa de ser possível.

O que o Zod não sabe — caminho, método, respostas de erro, quem precisa de token — fica em anotações `@swagger` junto de cada rota.

**Rota nova sem documentação quebra a suíte.** O teste `test/shared/swagger-coverage.test.ts` conta as rotas registradas no Express e compara com as operações documentadas. Ele não aponta qual ficou de fora (o Express 5 não expõe o prefixo de montagem de forma estável), mas falha com a contagem e o diff do commit mostra na hora.

---

## Testes

Os testes usam um Postgres próprio, na porta **5435**, isolado do banco de desenvolvimento. Um `.env.test` separado garante isso, e o setup aborta se `DB_DATABASE` não for `estagia_mais_test`.

```bash
npm run db:up:test     # sobe o Postgres de teste
npm test               # roda a suíte
npm run db:down:test   # derruba e apaga o volume
```

As migrations rodam **uma vez**, no `globalSetup`. Não as coloque em `setupFiles`: lá rodariam uma vez por arquivo de teste, em paralelo, e duas migrations simultâneas colidem ao criar a tabela `migrations`.

Pelo mesmo motivo, `fileParallelism: false` no `vitest.config.mts` — todos os arquivos compartilham um banco e cada um faz `TRUNCATE` no `beforeEach`.

---

## Migrations

Rode sempre dentro do container, onde o `node_modules` está completo:

```bash
docker exec -it api_estagio_vagas npm run migration:run
docker exec -it api_estagio_vagas npm run migration:revert
```

O script `migration:generate` tem o nome **`Init` fixo**, então serve só para a primeira. Para gerar uma com outro nome, chame o CLI direto:

```bash
docker exec -it api_estagio_vagas npx typeorm-ts-node-commonjs \
  migration:generate src/shared/database/migrations/AddCompany \
  -d src/shared/database/data-source.ts
```

As migrations são importadas **estaticamente** em `data-source.ts`, não por glob — sob o Vitest o TypeORM faria `require()` nos `.ts` e o Node não os parseia. **Ao criar uma migration nova, adicione a classe ao array `migrations`**, senão ela não roda nos testes.

Nunca edite uma migration já aplicada; crie outra.

---

## Estrutura

```
src/
  modules/<modulo>/
    schema/        entidades TypeORM (*.schema.ts)
    repository/    acesso a dados, 1 classe por agregado
    service/       regras de negócio
    controller/    HTTP, sem regra
    validators/    schemas Zod
    interfaces/    contratos dos repositórios
  shared/
    container/     injeção de dependências (buildContainer)
    database/      data-source, migrations, seeds
    middleware/    errorHandler, asyncHandler
    services/      PasswordHasher, EmailRegistry
```

Convenções:

- **Código em inglês, mensagens de erro em português** — o usuário final é brasileiro, e a RN-A1 exige a string exata `"E-mail ou senha inválidos"`.
- Senhas com bcrypt, custo mínimo 12 (RNF01), centralizado no `PasswordHasher`.
- Chaves primárias UUID; CPF e CNPJ são únicos, nunca chave.
- Desativação lógica (`active = false`), nunca exclusão física (RNF06).
- Datas em `timestamptz`, fuso `America/Campo_Grande`.

### Regras do candidato que valem conhecer

- **Idade mínima: 14 anos** (RN-C1), em `MIN_AGE_YEARS`, calculada no fuso de Campo Grande.
- **Visibilidade do perfil** (RN-C9): `oculto` (padrão), `so_verificados`, `publico`. **Menor de 18 não pode escolher `publico`** — travado no cadastro (validator) e na edição (service).
- **Link de currículo** (RN-C10): só `https` e só de domínios permitidos (Google Drive, OneDrive, Dropbox, LinkedIn, GitHub, Canva). O sistema **nunca armazena o arquivo**.
- **CPF** (Anexo A): o candidato vê o próprio, o administrador vê todos, o anunciante **nunca**. O helper `maskCpf` existe para a trava do anunciante (tasks 17 e 18).
- **Telefone é opcional** (RF10) e cada número carrega a marca de WhatsApp (RN-C11).

---

## Armadilhas conhecidas

**Mexeu no `package.json`? `--build` não basta.** O compose monta `/app/node_modules` como volume anônimo e o reaproveita ao recriar o container, sobrepondo o `node_modules` novo da imagem:

```bash
docker compose rm -sfv api-vagas && docker compose up -d --build
```

O `-v` aí remove só os volumes anônimos desse serviço. **Não use `docker compose down -v`** para isso — aquele apaga o volume nomeado do Postgres e você perde o banco.

**Confira o diretório antes de rodar comandos de Docker ou npm.** Este repositório convive com outros projetos na mesma máquina; um `down -v` no diretório errado apaga o banco do projeto errado.

**O TypeScript está fixado em 5.9.** O TypeScript 7 é o porte nativo em Go e não expõe `ts.sys`, de que o `ts-node` depende — com ele, `npm run dev`, `seed:admin` e todas as migrations quebram com `Cannot read properties of undefined (reading 'fileExists')`. Não suba para 7 sem antes trocar o `ts-node` por algo compatível, e note que `tsx`/esbuild não implementam `emitDecoratorMetadata`, de que o TypeORM depende.

**Arquivos gerados pelo container nascem com dono `root`.** A pasta `src/shared/database/migrations/` foi criada pelo container e pertence a `root`, então `migration:generate` rodado no host falha com `EACCES`. Ou gere sempre pelo container, ou devolva a pasta para o seu usuário:

```bash
sudo chown -R "$USER:$USER" src/shared/database/migrations
```

**`POSTGRES_DB` só vale na primeira inicialização.** Mudou `DB_DATABASE` e o banco "não existe"? O volume foi criado com o nome antigo. Recrie o volume do Postgres daquele projeto.
