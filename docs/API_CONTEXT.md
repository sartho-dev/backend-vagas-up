# EstagiaAqui API — Contexto para IAs e desenvolvedores

> Leia este arquivo inteiro antes de escrever qualquer código neste repositório.
> Ele descreve a arquitetura, as convenções e o "jeito de fazer" da API. Código novo
> deve ser indistinguível do código existente. Na dúvida, copie o padrão do módulo
> `course` (CRUD simples) ou `formation` (recurso do dono) e adapte.
>
> Este arquivo foi extraído do código real. Onde algo foi **inferido** (e não visto
> no código), está marcado como *(inferido)*. A seção 14 lista inconsistências
> existentes que **não** devem ser replicadas.

---

## 1. O que é o projeto

API REST de uma plataforma de vagas de emprego e estágio (Campo Grande/MS, com
expansão prevista). Três tipos de conta:

| Perfil (`AccountRole`) | Quem é | Tabela |
|---|---|---|
| `student` | Candidato | `students` |
| `responsible` | Pessoa que entra em nome de um anunciante (empresa/PF) | `responsibles` |
| `admin` | Administrador da plataforma | `admins` |

O **anunciante** (`advertisers`) é a empresa/PF que publica vagas; ele **não faz login**,
quem entra são os responsáveis. Os comentários do código citam requisitos do SRS
(`RF21`, `RN06`, `RNF01`, `RN-A4`...). O SRS não está no repositório: ao escrever
regra de negócio, cite o código do requisito no comentário quando o usuário informar.

### Stack

- Node.js + TypeScript, Express, TypeORM (PostgreSQL), Zod **v4**
- `helmet`, `cors`, `swagger-jsdoc` + `swagger-ui-express`, `nodemailer`, `bcrypt`, `multer`, `dotenv`
- Testes: Vitest *(inferido pelo `AppError.test.ts`; a pasta `test/` não veio no pacote)*
- `package.json` e `tsconfig` não vieram no pacote *(não invente scripts: o único citado no código é `npm run seed:admin`)*

### Formatação

2 espaços, aspas duplas, ponto e vírgula, vírgula final (estilo Prettier). Imports
**relativos** (sem alias de path). Identificadores em inglês; comentários e
mensagens ao usuário em português (ver seção 10).

---

## 2. Estrutura de pastas

```
main.ts                  # bootstrap: TZ → DataSource.initialize → buildContainer → App.listen
App.ts                   # Express: helmet, cors, json, trust proxy, /api-docs, routes, errorHandler
routes.ts                # monta /api/v1/<recurso> a partir do container

modules/
  <modulo>/
    controller/   XController.ts
    service/      XService.ts            (+ mappers: toProfileResult.ts)
    interfaces/   IXRepository.ts        (contrato + tipos de entrada/outcome)
    repository/   XRepository.ts         (TypeORM)
    schema/       X.schema.ts            (entidade TypeORM)
    types/        XTypes.ts, XEnums.ts   (DTOs de saída "XResult" e enums de domínio)
    validators/   XValidator.ts          (schemas Zod de entrada)
    providers/    XAuthProvider.ts       (só módulos que têm login)
    xRoutes.ts                           (Router + anotações @swagger)

shared/
  config/index.ts        # ÚNICO lugar que lê process.env
  container/index.ts     # composição de dependências (DI manual)
  database/
    data-source.ts       # entidades e migrations REGISTRADAS À MÃO
    migrations/          # geradas pelo TypeORM
    seeds/               # scripts (create-first-admin.ts)
  docs/                  # swagger.ts + components.ts (schemas gerados do Zod)
  errors/AppError.ts
  middleware/            # asyncHandler, errorHandler
  services/              # EmailRegistry, EmailSender, PasswordHasher, CalculatorBirthDate
  types/ApiResponse.ts
  utils/                 # hashToken, maskCpf
  validators/            # passwordSchema, documents (CPF/CNPJ)
```

Módulos atuais: `admin`, `advertiser` (+ `Responsible`), `auth`, `course`,
`formation`, `student`.

---

## 3. Arquitetura em camadas

```
Route ──► Controller ──► Service ──► IRepository (interface) ◄── Repository (TypeORM) ──► Schema/DB
            │               │
            │               └─ regras de negócio, orquestração, mapeamento p/ DTO, escolha do HTTP status de erro
            └─ parse Zod, getAuth(res), monta ApiResponse, status de sucesso
```

| Camada | Faz | **Não** faz |
|---|---|---|
| **Route** | Declara método/path, aplica `authenticate`/`authorize`, `.bind(controller)`, anotação `@swagger` | Lógica, validação |
| **Controller** | `schema.parse(req.*)`, lê `getAuth(res)`, chama **um** método do service, devolve `ApiResponse` | Regra de negócio, acesso a banco, `try/catch` |
| **Service** | Regras de negócio, checagens cruzadas, hash de senha, e-mail, `AppError`, mapeia `Entity → XResult` | Importar `Repository<T>`/TypeORM; conhecer `req`/`res` |
| **Interface** | Contrato do repositório + tipos de entrada (`CreateXData`) e de resultado (`XOutcome`) | — |
| **Repository** | Queries, transações, locks, tradução de erro de constraint do Postgres | Decidir status HTTP de regra de negócio |
| **Schema** | Entidade TypeORM, constraints, relações | Lógica |
| **Validator** | Schemas Zod de entrada + `z.infer` | Acesso a banco |

Regras de dependência:

- Service depende de **interfaces** (`IXRepository`), nunca da classe concreta nem de `Repository<T>`.
- Quem liga tudo é `shared/container/index.ts`. Não use `new` de repository/service fora dele (exceto testes).
- Módulo pode importar **schema/tipos/interfaces/validators** de outro módulo (ex.: `formation` importa `Course`, `EducationLevel`; `admin` reutiliza `emailSchema`/`nameSchema` do student). Não importe service/controller de outro módulo: injete pelo container.
- Dependência circular entre módulos resolve-se por interface pequena (ex.: `ISessionRevoker`, `IEmailLookup`, `IAuthAccountProvider`).

---

## 4. Contrato HTTP

### Prefixo e montagem
Tudo sob `/api/v1`. `routes.ts` monta: `/students`, `/auth`, `/advertisers`, `/courses`, `/admin`.

### Formato de resposta (`shared/types/ApiResponse.ts`)

```ts
// sucesso
{ "status": "success", "data": <T> }                 // + "message" opcional
// erro (errorHandler)
{ "status": "error", "message": "..." }
// erro de validação Zod (400)
{ "status": "error", "message": "Dados inválidos", "errors": [{ "field": "a.b", "message": "..." }] }
```

### Status codes

| Código | Uso |
|---|---|
| 200 | Leitura / atualização (com corpo) |
| 201 | Criação (com corpo) |
| 204 | Exclusão, logout, troca de senha, pedidos de e-mail — **sem corpo** (`res.status(204).send()`) |
| 400 | Zod inválido; senha atual errada (**não** 401, para o cliente não achar que a sessão expirou); link/token inválido; referência inexistente (FK 23503) |
| 401 | Sem token / sessão inválida / credencial inválida |
| 403 | Perfil sem permissão (`authorize`) ou proibição de regra de negócio |
| 404 | Não existe **ou não pertence ao dono** (nunca 403 nesse caso) |
| 409 | Duplicidade (e-mail, CPF, nome, documento) ou conflito de regra (ex.: "último admin ativo", curso em uso) |
| 500 | Erro não tratado (log do stack, mensagem genérica) |

### Paginação
Query `?page=1&pageSize=20&active=true|false`. Schema: `page` (`z.coerce.number().int().min(1).default(1)`),
`pageSize` (`max(100)`, default 20), `active` (`z.enum(["true","false"]).transform(...)`).
Resposta: `{ items, page, pageSize, total, totalPages }`. O repository devolve `{ items, total }` com
`findAndCount` e **ordenação total** (`{ createdAt: "ASC", id: "ASC" }`) para páginas estáveis.

---

## 5. Padrão de cada camada (com código)

Exemplo de módulo novo: `category` (leitura pública + escrita só admin — espelha `course`).

### 5.1 Schema (`modules/category/schema/Category.schema.ts`)

```ts
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

// RFxx: <por que a entidade existe, em uma frase>.
@Entity("categories")
export class Category {
  // RNF09: toda PK é UUID gerado pelo sistema.
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Único no banco, não só no service: a checagem prévia é resposta
  // amigável, a constraint é a garantia.
  @Column({ name: "name", type: "varchar", length: 120, unique: true })
  name: string;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;
}
```

Regras de entidade:

- Tabela em **snake_case plural**; toda coluna com `name: "snake_case"` explícito; propriedade em camelCase.
- PK `@PrimaryGeneratedColumn("uuid")`. Datas de instante: `timestamptz`. Datas de calendário: `type: "date"` e propriedade `string` (`"YYYY-MM-DD"`).
- **FK = par**: relação (`@ManyToOne` + `@JoinColumn({ name })`) **e** `@Column({ name, type: "uuid" })` com o **mesmo** nome — se divergirem o TypeORM cria duas colunas.
- Sempre declare `onDelete` (`CASCADE` para filho do dono; `RESTRICT` quando a exclusão deve ser barrada — RNF08).
- Hash de senha: `select: false`. Só a query de login/troca de senha pede a coluna explicitamente.
- Soft delete por `active: boolean` em contas (RNF06/RNF08). Catálogo sem vínculo pode ter exclusão física (ver `Course`).
- Enums de domínio: valores em **português snake_case** (`"medio_completo"`, `"em_andamento"`), chaves TS em inglês. Exceções históricas: `AccountRole` (`"student"`), `AdvertiserType` (`"PJ"`/`"PF"`).
- Contas com login têm `failedLogins` e `blockedUntil` (RN-A4).

### 5.2 Tipos de saída (`types/CategoryTypes.ts`)

```ts
export type CategoryResult = { id: string; name: string };

// O repositório informa O QUE aconteceu; o service escolhe o status HTTP.
export type DeleteCategoryOutcome = "deleted" | "not_found" | "has_links";
```

`XResult` é o que **sai da API**. Nunca devolva a entidade crua (vazaria `passwordHash`,
`failedLogins`, etc.).

### 5.3 Validator (`validators/CategoryValidator.ts`)

```ts
import { z } from "zod";

// Trim obrigatório: " Moda" e "Moda" são a mesma categoria.
export const categoryNameSchema = z
  .string()
  .trim()
  .min(2, "O nome deve ter ao menos 2 caracteres")
  .max(120, "O nome deve ter no máximo 120 caracteres");

export const createCategorySchema = z.object({ name: categoryNameSchema }).strict();
export const updateCategorySchema = z.object({ name: categoryNameSchema }).strict();

export const categoryIdParamSchema = z.object({
  id: z.uuid("Id de categoria inválido"),   // id malformado chegaria ao Postgres como 500
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

Regras Zod (v4):

- **`.strict()` em todo `z.object`** (campos desconhecidos → 400).
- Strings: `.trim()` antes de `.min/.max`. E-mail: `z.string().trim().toLowerCase().pipe(z.email("..."))`.
- Sintaxe v4: `z.uuid()`, `z.email()`, `z.enum(MinhaEnumTS, { error: "..." })`, `z.literal(true, { error })`, `ctx.addIssue({ code: "custom", path, message })`.
- PATCH: todos os campos `.optional()` + `.refine(d => Object.keys(d).length > 0, "Informe ao menos um campo")`. Ausente = não muda; `null` = limpa (campos nullable).
- Regras que dependem de **mais de um campo** vão em `.superRefine` no schema. Se dependem de dado do banco (ex.: data de nascimento já gravada), vão no **service**.
- Reutilize schemas primitivos (`emailSchema`, `nameSchema`, `passwordSchema`, `cpfSchema`, `calendarDateSchema`) em vez de redefinir. Senha: **sempre** `shared/validators/passwordSchema` (10–64 chars e ≤ 72 bytes).
- Login **não** valida força de senha (só `min(1)`); só criação/troca valida.
- URLs externas: só `https` e, quando for link de arquivo, domínio em allowlist (ver `resumeUrlSchema`).

### 5.4 Interface do repositório (`interfaces/ICategoryRepository.ts`)

```ts
import { Category } from "../schema/Category.schema";
import { DeleteCategoryOutcome } from "../types/CategoryTypes";

export interface ICategoryRepository {
  // Lança AppError 409 se o banco recusar nome duplicado (23505).
  create(name: string): Promise<Category>;
  list(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  rename(id: string, name: string): Promise<Category | null>;
  // Checagem + exclusão em transação, para não haver janela entre as duas.
  delete(id: string): Promise<DeleteCategoryOutcome>;
}
```

Documente no comentário da interface **o que o método garante** (escopo de ativos/inativos,
se inclui desativados, se lança `AppError`).

### 5.5 Repository (`repository/CategoryRepository.ts`)

```ts
import { Repository } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";

// 23505 = unique_violation. Traduz a constraint na mesma resposta da checagem
// prévia do service, para a corrida entre duas requisições não virar 500.
function rethrowDuplicateName(error: unknown): never {
  if ((error as { code?: string })?.code === "23505") {
    throw new AppError("Já existe uma categoria com esse nome", 409);
  }
  throw error;
}

export class CategoryRepository implements ICategoryRepository {
  constructor(private repository: Repository<Category>) {}

  async create(name: string): Promise<Category> {
    try {
      return await this.repository.save(this.repository.create({ name }));
    } catch (error) {
      rethrowDuplicateName(error);
    }
  }

  async delete(id: string): Promise<DeleteCategoryOutcome> {
    return await this.repository.manager.transaction(async (tm) => {
      // Trava a linha: sem isso, um vínculo criado entre a checagem e o DELETE
      // deixaria um filho apontando para algo que sumiu.
      const row = await tm.findOne(Category, { where: { id }, lock: { mode: "pessimistic_write" } });
      if (!row) return "not_found";
      if (await tm.exists(Linked, { where: { categoryId: id } })) return "has_links";
      await tm.delete(Category, { id });
      return "deleted";
    });
  }
}
```

Regras de repository:

- Construtor recebe **`Repository<Entity>`** (`AppDataSource.getRepository(...)` é passado pelo container).
- **Traduza erros do Postgres**: `23505` (único) → `AppError 409`; `23503` (FK) → `AppError 400/409`. Use o helper `rethrowXxx(error): never` no topo do arquivo e chame no `catch`.
- **Outcome pattern**: operações com mais de um desfecho possível devolvem uma união de strings
  (`"deleted" | "not_found" | "has_links"`), e o **service** escolhe o status.
- **Concorrência**: regras do tipo "nunca o último ativo" / "só exclui sem vínculo" rodam em
  `manager.transaction` com `lock: { mode: "pessimistic_write" }`, travando linhas **em ordem fixa**
  (`order: { id: "ASC" }`) e relendo o alvo **depois** do lock (ver `AdminRepository.deactivate`).
- **Posse no WHERE**: recurso do dono sempre filtra por `studentId`/`advertiserId` na query
  (`findOwned(id, studentId)`, `update({ id, studentId }, data)`), nunca "busca e depois compara".
- Update parcial: monte o objeto campo a campo, **sem** gravar `undefined`
  (`Object.fromEntries(...filter(v !== undefined))`).
- Listas filhas (telefones, idiomas...) em PATCH: `delete` + `save` **na mesma transação**.
- Métodos que devolvem hash têm nome explícito: `findByEmailWithPassword`, `findByIdWithPassword`.
- `exists({ where })` para checagens booleanas; `existsByEmail` **inclui inativos** de propósito (e-mail continua ocupado).

### 5.6 Service (`service/CategoryService.ts`)

```ts
import { AppError } from "../../../shared/errors/AppError";

// Mapper: entidade → DTO. Função de módulo (não método), nomeada toXResult.
function toCategoryResult(category: Category): CategoryResult {
  return { id: category.id, name: category.name };
}

export class CategoryService {
  constructor(private repository: ICategoryRepository) {}

  async createService(name: string): Promise<CategoryResult> {
    return toCategoryResult(await this.repository.create(name));
  }

  async renameService(id: string, name: string): Promise<CategoryResult> {
    const category = await this.repository.rename(id, name);
    if (!category) throw new AppError("Categoria não encontrada", 404);
    return toCategoryResult(category);
  }

  async deleteService(id: string): Promise<void> {
    const outcome = await this.repository.delete(id);
    if (outcome === "not_found") throw new AppError("Categoria não encontrada", 404);
    if (outcome === "has_links") {
      throw new AppError("Categoria com vínculos não pode ser excluída", 409);
    }
  }
}
```

Regras de service:

- Métodos terminam em **`Service`** (`createService`, `listService`, `deactivateService`).
- Lança `AppError(mensagem, status)` — nunca `res.status(...)`.
- Checagem de unicidade de **e-mail** passa por `EmailRegistry` (`isTaken` no cadastro, `isTakenByOther` na troca) — RN06/RN-A7. É resposta amigável; a constraint do banco é a garantia.
- **Hash de senha antes** de abrir transação (bcrypt custa centenas de ms; não segure lock).
- Operações que mudam credencial (trocar senha/e-mail, desativar conta) chamam `sessions.revokeAllSessions(role, id)` (`ISessionRevoker`).
- Após `update`, **releia** e devolva `toXResult(...)`.
- Em edição parcial, regras que olham o registro inteiro: leia o atual, **mescle** com o que veio e revalide (ver `FormationService.updateService`).
- E-mail transacional: `IEmailSender.send({ to, subject, body })` (texto puro). Links: `${config.appBaseUrl}/<rota-front>?token=...`.
- Relógio injetável (`private now: () => Date = () => new Date()`) em serviços sensíveis a tempo.

### 5.7 Controller (`controller/CategoryController.ts`)

```ts
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  createController = asyncHandler(async (req: Request, res: Response) => {
    const { name } = createCategorySchema.parse(req.body);

    const category = await this.categoryService.createService(name);

    const response: ApiResponse<CategoryResult> = { status: "success", data: category };
    res.status(201).json(response);
  });

  deleteController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = categoryIdParamSchema.parse(req.params);

    await this.categoryService.deleteService(id);

    res.status(204).send();
  });
}
```

Regras de controller:

- Métodos são **propriedades arrow** `xxxController = asyncHandler(async (req, res) => {...})` (nunca `try/catch`: o `asyncHandler` repassa ao `errorHandler`).
- Ordem: parse de `params` → parse de `body`/`query` → `getAuth(res)` → chamada ao service → resposta.
- Tipar a resposta: `const response: ApiResponse<T> = { status: "success", data }`.
- Identidade do dono vem **sempre** de `getAuth(res).accountId` — nunca de body/URL.
- Resposta de login: `res.setHeader("Cache-Control", "no-store")`.
- Comentário de uma linha com o `RFxx`/`RNxx` acima de cada método.

### 5.8 Routes (`categoryRoutes.ts`)

```ts
export function categoryRoutes(container: Container): Router {
  const router = Router();
  const categories = container.categoryController;

  /**
   * @swagger
   * /api/v1/categories:
   *   get:
   *     tags: [Categorias]
   *     summary: Listar categorias (RFxx)
   *     responses:
   *       200: { description: Lista de categorias }
   */
  router.get("/", categories.listController.bind(categories));

  return router;
}
```

- Função `xRoutes(container: Container): Router`; pega controllers do container.
- `.bind(controller)` em todo handler.
- Toda rota tem bloco `@swagger` (summary com o RF, `security: [{ bearerAuth: [] }]` quando protegida, respostas com `$ref: "#/components/responses/<BadRequest|Unauthorized|Forbidden|NotFound|Conflict>"`).
- Rota estática (`/me`) é declarada **antes** de `/:id`.
- Registre o router em `routes.ts` (`router.use("/api/v1/categories", categoryRoutes(container))`).

### 5.9 Container (`shared/container/index.ts`)

Composição manual, dentro de `buildContainer(options?)`:

```ts
const categoryController = new CategoryController(
  new CategoryService(new CategoryRepository(AppDataSource.getRepository(Category))),
);
// ... e adicione `categoryController` ao objeto retornado.
```

- `Container = ReturnType<typeof buildContainer>` — tudo que as rotas usam precisa estar no `return`.
- `ContainerOptions` permite injetar `passwordHasher` e `emailSender` (testes). Qualquer nova dependência externa (HTTP, storage, e-mail) segue o mesmo desenho: **interface + implementação real + implementação de teste**, injetável pelo container.
- Novo perfil com login: adicione o repository ao `Map` do `EmailRegistry` **e** o `XAuthProvider` às **duas** listas (`AuthService` e `AccountRecoveryService`).

### 5.10 Registro obrigatório (não esqueça)

1. Entidade nova → array `entities` de `shared/database/data-source.ts` (**sem glob**, import estático).
2. Migration nova → import + array `migrations` do mesmo arquivo, **em ordem de timestamp**.
3. Schema Zod de entrada que deve aparecer no Swagger → `requestSchemas` em `shared/docs/components.ts`.
4. Router → `routes.ts`. Controller → `return` do container.

---

## 6. Banco de dados e migrations

- PostgreSQL, `synchronize: false`. **Todo** DDL via migration.
- Migrations geradas pelo TypeORM (`name = 'Xxx<timestamp>'`, classe `Xxx<timestamp>`), usam `uuid_generate_v4()`; ficam em `shared/database/migrations/`. Mantenha o estilo gerado (4 espaços) e implemente `down`.
- Uma migration por mudança de domínio, com nome descritivo (`Courses`, `Formations`, `Advertisers`).
- Datas de negócio são interpretadas em `config.timezone` (`America/Campo_Grande`, RN28) e gravadas em UTC (`timestamptz`). `process.env.TZ` é definido em `main.ts` **antes** dos demais imports — não mova.
- Seed: `shared/database/seeds/create-first-admin.ts` (variáveis de ambiente, nunca argumentos; idempotente; `pg_advisory_xact_lock`; hash fora da transação; nunca loga a senha).

---

## 7. Autenticação e autorização

**Sem JWT.** Sessão no banco com token opaco de 256 bits.

- `POST /auth/login` → `AuthService.login`: procura o e-mail em **cada** `IAuthAccountProvider` (o e-mail é único entre todos os perfis). Gera `randomBytes(32).toString("base64url")`, guarda só o **SHA-256** (`hashToken`) em `sessions`. Uma sessão ativa por conta (`replaceActiveSession`).
- Cliente envia `Authorization: Bearer <token>`. `makeAuthenticate(authService)` valida (idle 30 min, máx. 8 h, conta ainda ativa) e preenche `res.locals.auth`. Leia com `getAuth(res)` → `{ sessionId, accountId, role }`.
- `authorize(...roles)` só checa **perfil**. Regras de posse ("só as vagas da minha empresa") ficam no service/repository.
- Anti-enumeração (RN-A1/RN23): e-mail inexistente, senha errada, conta inativa e conta bloqueada respondem **a mesma mensagem 401** e o hash é comparado mesmo assim (`dummyHash`). Recuperação de senha responde **204 sempre**.
- Bloqueio por tentativas (RN-A4): `config.loginMaxAttempts` / `loginBlockMs`, contador na própria conta.
- Tokens de uso único (`SingleUseTokenService`): recuperação de senha, troca de e-mail, convite de responsável. Só o hash é gravado; `consume(raw, type, work)` roda `work` e marca como usado **na mesma transação** (linha travada); inválido/expirado/usado são indistinguíveis.
- Perfil novo com login = implementar `IAuthAccountProvider` + registrar no container. Login, bloqueio, recuperação e troca de e-mail passam a valer sem código novo.

### Onde aplicar `authorize`

| Situação | Como |
|---|---|
| Tudo de um router é de um perfil | `router.use(container.authenticate, authorize(AccountRole.X))` **uma vez** no topo (`adminRoutes`) |
| Router mistura público e protegido | Rotas públicas primeiro; sub-router `const me = Router(); me.use(authenticate, authorize(...)); router.use("/me", me)` (`studentRoutes`, `advertiserRoutes`) |
| Leitura pública + escrita admin | Leitura no router do módulo; **escrita em `adminRoutes`** sob `/api/v1/admin/<recurso>` (ex.: `courses`) — mantém a invariante "tudo sob /admin é admin" |
| Recurso do dono | Rotas sob `/<perfil>/me/...`; dono vem da sessão; filtro de posse no repository |

---

## 8. Regras transversais de segurança e dados

- **Nunca** devolva `passwordHash`, `failedLogins`, `blockedUntil` ou tokens. Sempre mapeie via `toXResult`.
- **CPF** (RNF03/Anexo A): candidato vê o próprio completo; admin vê completo; **anunciante nunca** (use `maskCpf` nas listas/banco de talentos voltadas ao anunciante). Armazenado como 11 dígitos sem pontuação.
- E-mail normalizado (trim + lowercase) em login, cadastro e recuperação.
- Consentimento LGPD: o instante é gravado **pelo servidor** (`termsAcceptedAt`), o cliente só manda `true`.
- Senha: `IPasswordHasher` (bcrypt, custo ≥ 12 garantido pela classe). Nunca chame `bcrypt` direto (exceção histórica: o seed).
- Soft delete (`active=false`) para contas; desativar encerra sessões; `isActive` é checado a cada requisição.
- `errorHandler` nunca loga o **valor** recebido (pode ser dado sensível); só caminho do campo e mensagem do schema.
- Nunca leia `process.env` fora de `shared/config/index.ts`; adicione chaves lá com default seguro.
- URLs informadas pelo usuário: `https` apenas; arquivos nunca são armazenados, só o endereço (RN-C10).

---

## 9. Swagger

- `swagger-jsdoc` lê `modules/**/*Routes.{js,ts}`. UI em `/api-docs`.
- **Corpos de requisição são gerados dos schemas Zod** (`shared/docs/components.ts` via `z.toJSONSchema`). Não escreva o schema do body à mão: referencie `#/components/schemas/<Nome>`.
- O que o Zod não sabe (path, método, tags, respostas de erro, segurança, descrição de regra) é escrito à mão no bloco `@swagger`.
- Tags em português (`Candidato`, `Cursos`, `Administração`, `Auth`...). Segurança: `bearerAuth` com `bearerFormat: opaque` (não é JWT).

---

## 10. Linguagem e comentários

- Identificadores, nomes de arquivo e de tabela/coluna: **inglês**.
- Mensagens de erro e de validação para o usuário e comentários: **português (pt-BR)** em código novo. Os módulos mais recentes (`course`, `formation`, `advertiser`, recuperação) seguem isso; `admin` e partes de `student` ainda têm mensagens em inglês (ver seção 14).
- Comentário explica o **porquê** e cita o requisito (`// RN-A4: ...`). Não comente o óbvio.
- Registre decisões não óbvias no próprio código (ex.: "404 e não 403, porque...").

---

## 11. Testes *(inferido)*

- Vitest (`describe/it/expect` importados de `"vitest"`), arquivo `X.test.ts` ao lado do código (`AppError.test.ts`).
- O `buildContainer(options)` aceita `passwordHasher` e `emailSender` falsos; existe um `TestEmailSender` em `test/utils/` e um `test/setup/global-setup.ts` que cria o schema rodando as migrations *(arquivos referenciados em comentários, não incluídos no pacote)*. Antes de criar testes de integração, peça/consulte a pasta `test/`.
- Funções que dependem de relógio recebem `now` por parâmetro/construtor para serem testáveis (`hasMinimumAge`, `AuthService`).

---

## 12. Receita: criar um módulo novo

1. **Schema** `schema/X.schema.ts` (5.1) → registre em `data-source.ts`.
2. **Migration** gerada pelo TypeORM → registre em `data-source.ts`.
3. **Types** `types/XTypes.ts` (`XResult`, `XOutcome`) e `XEnums.ts` se houver enum.
4. **Validators** `validators/XValidator.ts` (`createXSchema`, `updateXSchema`, `xIdParamSchema`, query de listagem).
5. **Interface** `interfaces/IXRepository.ts`.
6. **Repository** `repository/XRepository.ts` (tradução de 23505/23503, transações/locks, posse no WHERE).
7. **Service** `service/XService.ts` (`toXResult`, `AppError`, métodos `...Service`).
8. **Controller** `controller/XController.ts` (`...Controller` com `asyncHandler`).
9. **Routes** `xRoutes.ts` com `@swagger` + `authenticate/authorize` corretos.
10. **Container**: instancie e exponha o controller. **`routes.ts`**: monte o router.
11. **Swagger**: adicione schemas de entrada em `requestSchemas` (`components.ts`).
12. **Testes** do service (regras) e do repository/rotas (integração), se a pasta `test/` existir.

Checklist final antes de entregar:

- [ ] Controller sem regra de negócio e sem `try/catch`
- [ ] Service só conhece **interfaces**
- [ ] Todo `z.object` com `.strict()`; ids com `z.uuid()`; strings com `.trim()`
- [ ] Nenhuma entidade crua na resposta; sem hash/contadores vazando
- [ ] Posse do recurso filtrada no repository; "não é seu" → 404
- [ ] Unicidade: checagem amigável no service **e** constraint no banco **e** tradução 23505 no repository
- [ ] Operações com concorrência em transação + lock
- [ ] Entidade, migration e controller registrados (data-source, container, routes.ts)
- [ ] `@swagger` em todas as rotas; schemas gerados do Zod
- [ ] Mensagens em pt-BR; comentário com o RF/RN

---

## 13. Referências rápidas ("copie deste módulo")

| Preciso de... | Olhe |
|---|---|
| CRUD simples com exclusão condicionada a vínculo | `course` |
| Recurso do dono (`/students/me/formations`), posse no WHERE, merge em PATCH | `formation` |
| Cadastro público + perfil próprio + listas filhas em transação | `student` |
| Regra "nunca o último ativo", paginação, troca de senha com revogação de sessões | `admin` |
| Aggregate com transação (anunciante + 1º responsável), convite por e-mail | `advertiser` |
| Sessão, token de uso único, recuperação de senha, providers | `auth` |

---

## 14. Inconsistências existentes — **não replicar**

Foram observadas no código atual. Ao tocar nesses arquivos, não "corrija" por conta própria
sem o usuário pedir; ao escrever código novo, siga a regra à direita.

| Observado | Faça em código novo |
|---|---|
| Pasta `interface/` (singular) em `admin`; `interfaces/` nos demais | Use **`interfaces/`** |
| Mensagens em inglês em `admin`/`student` (`"Email already in use"`) e em português nos demais | **pt-BR** |
| `formation` não tem `formationRoutes.ts`: as rotas vivem em `studentRoutes` (`/students/me/formations`) | Recurso do dono pode viver sob a rota do perfil; só crie router próprio se for acessado fora de `/me` |
| Comentários residuais `// Place at: src/...` e `routes/index.ts` no topo de arquivos | Não adicione |
| `AdminService` tem campo `bcryptCost` não utilizado; comentário em `toAdminStudentResult`/`listStudentsService` fala em "CPF masked" mas o CPF sai completo (por decisão do Anexo A) | Siga o Anexo A; não mascare para admin |
| `IStudentRepository`/`typesStudents.ts` trazem blocos comentados ("Add these to the IStudentRepository") e tipos (`ListStudentsOptions`) não usados | Não deixe código pendente comentado |
| `student/types` usa o nome `typesStudents.ts` | Use `XTypes.ts` |
| `emailSchema`/`nameSchema` duplicados em `advertiser` e `auth` (existem também em `student`) | Prefira importar o existente; mantenha mensagens consistentes |
| Swagger `servers` aponta para `localhost:3001`, enquanto o default de `config.port` é 3000 | Não altere sem pedido |
| `multer` é tratado no `errorHandler`, mas ainda não há upload implementado | Upload novo deve respeitar o tratamento já existente |
| Limpezas (`purgeExpired` em sessões e tokens) existem mas nenhum agendador aparece no código | Se criar o agendador, injete via container |
| Condição de corrida entre e-mails de perfis diferentes é aceita (sem constraint cruzada) | Mantenha a conferência no `EmailRegistry` **e** na confirmação dos fluxos de token |

---

## 15. Glossário rápido de nomes

`createService`, `listService`, `updateOwnProfileService`, `deactivateService` · `createController`,
`listController` · `IXRepository` · `XRepository` · `X.schema.ts` · `XResult` · `XOutcome` ·
`CreateXInput` (`z.infer`) · `CreateXData` (entrada do repository) · `toXResult` ·
`rethrowDuplicateName` / `rethrowUniqueViolation` · `xRoutes(container)` · `XAuthProvider`.
