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

A senha segue a RN25 (10 a 64 caracteres, limite de 72 bytes do bcrypt).

---

## Rotas

| Prefixo | Quem acessa |
|---|---|
| `/api/v1/auth` | público (login) |
| `POST /api/v1/students` | público (cadastro) |
| `PATCH /api/v1/students` | autenticado |
| `/api/v1/admin/*` | administradores apenas |

> `PATCH /api/v1/students` hoje só tem `authenticate`, sem `authorize(STUDENT)` — um token de admin alcança o service. Pendência conhecida da TASK 03.

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

- **Código em inglês, mensagens de erro em português** — o usuário final é brasileiro, e a RN23 exige a string exata `"E-mail ou senha inválidos"`.
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
