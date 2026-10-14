# EstagiaAqui: Plano de tasks do back-end

Baseado no **SRS v4.9 (14/10/2026)** e no estado atual do repositório (módulos `auth`, `student`, `admin`; infraestrutura de testes pronta).

A v4.0 reescreveu o produto: deixou de ser "estágio para universitários" e passou a ser "vagas de emprego e estágio para qualquer escolaridade". Este plano substitui o anterior, que era da v3.2.

Cada task segue o mesmo modelo: contexto, entregas, regras, critérios de aceitação.

---

## Nomes: SRS × código

**Decisão do projeto: o código mantém os nomes que já usa.** O SRS renomeou atores na v4.0, mas renomear módulo, tabela e classe teria custo alto e nenhum ganho funcional. A tradução é esta:

| SRS v4.9 | Código |
|---|---|
| Candidato | módulo `student`, tabela `students` |
| Anunciante | módulo `advertiser`, tabela `advertisers` (a criar) |
| Responsável | perfil `RESPONSIBLE` em `AccountRole` |
| Administrador | módulo `admin`, tabela `admins` |
| Formação | `formations` (a criar) |
| Sessão | tabela `sessions` |

Ao citar requisito, use o ID do SRS (RF10, RN-C3…). Ao nomear código, use a coluna da direita.

---

## Convenções válidas para todas as tasks

**Padrão de código**
- Módulo em `modules/<nome>/` com `interfaces/`, `schema/`, `repository/`, `service/`, `controller/`, `validators/`, `types/` e `<nome>Routes.ts`.
- O repositório informa **o que aconteceu** (`"deactivated" | "not_found" | "last_active"`); o service decide o status HTTP.
- Resposta com `ApiResponse`, erro com `AppError`, controller com `asyncHandler`, input com Zod `.strict()`. Nada devolve `password_hash`.
- Id de rota validado como UUID antes de chegar ao banco (senão vira 500).
- E-mail normalizado com trim + lowercase.
- Toda unicidade tem **constraint no banco**; a checagem prévia no service é só a resposta amigável, e a violação `23505` vira 409.
- Toda FK com `ON DELETE` restritivo (RNF06); toda PK é UUID (SRS 2.3).
- **RN-A7** (e-mail único entre todos os perfis) passa sempre pelo `EmailRegistry`. Perfil novo = registrar o repositório no `Map` do container.
- Rota protegida: `authenticate` + `authorize(AccountRole.X)`, aplicado **uma vez** no router (como em `adminRoutes.ts`).
- Operação que checa e altera estado compartilhado (último admin, último responsável, número de posições da vaga) roda em transação com lock pessimista.
- Código em inglês; **mensagem de usuário final em português** (a RN-A1 exige a string exata `"E-mail ou senha inválidos"`).

**Definição de pronto**
- Migration nomeada pelo assunto (não `Init`), que roda do zero **e reverte**.
- A classe da migration adicionada ao array `migrations` do `data-source.ts` — elas são importadas estaticamente, não por glob. Esquecer isso faz a migration não rodar nos testes.
- Cada RF e RN citado tem teste do caminho feliz e do erro, com status e mensagem definidos.
- Rota protegida testada com: sem token (401), token de outro perfil (403), token válido (sucesso).
- Rotas novas no Swagger; README atualizado quando a task cria script, variável de ambiente ou passo de setup.

---

## Visão geral

| # | Task | RF / RN principais | Depende de | Status |
|---|------|--------------------|------------|--------|
| 01 | Fundação: testes e limpeza | RNF01 | — | **Fechada** (CI e lint adiados) |
| 02 | Admin: base e gestão de admins | RF32, RF34, RN-A7 | 01 | **Fechada** |
| 03 | Sessão e login conforme RN-A | RN-A3, RN-A4 | 01 | A fazer |
| 04 | Alinhar o candidato à v4.9 | RF10, RF12, RF13, RN-C1, RN-C2, RN-C9, RN-C10, RN-C11 | 01 | A fazer |
| 05 | Perfil próprio e troca de senha | RF03, RN-A3, RN-A5 | 04 | A fazer |
| 06 | E-mail e tokens de uso único | RNF01 | 01 | A fazer |
| 07 | Recuperação de senha e troca de e-mail | RF01, RF03, RN-A6 | 06, 03 | A fazer |
| 08 | Cursos | RF33 | 02 | A fazer |
| 09 | Formações do candidato | RF11, RN-C2, RN-C4 | 04, 08 | A fazer |
| 10 | Anunciante e responsável | RF20, RF22, RF23, RN-VG8 | 06, 07 | A fazer |
| 11 | Verificação de anunciantes | RF21, RF30, RN-V1 a RN-V5 | 10 | A fazer |
| 12 | Preço de vagas e configuração | RF39, RF40, RN-P8 | 02 | A fazer |
| 13 | Vagas: rascunho, revisão e publicação | RF24, RF25, RF29, RN-VG1 a RN-VG9, RN-P5 | 10, 12 | A fazer |
| 14 | Pagamento por vaga (PIX) | RF28, RF37, RN-P1 a RN-P7 | 13 | A fazer |
| 15 | Busca e página pública da vaga | RF14, RNF04 | 13 | A fazer |
| 16 | Candidatura | RF15, RF16, RF17, RN-C3 a RN-C7 | 09, 13 | A fazer |
| 17 | Candidaturas na visão do anunciante | RF26, RN-C8, RNF07 | 16 | A fazer |
| 18 | Banco de talentos e contato | RF27, RN-C8, RN-C9 | 11, 16 | A fazer |
| 19 | Mural público de candidatos | RF19, RN-C9, RNF04 | 04, 09 | A fazer |
| 20 | Denúncias | RF31, RN-V6 a RN-V8 | 13 | A fazer |
| 21 | Notificações no site e por e-mail | RF35 | 06, 16 | A fazer |
| 22 | Rotinas diárias: validade de 60 dias | RN-VG2, RN-VG7, RN-P4 | 13, 16 | A fazer |
| 23 | Exclusão de conta por anonimização | RF18, RN-L1 a RN-L6 | 16 | **Bloqueada** (D3, P5) |
| 24 | Central de Segurança e páginas públicas | RF36, RF40 | 12 | A fazer |
| 25 | Patrocínios | RF38 | 12 | A fazer |
| 26 | Compartilhamento e origem de acesso | RF42, RF43 | 15 | A fazer |
| 27 | Documentação e entrega | RNF02, RNF05 | todas | A fazer |

**Ondas sugeridas**
1. **Base de contas** — 03, 04, 05, 06, 07. ← *onda atual*
2. **Catálogo e anunciante** — 08, 09, 10, 11, 12.
3. **Núcleo do produto** — 13, 14, 15, 16, 17.
4. **Confiança e alcance** — 18, 19, 20, 21, 22, 24.
5. **Fechamento** — 25, 26, 27. A 23 entra quando as decisões saírem.

---

## Decisões que travam tasks

Além das pendências P4 a P9 do SRS (seção 9.2), o próprio documento tem três pontos que precisam de resposta antes de codar.

| ID | Questão | Trava | Observação |
|----|---------|-------|------------|
| **D1** | **Tabela única de usuários?** A v4.9 (seção 6) unifica todos os perfis numa `USUARIO`, para resolver o e-mail único e dar FK real à sessão. O código tem `students` e `admins` separados, com `EmailRegistry` resolvendo a unicidade e `sessions.account_id` polimórfico (sem FK, contra a RNF06). | 04, 10 | Manter separado custa a FK da sessão; unificar custa migrar os dois módulos existentes. Decidir **antes** da task 10, quando o terceiro perfil entra. |
| **D2** | **Idade mínima: 14 ou 16?** RN-C1 diz 14. A história de usuário da seção 7 diz "menor de 16 recusado". | 04 | Bloqueia o `CalculatorBirthDate`, em implementação agora. Ligado à pendência P4 do SRS. |
| **D3** | **O admin vê o CPF completo?** O Anexo A diz `Ver CPF → Admin: Sim`. O RNF03 restringe só a anunciantes. O código hoje **mascara o CPF para o admin**, seguindo a v3.2. | 04, 18, 23 | Se o Anexo A vale, o `maskCpf` sai da listagem do admin e passa a valer para anunciante. |

---

# TASK 01: Fundação, testes e limpeza

> **Status: fechada, com CI e lint adiados por decisão do projeto (14/10/2026).**
>
> Entregue: Vitest + supertest, banco de teste isolado na porta 5435, migrations do zero e revert verificados, helpers (`createStudent`, `createAdmin`, `loginAs`, `truncateAll`), fake de e-mail, relógio injetável, `PasswordHasher` centralizado com custo mínimo 12 (RNF01) e `README.md`.
>
> **Adiado:** pipeline de CI e ESLint. Projeto conduzido por uma pessoa, suíte roda em menos de um segundo. **O que se perde:** a verificação de instalação limpa a cada push — três incidentes desta fase (`dotenv` e `bcrypt` fora do `package.json`, TypeScript 7 quebrando o `ts-node`) seriam apanhados por ela. **Mitigação:** rodar `npm test` e `npx tsc --noEmit` antes de cada commit. Reavaliar com mais de um desenvolvedor.

**Notas de implementação, para quem mexer depois**
- Migrations rodam no `globalSetup`, não em `setupFiles`: lá rodariam uma vez por arquivo de teste, em paralelo, e duas migrations simultâneas colidem ao criar a tabela `migrations`.
- `fileParallelism: false` no `vitest.config.mts`: todos os arquivos compartilham um banco e cada um faz `TRUNCATE` no `beforeEach`.
- Migrations importadas **estaticamente** no `data-source.ts`. Por glob, o TypeORM faria `require()` nos `.ts` sob o Vitest e o Node não os parseia.
- TypeScript fixado em `^5.9.3`. O TS 7 não expõe `ts.sys` e quebra todo o `ts-node` (dev, seed, migrations). `tsx`/esbuild não substitui: não implementam `emitDecoratorMetadata`, de que o TypeORM depende.

---

# TASK 02: Admin: base e gestão de admins

> **Status: fechada.**
>
> Entregue: schema `admins`, repositório, `AdminAuthProvider`, service, controller, validators, rotas em `/api/v1/admin/administrators`, script `seed:admin` e migration. Cobre RF34 (nunca desativar a si mesmo nem o último ativo, com lock pessimista) e RF32 parcial (listagem de candidatos).
>
> Dois bugs encontrados e corrigidos nesta fase, registrados porque voltam fácil numa refatoração: o `routes.ts` montava `authRoutes` duas vezes e deixava todo o módulo admin em 404; e o `buildContainer` resolvia o hasher injetado numa variável e passava **outro** aos serviços, anulando a injeção.

**Pendente desta task**
- Documentar as rotas de admin no Swagger (o glob já alcança `modules/**/*Routes.{js,ts}`).
- `GET /api/v1/admin/students` existe, paginada. O mascaramento de CPF depende da **decisão D3**.
- RF32 completo (desativar/reativar candidatos e responsáveis) entra junto com a task 10, quando o perfil responsável existir.

---

# TASK 03: Sessão e login conforme RN-A

## Contexto
O módulo auth já faz o essencial — token opaco, sem JWT, só o hash no banco, mensagem única de falha — e isso continua valendo na v4.9. Faltam dois ajustes e um controle novo.

## Entregas
- **RN-A3:** sessão expira em **30 min sem uso ou 8 h desde o login**. O `config` tem `sessionIdleMs` correto (30 min), mas `sessionMaxAgeMs` está em 2 h (`7_200_000`); deve ser 8 h (`28_800_000`).
- **RN-A4:** 5 falhas seguidas no mesmo e-mail bloqueiam o login por 15 min; login bem-sucedido zera o contador. A v4.9 guarda isso como **duas colunas na própria tabela de usuário** (`failed_logins`, `blocked_until`), não em tabela separada.
- **RN-A3:** sair, trocar a senha, recuperar a senha ou ter a conta desativada encerra **todas** as sessões da conta. O `revokeAllSessions` já existe; garantir que é chamado nos quatro casos.
- Job ou limpeza preguiçosa de sessões expiradas — hoje a tabela só cresce.

## Regras
- O bloqueio da RN-A4 responde **a mesma mensagem** da RN-A1. Informar "conta bloqueada" entrega ao atacante a confirmação de que o e-mail existe, que é justamente o que a RN-A1 evita.
- O contador é por e-mail, não por IP, e incrementa mesmo quando o e-mail não existe — senão vira oráculo de enumeração.

## Critérios de aceitação
- 5 falhas e a 6ª tentativa é recusada mesmo com a senha certa; depois de 15 min, a senha certa entra.
- Login bem-sucedido zera o contador.
- Sessão criada há 8 h e 1 min é recusada mesmo em uso contínuo.
- A resposta do login bloqueado é byte a byte igual à de senha errada.

---

# TASK 04: Alinhar o candidato à v4.9

## Contexto
O módulo `student` foi escrito para a v3.2 e carrega campos que a v4.9 não tem, além de faltarem os que ela introduziu. **Depende das decisões D2 e D3.**

## Entregas
**Campos que entram** (RF10, RF12):
- `cidade` (texto; o atendimento inicial é Campo Grande, mas o campo já existe para expansão).
- `escolaridade` — enum fixo da RN-C2: fundamental incompleto, fundamental completo, médio em andamento, médio completo, técnico em andamento, técnico completo, superior em andamento, superior completo, pós-graduação.
- `telefone` como **coluna** (opcional) e `telefone_whatsapp` booleano (RN-C11). Hoje é tabela `student_phones`, que sai.
- `visibilidade` — enum da RN-C9: `oculto` (padrão), `so_verificados`, `publico`.
- `resumo`, `foto_url`, `link_curriculo` (RN-C10).

**Campos e tabelas que saem**: `student_languages`, `student_skills`, `student_certifications`, `student_experiences`. A v4.9 não as tem; o perfil profissional é só resumo, foto e link. Confirmar com o autor antes de dropar.

## Regras
- **RN-C1 (D2):** idade mínima no cadastro, calculada no fuso America/Campo_Grande. Constante em um ponto só.
- **RN-C9:** menor de 18 **não pode** escolher `publico`. A mudança de visibilidade vale na hora.
- **RN-C10:** link de currículo só `https` e só de domínios permitidos (Google Drive, OneDrive, Dropbox, LinkedIn, GitHub, Canva). O sistema **não armazena arquivo**.
- **RN-C11:** o telefone segue a mesma regra de visibilidade do e-mail e nunca aparece no mural.
- **RNF03 / D3:** o CPF nunca aparece para anunciante.

## Critérios de aceitação
- Escolaridade fora da lista é recusada.
- Candidato de 17 anos tentando visibilidade `publico` é recusado.
- Link de currículo `http://` é recusado; de domínio fora da lista é recusado.
- Nascido um dia antes da idade mínima é recusado; exatamente na idade é aceito.

---

# TASK 05: Perfil próprio e troca de senha

## Contexto
Hoje há `POST /students` e `PATCH /students`. Falta leitura do próprio perfil, e o `PATCH` tem só `authenticate`, sem `authorize` — um token de admin alcança o service, contra o RF02.

## Entregas
- `GET /api/v1/students/me`: o candidato lê o próprio perfil, **com CPF completo** (Anexo A: `Ver CPF → Candidato: Próprio`).
- `PATCH /api/v1/students/me`: nome, telefone, cidade, escolaridade, perfil profissional e visibilidade. **Trocar o e-mail não entra aqui** (RF03 exige confirmação por link — task 07).
- `PATCH /api/v1/students/me/password`: exige a senha atual; aplica RN-A5 (10 a 64 caracteres, sem exigência de tipos); ao trocar, encerra todas as sessões (RN-A3).
- `authorize(AccountRole.STUDENT)` aplicado no router.
- Mesmo desenho para o admin, que já tem `/administrators/me`.

## Critérios de aceitação
- Senha atual errada: **400**, não 401 — para o cliente não confundir com sessão expirada.
- Depois da troca, o token usado na própria requisição falha na seguinte.
- Token de admin em `PATCH /students/me`: 403.
- Senha de 9 caracteres recusada; de 10 só com minúsculas aceita; de 65 recusada; de 64 com acentos que passem de 72 bytes recusada (limite do bcrypt).

---

# TASK 06: E-mail e tokens de uso único

## Contexto
Recuperação de senha, convite de responsável e troca de e-mail dependem de envio de e-mail e de token de uso único. A infraestrutura de teste já tem o `TestEmailSender`.

## Entregas
- Serviço de e-mail por provedor externo (SRS 2.3), com interface própria e o fake já existente nos testes.
- Tabela `single_use_tokens`: `user_id?`, `advertiser_id?` (só no convite, quando a conta do convidado ainda não existe), `target_email`, `tipo` (`recuperacao | convite | troca_email`), `token_hash` UK, `expira_em`, `usado_em?`.
- **RNF01:** só o hash SHA-256 do token é guardado, nunca o token.
- Rotina de limpeza de tokens expirados.

## Regras
- Um token vale **uma vez**: consumir marca `usado_em` na mesma transação que executa a ação.
- Pedido novo invalida o anterior do mesmo tipo e destinatário (RN-A6).

## Critérios de aceitação
- Token usado duas vezes: a segunda falha.
- Token expirado falha com a mesma mensagem de token inválido.
- O valor cru do token não aparece em nenhuma consulta nem em log.

---

# TASK 07: Recuperação de senha e troca de e-mail

## Entregas
- `POST /api/v1/auth/password-recovery` (RN-A6): **resposta sempre igual**, exista ou não o e-mail. Link vale 30 min e um uso.
- `POST /api/v1/auth/password-recovery/confirm`: aplica RN-A5 e encerra todas as sessões da conta.
- Troca de e-mail (RF03): pedido envia link **para o novo endereço**; a troca só vale ao confirmar.

## Regras
- A RN-A6 é um caso de enumeração igual ao login: a resposta e o tempo não podem denunciar se o e-mail existe.
- O novo e-mail passa pelo `EmailRegistry` **no momento da confirmação**, não só no pedido — outra conta pode ter registrado o endereço nesse meio-tempo.

## Critérios de aceitação
- E-mail inexistente e existente devolvem resposta idêntica.
- Link de 31 min atrás é recusado.
- Pedir duas vezes invalida o primeiro link.
- E-mail tomado entre o pedido e a confirmação: 409 na confirmação.

---

# TASK 08: Cursos

## Entregas (RF33)
- Tabela `courses`: `id`, `nome` UK.
- CRUD pelo admin; curso **sem uso** pode ser excluído, com uso não.
- `GET` liberado para visitante, candidato, responsável e admin — formações (task 09) e vagas (task 13) precisam da lista.

## Regras
- `hasLinks(id)` isolado no repositório. Hoje retorna `false`; a task 09 passa a consultar `formations` e a 13, `vacancies`.
- Nome repetido é recusado (constraint no banco).

## Critérios de aceitação
- Nome duplicado: 409. Curso com formação vinculada: exclusão recusada. Curso sem vínculo: excluído.

---

# TASK 09: Formações do candidato

## Entregas (RF11)
- Tabela `formations`: `candidato_id` FK, `nivel` (enum da RN-C2), `curso_id` FK opcional, `instituicao` (texto livre — a v4.0 removeu a entidade), `situacao` (`em andamento | concluída | trancada`), `inicio`, `fim?`.
- Zero ou mais formações por candidato (o cadastro não exige nenhuma).
- CRUD do próprio candidato.

## Regras
- `fim`, quando informado, não pode ser anterior a `inicio`; fica vazio enquanto em andamento.
- A RN-C4 depende daqui: vaga de estágio exige ao menos uma formação **em andamento**, e no curso da vaga se ela indicar curso.

## Critérios de aceitação
- Candidato sem formação se cadastra normalmente.
- `fim` anterior a `inicio` recusado.
- Formação de outro candidato: 403.

---

# TASK 10: Anunciante e responsável

## Contexto
Entra o terceiro perfil. **A decisão D1 precisa estar tomada antes desta task** — é aqui que manter três tabelas de conta separadas fica caro.

## Entregas
- Tabela `advertisers` (RF20): `tipo` (`PJ | PF`), `documento` UK (CNPJ ou CPF), `nome_exibicao`, `razao_social?`, `email_contato`, `telefone_contato`, `site?`, `verificacao` (`pendente | verificado | recusado`), `verificado_por?`, `verificado_em?`, `metodo_verificacao?`, `motivo_recusa?`, `ativo`.
- Perfil `RESPONSIBLE` em `AccountRole`, com provider e registro no `EmailRegistry`.
- Cadastro de anunciante + primeiro responsável numa transação (RF20).
- Convite de responsável por e-mail (RF22): link vale **72 h**, o convidado define a senha.
- Edição do anunciante (RF23), exceto tipo e documento.

## Regras
- **Documento validado pelos dígitos** (CPF e CNPJ) e único.
- Nasce com verificação `pendente` (RN-V1).
- **RF23:** alterar nome ou razão social de anunciante verificado o **volta para pendente**.
- **RN-VG8:** sempre ao menos um responsável ativo; para tirar o último, desativa-se o anunciante. Mesma corrida do último admin — transação com lock.

## Critérios de aceitação
- CNPJ com dígito inválido recusado; documento repetido: 409.
- Anunciante nasce `pendente`.
- Verificado que muda a razão social volta a `pendente`.
- Desativar o último responsável ativo: 409.

---

# TASK 11: Verificação de anunciantes

## Entregas
- `POST /api/v1/advertisers/me/verification` (RF21): o responsável envia os dados.
- Fila no painel do admin (RF30): listar pendentes, ver dados, marcar verificado ou recusado **com motivo**.
- Registro de quem verificou, quando e **o método** (RNF07).

## Regras
- **RN-V2 (PJ):** CNPJ conferido na consulta pública (situação ativa, razão social igual) **e** vínculo do responsável confirmado por e-mail no domínio da empresa ou ligação para o telefone público.
- **RN-V3 (PF):** e-mail e telefone confirmados por código; chamada de vídeo curta; prova de atividade quando houver. **Nenhuma imagem de documento é guardada** — registra-se só quem verificou, quando e o método.
- **RN-V3a:** anunciante PF tem no máximo **3 vagas abertas** ao mesmo tempo, mesmo verificado e pagando.
- **RN-V4:** não verificado só publica a vaga gratuita, com o aviso "Anunciante não verificado".
- **RN-V5:** só o verificado exibe o selo e acessa o banco de talentos.
- Recusado pode pedir nova verificação.

## Critérios de aceitação
- Recusa sem motivo é recusada.
- PF verificado com 3 vagas abertas não publica a 4ª.
- Não verificado tentando publicar a 2ª vaga: bloqueado com explicação de como se verificar.
- A decisão fica registrada com autor, data e método.

---

# TASK 12: Preço de vagas e configuração

## Entregas
- Tabela `vacancy_prices` (RF39): `tipo` PK (`estagio | emprego | jovem_aprendiz`), `valor`, `atualizado_por` FK, `atualizado_em`. Preços iniciais: estágio R$ 20, emprego R$ 35, jovem aprendiz a definir (**P7**).
- Tabela `settings`: `chave` PK, `valor`, `atualizado_em` — link da comunidade de anunciantes, contato do "Anuncie aqui".
- Edição pelo admin, com registro de quem alterou e quando.

## Regras
- **RN-P8:** mudança de preço vale só para vagas enviadas para pagamento **depois** dela. A vaga guarda o valor do momento do envio, e é esse que aparece no PIX e no pagamento.

## Critérios de aceitação
- Vaga enviada antes de uma alteração mantém o valor antigo no PIX.
- Alteração de preço registra autor e data.

---

# TASK 13: Vagas: rascunho, revisão e publicação

## Entregas
- Tabela `vacancies`: `anunciante_id`, `criado_por`, `tipo` (`estagio | emprego | jovem_aprendiz`), `exige_maior_idade` (bool), `titulo`, `descricao`, `modalidade` (enum `presencial | remoto | hibrido`), `cidade`, `carga_horaria`, `escolaridade_minima`, `curso_id?`, `requisitos?`, `beneficios?`, `remuneracao?`, `horario?`, `prazo?` (timestamptz), `posicoes` (padrão 1), `situacao`, `gratuita` (bool), `valor`, `codigo_referencia` UK, `publicada_em?`, `expira_em?`.
- Situações (RN-VG1): `rascunho → aguardando_pagamento → aberta → suspensa → encerrada` (final, não reabre).
- Tela de revisão com dupla confirmação (RF29), mostrando a vaga como o candidato verá e o aviso de validade de 60 dias.
- Encerrar (RF25) e excluir vaga sem candidaturas (RN-VG6).

## Regras
- **RN-P5:** vaga publicada **não é editada**. Antes da publicação, tudo é editável. Erro encontrado depois: encerrar e publicar outra.
- **RN-VG3:** prazo opcional; se informado, não pode ser anterior à publicação nem passar dos 60 dias.
- **RN-VG4:** carga horária máxima — estágio 30 h, emprego 44 h, jovem aprendiz 6 h diárias.
- **RN-VG9:** a vaga **não define faixa de idade**. Só `exige_maior_idade`, e apenas quando a lei proíbe menores. Jovem aprendiz aceita 14 a 24 anos; emprego e estágio sem a marca aceitam a partir de 16.
- **RN-VG7:** anunciante desativado tem as vagas abertas encerradas e as candidaturas em andamento canceladas, com aviso.
- O número de posições pode ser maior que 1 na mesma vaga.

## Critérios de aceitação
- Estágio com 31 h recusado; jovem aprendiz com 7 h diárias recusado.
- Prazo anterior à publicação recusado; prazo além de 60 dias recusado.
- `PATCH` em vaga publicada: 409.
- Vaga com candidatura não pode ser excluída, só encerrada.

---

# TASK 14: Pagamento por vaga (PIX)

## Entregas
- Tabela `payments` (RF28): `vaga_id` FK UK, `valor`, `codigo_referencia`, `situacao` (`confirmado | recusado | reembolsado`), `confirmado_por` FK, `confirmado_em`, `observacao?`.
- Ao enviar uma vaga paga: o sistema mostra valor, chave PIX e **código de referência**, e a vaga fica `aguardando_pagamento`.
- Fila de pagamentos no painel do admin (RF37): listar, conferir pelo código, confirmar (publica a vaga) ou recusar com motivo; ver pagamentos por período.
- Aviso ao admin por e-mail e no painel.

## Regras
- **RN-P1:** a **primeira vaga de cada anunciante é gratuita**; as demais exigem pagamento único por vaga.
- **RN-P2:** só anunciante **verificado** publica vaga paga. O não verificado fica na vaga gratuita.
- **RN-P6:** reembolso só se o admin recusar a vaga antes de publicá-la. Vaga encerrada por denúncia procedente não é reembolsada. (**P8** em aberto: direito de arrependimento do CDC.)
- **RN-P7:** o sistema **não guarda comprovante** — registra valor, data, código de referência e quem confirmou.

## Critérios de aceitação
- Primeira vaga do anunciante publica sem pagamento.
- Segunda vaga de não verificado é bloqueada.
- Confirmar o pagamento muda a vaga para `aberta` e registra quem confirmou.
- Código de referência é único.

---

# TASK 15: Busca e página pública da vaga

## Entregas (RF14)
- Busca **sem login**: só vagas abertas e dentro do prazo; filtros por tipo, modalidade, cidade, escolaridade mínima, curso e palavra-chave; mais recentes primeiro; **20 por página**.
- Página pública da vaga com endereço próprio e legível (RF42), ex.: `/vagas/vendedor-centro-a1b2`.
- Selo "Verificado" ou aviso "Anunciante não verificado" (RN-V4, RN-V5) em toda vaga.
- Aviso anti-golpe da **RN-V6** em toda página de vaga: *"Nenhuma vaga legítima cobra taxa, curso ou material. Se pedirem dinheiro, denuncie."*

## Regras
- **RNF04:** resposta em até 2 s. Índices nos campos filtrados; paginação de 20.

## Critérios de aceitação
- Vaga suspensa ou encerrada não aparece.
- Filtros combinam.
- Visitante sem token recebe 200.
- O aviso da RN-V6 está presente em toda resposta de vaga.

---

# TASK 16: Candidatura

## Entregas
- Tabela `applications`: `vaga_id`, `candidato_id`, `situacao`, `observacao?`, `criada_em`, **UK (vaga_id, candidato_id)**.
- Tabela `application_history` (RNF07): `candidatura_id`, `situacao_anterior`, `situacao_nova`, `alterado_por` FK **anulável (vazio = sistema)**, `observacao?`, `alterado_em`.
- Candidatar-se (RF15), cancelar enquanto não for final (RF16), acompanhar (RF17).

## Regras
- **RN-C3:** escolaridade do candidato ≥ escolaridade mínima da vaga.
- **RN-C4:** vaga de estágio exige formação **em andamento**; se a vaga indicar curso, a formação em andamento deve ser nesse curso.
- **RN-C5:** uma candidatura por vaga, **mesmo após cancelar**.
- **RN-C6:** `Em análise → Entrevista → Aprovada`; de `Em análise` ou `Entrevista` para `Rejeitada` ou `Cancelada`. Aprovada, Rejeitada e Cancelada são finais. **Só o candidato cancela**; o anunciante faz as demais.
- **RN-C7:** aprovados não podem passar do número de posições da vaga — transação com lock.
- A `alterado_por` vazia identifica o sistema (cancelamento automático). Decidir e documentar.

## Critérios de aceitação
- Escolaridade abaixo da mínima: bloqueado.
- Estágio sem formação em andamento: bloqueado.
- Segunda candidatura à mesma vaga, mesmo após cancelar: recusada.
- Transição não permitida: 409.
- Aprovar além do número de posições: 409, inclusive sob concorrência.

---

# TASK 17: Candidaturas na visão do anunciante

## Entregas (RF26)
- Listar candidatos das **próprias** vagas e mudar a situação, com observação opcional **visível ao candidato**.

## Regras
- **RN-C8:** o anunciante vê nome, e-mail, telefone, cidade, escolaridade, formações e perfil profissional. **Nunca o CPF nem a data de nascimento completa.**
- O responsável só alcança vagas e candidaturas do próprio anunciante — regra de posse, no service, não só no `authorize`.
- Toda mudança registra autor e data (RNF07).

## Critérios de aceitação
- Vaga de outro anunciante: 403.
- A resposta não contém CPF nem data de nascimento completa, em nenhum campo.
- Cada mudança gera linha no histórico.

---

# TASK 18: Banco de talentos e contato

## Entregas (RF27)
- Busca de candidatos por escolaridade, curso, cidade e palavra-chave — **só anunciante verificado** (RN-V5).
- Ver perfil e enviar mensagem de interesse, que gera notificação e e-mail ao candidato.
- Tabela `contacts`: `anunciante_id`, `candidato_id`, `enviado_por` FK, `mensagem`, `criado_em`.

## Regras
- **RN-C9:** aparecem só candidatos com visibilidade `so_verificados` ou `publico`. E-mail, telefone e link de currículo **nunca** aparecem no mural; só para anunciantes verificados ou para os das vagas a que o candidato se candidatou.
- Anunciante **nunca** vê CPF.

## Critérios de aceitação
- Anunciante não verificado: 403.
- Candidato `oculto` não aparece.
- A resposta não contém CPF.

---

# TASK 19: Mural público de candidatos

## Entregas (RF19)
- Mural **sem login**: cartões resumidos dos candidatos `publico` — primeiro nome + inicial do sobrenome, foto se houver, escolaridade, formação principal, cidade.
- Por curso, um total que conta **todos** os candidatos cadastrados, inclusive os ocultos, só como número (ex.: "312 pessoas de Administração").

## Regras
- Contatos nunca aparecem no mural (RN-C9, RN-C11).
- **RNF04:** cartões com esqueleto cinza enquanto as fotos carregam; fotos redimensionadas no envio e com carregamento sob demanda.

## Critérios de aceitação
- Candidato `oculto` não aparece como cartão, mas **conta** no total do curso.
- Nenhum e-mail, telefone ou link de currículo na resposta.

---

# TASK 20: Denúncias

## Entregas (RF31)
- Tabela `reports`: `vaga_id`, `usuario_id`, `motivo` (`cobra_dinheiro | falsa | ofensiva | outro`), `descricao?`, `situacao` (`aberta | procedente | improcedente`), `resolvida_por?`, `criada_em`, **UK (vaga_id, usuario_id)**.
- Fila no painel do admin; julgar procedente ou improcedente.

## Regras
- **RN-V7:** 3 denúncias de usuários diferentes passam a vaga para **suspensa** até o admin julgar. Cada usuário denuncia uma vaga uma única vez.
- **RN-V8:** procedente encerra a vaga; o admin decide se também desativa o anunciante. Improcedente devolve a vaga.
- Denunciantes **não são identificados** ao anunciante.
- Qualquer usuário logado denuncia (candidato ou responsável).

## Critérios de aceitação
- Segunda denúncia do mesmo usuário à mesma vaga: 409.
- Na 3ª denúncia de usuários distintos, a vaga some da busca.
- Improcedente devolve a vaga para `aberta`.

---

# TASK 21: Notificações no site e por e-mail

## Entregas (RF35)
- Tabela `notifications`: `usuario_id`, `tipo`, `texto`, `link?`, `lida_em?`, `criada_em`.
- Sino no site e e-mail para: mudança de candidatura, nova candidatura, contato de anunciante, resultado de verificação e de denúncia.
- Listar e marcar como lida.

## Regras
- A notificação é gravada **na mesma transação** da ação que a origina; o e-mail sai depois e a falha dele não desfaz a ação.

## Critérios de aceitação
- Cada um dos cinco eventos gera notificação.
- Falha no envio de e-mail não desfaz a mudança de situação.
- Notificação de outro usuário: 403.

---

# TASK 22: Rotinas diárias: validade de 60 dias

## Entregas
- Tarefa diária que encerra vagas **60 dias após a publicação** (RN-VG2, RN-P4). Sem renovação.
- Aviso ao anunciante **7 dias e 1 dia antes** do encerramento automático.
- Ao encerrar, as candidaturas em andamento passam a `Cancelada` e os candidatos são avisados.
- Mesmo efeito quando o anunciante escolhe o candidato (RF25) ou é desativado (RN-VG7).

## Regras
- O cancelamento automático entra no histórico com `alterado_por` vazio (sistema).
- Idempotente: rodar duas vezes no mesmo dia não duplica avisos.

## Critérios de aceitação
- Vaga publicada há 60 dias e 1 min é encerrada na execução seguinte.
- As candidaturas em andamento viram `Cancelada`, com histórico de autor "sistema".
- Rodar a tarefa duas vezes não gera aviso duplicado.

---

# TASK 23: Exclusão de conta por anonimização

> **Bloqueada:** depende da decisão **D3** (visibilidade do CPF) e da pendência **P5** do SRS (encarregado de dados, canal do titular e textos de termos/política).

## Entregas (RF18, RN-L)
- Exclusão pela própria tela, confirmando com a senha. **Efeito imediato, sem fila.**
- **RN-L2:** anonimizar, não apagar — nome vira "Usuário removido", e-mail vira valor aleatório; CPF, telefone, data de nascimento, foto, resumo, link e formações são apagados; sessões e tokens apagados; `ativo = false`. Isso exige que `cpf` e `data_nasc` sejam **anuláveis**.
- **RN-L3:** candidaturas em andamento canceladas; as finalizadas permanecem anonimizadas no histórico do anunciante. Contatos, notificações e denúncias ficam sem identificação.
- **RN-L4:** anunciante PF que exclui a conta tem as vagas abertas encerradas e os dados pessoais anonimizados; PJ anonimiza só os dados do responsável.

## Critérios de aceitação
- **RN-L6:** como o CPF é apagado, a pessoa consegue criar conta nova com o mesmo CPF.
- Senha errada não exclui.
- Nenhuma linha é removida fisicamente; as FKs continuam válidas.
- **RN-L5:** backups expiram em até 30 dias, e a política de privacidade informa o prazo.

---

# TASK 24: Central de Segurança e páginas públicas

## Entregas
- **RF36:** página pública, sem login, com dicas para candidatos e anunciantes — como reconhecer golpes, nunca pagar taxa, como verificar a outra parte, cuidado com links e arquivos, o que o site guarda e o que não guarda, e como denunciar. Link fixo no rodapé, no cadastro e na tela de cada vaga.
- **RF40:** página "Anuncie aqui", explicando os espaços de patrocínio e trazendo o contato do administrador. **Não há envio de imagem nem pagamento pelo site.**

## Critérios de aceitação
- Ambas respondem sem token.
- O link da Central aparece na resposta de cada vaga.

---

# TASK 25: Patrocínios

## Entregas (RF38)
- Tabela `sponsorships`: `patrocinador` (texto), `imagem_url`, `link`, `posicao` (`topo | lateral | rodape`), `inicio`, `fim`, `valor_mensal?`, `criado_por` FK.
- Cadastro pelo admin; o anúncio aparece **só no período** e sempre com o rótulo "Patrocinado".

## Regras
- A negociação é **fora do site** (WhatsApp ou e-mail, com contrato e nota fiscal). O site só exibe.
- O patrocinador **não pode anunciar vagas pelo espaço de patrocínio**: vaga se publica pelo fluxo normal e pago.
- Nunca aparece dentro da página de uma vaga nem no fluxo de candidatura (SRS 2.4).

## Critérios de aceitação
- Patrocínio fora do período não é devolvido.
- A resposta de uma página de vaga nunca contém patrocínio.

---

# TASK 26: Compartilhamento e origem de acesso

## Entregas
- **RF42:** endereço legível por vaga; metatags Open Graph com título, tipo, cidade e selo de verificação, para o cartão aparecer no Instagram e no WhatsApp. No painel do admin, geração da arte da vaga em 1080×1080 e 1080×1920 para post e story.
- **RF43:** marcador de origem (`?origem=instagram`); o sistema conta visitas e candidaturas por origem, **sem identificar pessoas**.

## Regras
- A publicação no Instagram é **manual na v1** (SRS 2.5); a API da Meta fica para depois.
- A contagem por origem é agregada — nada que ligue a uma pessoa.

## Critérios de aceitação
- O cartão de prévia mostra título, tipo, cidade e selo.
- A contagem por origem não guarda identificador de usuário.

---

# TASK 27: Documentação e entrega

## Entregas
- Swagger completo, com o esquema de segurança declarado como `http`/`bearer` **sem** `bearerFormat: JWT` — o token é opaco, e declarar JWT faria ferramentas tentarem decodificá-lo.
- README com setup, variáveis, scripts e decisões (já existe; manter atualizado).
- Verificação final dos RNF: HTTPS (RNF02), responsividade e WCAG AA como meta (RNF05), auditoria de candidatura e decisões do admin (RNF07).
- Backup diário do banco, guardado fora da VPS (SRS 2.3).

---

## Fora do escopo da v1 (SRS 9.3)

Verificação automática de CNPJ por API; confirmação de e-mail no cadastro (recomendada logo após a v1); chat interno; pedido de patrocínio pelo site; restrição de vaga por instituição (removida na v4.0); upload de currículo em PDF; dois fatores para administrador; auditoria ampliada de login e logout; expansão para outras cidades (o campo já existe); confirmação automática de PIX; destaque pago de vaga (**P9**); postagem automática no Instagram.
