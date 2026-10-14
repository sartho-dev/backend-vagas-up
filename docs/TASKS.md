# Estagia CG: Plano de tasks do back-end

Baseado no SRS v3.2 (03/10/2026) e no estado do repositório enviado (módulos `auth`, `student` e `admin`).
Cada task segue o modelo da task "Módulo de Administração, fase 1": contexto, objetivo, fora do escopo, subtarefas (entregas, regras, critérios de aceitação), pontos de atenção e endpoints sugeridos.

---

## Convenções válidas para todas as tasks

Para não repetir em cada task, vale para todas:

**Padrão de código**
- Módulo em `modules/<nome>/` com `interfaces/` (ou `interface/`), `schema/`, `repository/`, `service/`, `controller/`, `validators/`, `types/` e `<nome>Routes.ts`. O DataSource já carrega `modules/**/schema/*.{js,ts}`.
- O repositório informa **o que aconteceu** (por exemplo `"deactivated" | "not_found" | "last_active"`); o service decide o status HTTP.
- Resposta com `ApiResponse`, erro com `AppError`, controller com `asyncHandler`, input com Zod `.strict()`. Nada devolve `password_hash`.
- Id de rota validado como UUID antes de chegar ao banco (senão vira 500).
- E-mail normalizado com trim + lowercase (como no `LoginValidator`).
- Toda unicidade tem **constraint no banco**; a checagem prévia no service é só a resposta amigável, e a violação `23505` vira 409.
- Toda FK com `ON DELETE` restritivo (RNF08); toda PK é UUID (RNF09).
- RN06 (e-mail único entre perfis) passa sempre pelo `EmailRegistry`. Perfil novo = registrar o repositório no `Map` do container.
- Rota de perfil protegida: `authenticate` + `authorize(AccountRole.X)`, aplicado **uma vez** no router (como em `adminRoutes.ts`), para nenhuma rota nova esquecer.
- Operação que checa e altera estado compartilhado (último admin, último responsável, limite de aprovados) roda em transação com lock.

**Definição de pronto (comum)**
- Migration nova, nomeada pelo assunto (não `Init`), que roda do zero e reverte.
- Cada RF e RN citado na task tem teste do caminho feliz e do erro, com status e mensagem definidos.
- Rotas novas documentadas no Swagger.
- Rota protegida testada com: sem token (401), token de outro perfil (403), token válido (sucesso).
- README atualizado quando a task cria script, variável de ambiente ou passo de setup.

---

## Visão geral

| # | Task | RF / RN principais | Depende de | Status |
|---|------|--------------------|------------|--------|
| 01 | Administração, fase 1 | RF18, RF19, RF20 (estudante), RF21, RF22, RF23, RN06 | — | Em andamento (sub 1 e 2 escritas, 3 a 6 não iniciadas) |
| 02 | Fundação: testes, CI e limpeza | RNF01, RN28 | — | A fazer |
| 03 | Alinhar o estudante à v3.2 | RF03, RF04, RN06, RN20, RN25, RN26 | 02 | A fazer |
| 04 | Limitação de tentativas de login | RN22, RN23 | 02 | A fazer |
| 05 | E-mail e tokens de uso único | RNF11 | 02 | A fazer |
| 06 | Recuperação de senha | RF01, RN20, RN24 | 05, 04 | A fazer |
| 07 | Confirmação de e-mail alterado | RF04, RF22, RN27 | 05, 03 | A fazer |
| 08 | Matrícula do estudante | RF05, RN02, RN08, RN09, RN15 | 01 (sub 5), 03 | A fazer |
| 09 | Empresa e responsável | RF11, RF13, RF22, RN05, RN06, RN14 | 05, 07 | A fazer |
| 10 | Convite e gestão de responsáveis | RF12, RN14 | 09 | A fazer |
| 11 | Vagas | RF14, RF15, RN03, RN04, RN10, RN17, RN28, RN30, RN31, RN35 | 01 (sub 5 e 6), 09 | A fazer |
| 12 | Busca de vagas | RF06, RNF04 | 11 | A fazer |
| 13 | Candidatura do estudante | RF07, RF08, RF09, RN01, RN07, RN11, RN12, RN16, RNF10 | 08, 11 | A fazer |
| 14 | Candidaturas na visão do responsável | RF16, RN13, RN16, RN29, RN32, RN34 | 13 | A fazer |
| 15 | Notificações e cancelamentos automáticos | RF17, RN16, RN33 | 05, 13, 14 | A fazer |
| 16 | Administração, fase 2: responsáveis e empresas | RF20, RN14, RN21, RN33 | 10, 11, 15 | A fazer |
| 17 | Exclusão de conta e LGPD | RF10, RNF03 | decisões P4 e P6 | **Bloqueada** |
| 18 | Documentação e entrega | RNF02, RNF07 | todas | A fazer |

**Ondas sugeridas**
1. Fechar a 01 e fazer a 02.
2. Autenticação: 03, 04, 05, depois 06 e 07.
3. Matrícula e empresa: 08, 09, 10.
4. Núcleo do produto: 11, 12, 13, 14.
5. Fechamento: 15, 16, 18. A 17 entra quando as decisões saírem.

## Decisões em aberto que travam tasks

| ID | Pendência (SRS 9.3) | Trava | Sugestão do SRS |
|----|---------------------|-------|-----------------|
| P2 | Validação da matrícula declarada pelo estudante | 08 | Sem validação nesta versão, com o risco documentado |
| P3 | Limites da extensão de prazo da vaga | 11 | Uma vez, só antes do vencimento, no máximo 30 dias, com aviso aos candidatos |
| P4 | Procedimento da exclusão de conta | 17 | Em aberto |
| P5 | Aprovação de empresa antes de publicar | 09, 11 | Publicam imediatamente, com o risco documentado |
| P6 | LGPD: encarregado, base legal, canal do titular | 17 | Buscar orientação jurídica |
| P7 | Como o sistema aparece como autor em `alterado_por` | 13 | Definir no projeto (ver task 13) |

---

# TASK 01: Módulo de Administração, fase 1

Descrita em detalhe na task original. Aqui só o estado atual e o que falta para fechar.

## Estado do código
- **Subtarefas 1 e 2 (base e gestão de admins): escritas.** Existem schema, repositório, `AdminAuthProvider`, `AdminService`, controller, validators, rotas, o script `create-first-admin.ts` e a migration da tabela `admins`.
- **Subtarefas 3 a 6: não iniciadas.** Não há gestão de estudantes pelo admin, `cpf_access_logs`, `courses`, `institutions` nem `modalities`.
- A decisão 1 dos pontos de atenção já foi tomada: a migration mais recente remove `institution`, `current_semester` e `expected_graduation` de `students`.

## Pendências para considerar a sub 1 e 2 fechadas
Pontos encontrados lendo o código enviado; vale conferir cada um no repositório real.

1. **`routes.ts` não monta `adminRoutes`.** Só `students` e `auth` estão registrados, então nenhuma rota de admin responde. Registrar em `/api/v1/admin` (critério de aceitação da sub 1).
2. **`AdminService.ts` usa tipos sem importar:** `ISessionRevoker`, `AdminResult`, `AdminListResult` e `OwnProfileResult`. Do jeito que está, não compila.
3. **`adminRoutes.ts` termina com dois `return router`** e um comentário no meio. Limpar.
4. **Caminho das rotas:** as rotas estão em `/administrators`, a task sugeria `/admins`. Escolher um e documentar (sugestão: manter `/api/v1/admin/administrators`, que fica sob o mesmo prefixo protegido das demais rotas de admin).
5. **RN06 retroativa no cadastro de estudante não foi feita.** `StudentService.createService` ainda chama `repository.existsByEmail` (só a tabela `students`). Trocar por `emails.isTaken(data.email)`.
6. **Script de carga:** a checagem de RN06 consulta só `students`; incluir `responsibles` quando a task 09 existir. Confirmar que existe o script `seed:admin` no `package.json` e que o README o documenta (definição de pronto).
7. **Swagger:** o glob em `shared/docs/swagger.ts` é `./src/routes/**/*.ts`, que não alcança `modules/**`. Corrigir na task 02; documentar as rotas de admin aqui.
8. **Não há testes no repositório enviado.** Os critérios de aceitação da sub 1 e 2 dependem da infraestrutura da task 02.

## Ordem das subtarefas restantes
5 e 6, depois 3 e 4. A sub 4 continua dependendo de decidir o formato de `cpf_access_logs` (decidir antes de começar).

**Ganchos que as tasks seguintes esperam da sub 5 (cursos e instituições)**
- Método de repositório isolado `hasLinks(id)` em cursos e em instituições. Hoje retorna `false`; a task 08 passa a consultar `enrollments` e a task 11 passa a consultar `vacancies` e `vacancy_allowed_institutions`.
- `GET` das listas liberado para estudante, responsável e admin. Para cursos, confirmar no SRS: o Anexo A só lista o admin, mas RF05 e RF14 exigem que estudante e responsável leiam a lista.

---

# TASK 02: Fundação, testes, CI e limpeza

## Contexto
O repositório não tem testes, e a definição de pronto de todas as tasks exige teste por RF e RN. Há também resquícios de outro projeto ("CyberCastle") e um fuso horário que contradiz o SRS.

## Objetivo
Deixar o projeto pronto para receber as demais tasks com teste automatizado e pipeline, e remover o que não pertence ao Estagia CG.

## Fora do escopo
Testes das tasks antigas além dos já exigidos pela task 01 e pela 03.

## Subtarefa 1: Infraestrutura de testes e CI
**Entregas**
- Framework de teste (Vitest ou Jest) e `supertest` para testes de rota.
- Banco de teste Postgres (docker compose ou Testcontainers) que roda as migrations do zero, isolado do banco de desenvolvimento.
- Helpers: `createStudent()`, `createAdmin()`, `loginAs(account)`, limpeza entre testes.
- Fake do serviço de e-mail (usado a partir da task 05) e relógio injetável (o `AuthService` já aceita `now`).
- Pipeline de CI: instalar, `tsc --noEmit`, lint, migrations do zero **e revert**, testes.

**Critérios de aceitação**
- `npm test` roda do zero numa máquina limpa.
- A CI falha se uma migration não reverte.
- Os testes da task 01 (login do admin, 401, 403, desativação, última conta ativa) passam.

## Subtarefa 2: Limpeza e alinhamento ao SRS
**Entregas**
- **Fuso (RN28):** `main.ts` define `TZ` com `BILLING_TIMEZONE`, padrão `America/Sao_Paulo` (UTC−3). O SRS manda `America/Campo_Grande` (UTC−4). Trocar o padrão, renomear a variável e garantir que datas sejam gravadas em UTC (`timestamptz`).
- `shared/config/index.ts`: remover o que é do outro projeto (`refreshTokenCleanupIntervalMinutes`, comentário de distratos) e o nome de banco `cybercastle_dev`; título do Swagger ("CyberCastle API").
- `.env.example` completo (banco, `BCRYPT_COST`, sessão, SMTP, `APP_BASE_URL`, `TZ`, `ADMIN_*` para o script).
- Swagger: corrigir o glob de `apis` para alcançar `modules/**`.
- Centralizar o custo do bcrypt: criar um `PasswordHasher` compartilhado que aplica o mínimo 12 (RNF01). Hoje `AdminService` aplica o mínimo e `StudentService` tem `BCRYPT_COST = 12` fixo.

**Pontos de atenção**
- Idioma das mensagens de erro: os módulos usam inglês e o `errorHandler` usa português ("Dados inválidos", "Erro interno do servidor"). Decidir um só e aplicar daqui em diante. O SRS exige uma mensagem específica em português ("E-mail ou senha inválidos", RN23), o que sugere português para o que o usuário final lê.
- Não editar migrations já aplicadas; só criar novas.

**Critérios de aceitação**
- Dado um prazo "2026-12-01T23:59:00-04:00", o banco guarda o instante em UTC e a API devolve o mesmo instante.
- Nenhuma ocorrência de "cybercastle" ou "distrato" no código.

---

# TASK 03: Alinhar o módulo do estudante à v3.2

## Contexto
O módulo `student` foi escrito antes da v3.0 e diverge do SRS em pontos que afetam segurança e conformidade.

## Objetivo
Fazer o cadastro e o perfil do estudante cumprirem RF03, RF04, RN06, RN20, RN25 e RN26.

## Fora do escopo
Troca de e-mail com confirmação (task 07), matrícula (task 08), exclusão de conta (task 17).

## Subtarefa 1: Cadastro conforme o SRS
**Regras**
- **RN25:** `CreateStudentValidator` tem senha de 8 caracteres com maiúscula, minúscula e número. O SRS pede 10 a 64, sem exigência de tipos. Usar o `passwordSchema` compartilhado (que já valida os 72 bytes do bcrypt, PR6), exportado de um único lugar.
- **RN26:** idade mínima de 16 anos **na data do cadastro**. Hoje só valida que a data não é futura. Calcular no fuso de Campo Grande; testar o dia exato do aniversário de 16 anos.
- **RN06:** usar `emails.isTaken` (ver pendência 5 da task 01).
- PR7: a idade mínima tem ressalva jurídica no SRS; manter a constante configurável em um ponto só.

**Critérios de aceitação**
- Senha de 9 caracteres é recusada; senha de 10 só com letras minúsculas é aceita; senha de 65 caracteres é recusada; senha de 64 caracteres com acentos que passe de 72 bytes é recusada.
- Nascido há 15 anos e 364 dias é recusado; há exatamente 16 anos é aceito.

## Subtarefa 2: Perfil próprio e troca de senha (RF04)
**Entregas**
- `GET /api/v1/students/me`: o estudante lê o próprio perfil (CPF completo, só para ele, RN32). Hoje não há rota de leitura.
- `PATCH /api/v1/students/me/password`: exige senha atual; aplica RN25; ao trocar, `revokeAllSessions(STUDENT, id)` e a resposta avisa que é preciso entrar de novo (RN20). Mesmo desenho do admin.
- `authorize(AccountRole.STUDENT)` na rota de edição. Hoje `PATCH /students` só tem `authenticate`, então um token de admin chega ao service (RF02).
- Mover `PATCH /students` para `PATCH /students/me`, mantendo a rota antiga até o front migrar (ou decidir que não há front ainda e trocar direto).

**Critérios de aceitação**
- Senha atual errada: 400 com mensagem definida (não 401, para o cliente não confundir com sessão expirada).
- Depois da troca, o token usado na própria requisição deixa de funcionar na seguinte.
- Token de admin em `PATCH /students/me`: 403.

## Pontos de atenção
- O `UpdateStudentValidator` ainda aceita `email`; a task 07 remove isso ao introduzir a confirmação. Até lá, manter a checagem de RN06.
- A tabela de estudante tem perfil profissional (bio, idiomas, experiências, habilidades, certificações) que o SRS não cita. Não mexer; só confirmar com o autor se continua no escopo.

---

# TASK 04: Limitação de tentativas de login

## Contexto
RN22 e RN23 exigem bloqueio por tentativas. O `AuthService` já usa um hash falso para igualar o tempo de resposta quando o e-mail não existe, mas não há contador.

## Objetivo
Bloquear tentativas de login em excesso sem revelar se o e-mail existe e sem abrir brecha para bloquear a conta de outra pessoa de forma permanente.

## Fora do escopo
Limite de pedidos de recuperação de senha (task 06), limite geral de requisições (task 18).

## Subtarefa 1: Controle de tentativas
**Modelo de dados:** tabela `login_attempts` (o SRS deixa o armazenamento para o projeto). Sugestão: Postgres, porque o serviço pode rodar em mais de uma instância (Cloud Run) e um contador em memória não vale.
- Falhas por chave `email` e por chave `ip`, com data/hora, na janela de 15 minutos.
- Guardar o e-mail normalizado ou um hash dele (decidir; hash evita guardar e-mails inexistentes digitados).

**Regras**
- **RN22:** 5 falhas seguidas para o mesmo e-mail bloqueiam por 15 minutos. Limite por origem: 20 falhas em 15 minutos. Login bem-sucedido zera o contador do e-mail. E-mail inexistente conta igual a existente.
- **RN23:** e-mail inexistente, senha errada e conta desativada recebem a mesma mensagem ("E-mail ou senha inválidos"). O bloqueio devolve 429 pedindo para tentar mais tarde, sem indicar se o e-mail existe. A mensagem de bloqueio é a mesma para e-mail existente e inexistente.
- O IP vem de `req.ip` com o `trust proxy` já configurado (`TRUST_PROXY_HOPS`). Documentar o valor correto por ambiente, senão o limite por origem vira limite global.
- Durante o bloqueio, nem a senha correta entra (e nem o bcrypt é calculado, para não virar vetor de custo).
- Limpeza das tentativas antigas: apagar por consulta preguiçosa ou rotina simples. Não depende de tarefa agendada para a regra funcionar.

**Critérios de aceitação**
- 5 falhas: a 6ª tentativa, mesmo com a senha certa, recebe 429.
- Passados 15 minutos (relógio injetado), o login volta a funcionar.
- Resposta para e-mail inexistente e existente com bloqueio é idêntica (corpo e status).
- 20 falhas de IPs misturando e-mails diferentes bloqueiam o IP.
- Login correto antes de 5 falhas zera o contador.

## Pontos de atenção
- Corrida: duas requisições simultâneas devem contar as duas. Usar incremento atômico (`INSERT ... ON CONFLICT DO UPDATE`) ou inserir uma linha por falha.
- RN19 (sessão única) já está no `replaceActiveSession`; só garantir teste.

---

# TASK 05: E-mail e tokens de uso único

## Contexto
Recuperação de senha, convite de responsável, confirmação de e-mail e notificações dependem do envio de e-mail e de links de uso único. `config.mail` existe, mas não há serviço de envio nem tabela de tokens. RNF11: um vazamento do banco não pode permitir usar links ainda válidos.

## Objetivo
Entregar a infraestrutura compartilhada que as tasks 06, 07, 10 e 15 consomem.

## Fora do escopo
Os fluxos em si (tasks 06, 07, 10) e os e-mails de candidatura (task 15).

## Subtarefa 1: Serviço de e-mail
**Entregas**
- Interface `IEmailSender` + implementação SMTP (nodemailer) usando `config.mail`; implementação fake para teste e desenvolvimento.
- Variável `APP_BASE_URL` para montar links.
- Templates em arquivos próprios, em português.
- Envio **sem bloquear** a resposta HTTP: falha de envio é registrada em log e não derruba a requisição.

**Regras**
- O tempo de resposta não pode depender de o e-mail existir (RN24 exige resposta idêntica; um envio síncrono só para e-mails existentes vaza a informação por tempo).

## Subtarefa 2: Tokens de uso único
**Modelo de dados:** tabela `one_time_tokens`: `id` (UUID), `type` (`password_reset`, `responsible_invite`, `email_change`), `account_role` e `account_id` (ou `company_id` para convite), `token_hash`, `expires_at`, `used_at`, `created_at`, `payload` (jsonb; por exemplo o novo e-mail ou o e-mail convidado).

**Regras**
- **RNF11:** só o **hash** (SHA-256) do token vai para o banco; o token em claro, com 256 bits aleatórios, existe apenas no e-mail. Mesmo padrão do `AuthService`.
- Consumo atômico: `UPDATE ... SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING ...`. Dois cliques simultâneos usam o link uma vez só.
- Emitir novo token do mesmo tipo e conta invalida os anteriores (RN24).
- Validades (por tipo, em constantes de configuração): recuperação 30 min, convite 72 h, confirmação de e-mail 24 h.
- Mensagem única para token inexistente, expirado ou já usado.

**Critérios de aceitação**
- Dump do banco não contém nenhum token utilizável (teste: o valor guardado não autentica).
- Segundo uso do mesmo token falha; uso após a validade falha; novo token invalida o antigo.
- Consumo concorrente do mesmo token: exatamente um sucesso.

---

# TASK 06: Recuperação de senha

## Contexto
RF01 inclui recuperar a senha por link no e-mail, para estudante, responsável e administrador. Não existe nenhum endpoint disso.

## Objetivo
Permitir redefinir a senha por link, sem revelar quais e-mails estão cadastrados.

## Fora do escopo
Troca de senha com sessão aberta (já existe no admin e vem na task 03 para o estudante).

## Subtarefa 1: Pedido e redefinição
**Entregas**
- `POST /api/v1/auth/forgot-password` `{ email }`.
- `POST /api/v1/auth/reset-password` `{ token, newPassword }`.
- Extensão do `IAuthAccountProvider` com `findByEmail(email)` (id, ativo) e `updatePassword(id, hash)`, implementada em cada provider (estudante, admin e, depois, responsável). O registro do e-mail segue RN06, então no máximo um provider responde.

**Regras**
- **RN24:** o pedido devolve **sempre a mesma resposta e o mesmo status** ("Se o e-mail estiver cadastrado, você receberá as instruções"), exista a conta ou não. Conta desativada não recebe e-mail, mas a resposta é a mesma.
- Link de 30 minutos, uso único; novo pedido invalida os anteriores.
- **Máximo de 3 pedidos por hora por e-mail**, contando também e-mails inexistentes. Acima disso, a resposta continua idêntica (não devolver 429, que revelaria algo) e nenhum e-mail novo é enviado.
- **RN25** na nova senha (`passwordSchema`).
- **RN20:** redefinir encerra todas as sessões da conta.
- A senha nova pode ser igual à antiga? Decidir (sugestão: aceitar).

**Critérios de aceitação**
- Resposta idêntica (corpo, status e, dentro de uma tolerância, tempo) para e-mail cadastrado, inexistente e desativado.
- Token usado duas vezes: segunda falha. Token vencido: falha. Segundo pedido: o primeiro link deixa de valer.
- Quarto pedido na mesma hora não envia e-mail.
- Depois de redefinir, o token de sessão anterior retorna 401 e o login com a senha antiga falha.

## Pontos de atenção
- O limite de 3 por hora usa a mesma ideia de armazenamento da task 04; reaproveitar a tabela ou o mecanismo, se couber.
- Não logar o token nem o e-mail completo em nível de erro.

---

# TASK 07: Confirmação de e-mail alterado

## Contexto
RF04 e RF22 exigem confirmar por link a troca de e-mail (RN27). Hoje o estudante troca o e-mail direto pelo `PATCH`, e o admin não pode trocar (o schema rejeita o campo, esperando esta task).

## Objetivo
Trocar o e-mail só depois de o dono do novo endereço confirmar, mantendo o antigo valendo até lá.

## Fora do escopo
Confirmação de e-mail no cadastro (adiada, SRS 9.4).

## Subtarefa 1: Pedido de troca e confirmação
**Entregas**
- `POST /api/v1/<perfil>/me/email` `{ newEmail, currentPassword }` para estudante e admin (responsável quando existir na task 09).
- `POST /api/v1/auth/confirm-email` `{ token }`.
- Remover `email` do `UpdateStudentValidator` e do caminho de `update`.

**Regras**
- **RN27:** o link vai para o **novo** endereço e vale 24 horas. O e-mail anterior continua valendo para login até a confirmação.
- **RN06:** checar no pedido **e de novo na confirmação** (alguém pode ter ocupado o endereço no intervalo). Conflito na confirmação: erro de negócio, sem trocar.
- Pedir a senha atual para iniciar a troca (sugestão; protege contra sessão roubada). Confirmar com o autor.
- Novo pedido invalida o anterior.
- Pedir troca para o próprio e-mail atual é recusado.
- Trocar o e-mail encerra as sessões? O SRS não diz; sugestão: não.

**Critérios de aceitação**
- Antes de confirmar, o login continua com o e-mail antigo e o novo ainda não entra.
- Depois de confirmar, o contrário.
- Endereço de outro perfil (RN06 cruzada) é recusado no pedido e na confirmação.
- Token vencido ou reutilizado falha.

## Pontos de atenção
- A unique constraint de cada tabela cobre a corrida dentro da mesma tabela; entre tabelas distintas a corrida continua aceita, como já documenta o `EmailRegistry`. Se o autor quiser fechar essa brecha, uma tabela única de e-mails (`account_emails`) seria o caminho; registrar como decisão, fora desta task.

---

# TASK 08: Matrícula do estudante

## Contexto
RF05 move instituição e curso do cadastro para a matrícula. A candidatura (RN12) e a busca dependem dela. Cursos e instituições vêm da task 01 (sub 5).

## Objetivo
O estudante registra e acompanha suas matrículas, com a máquina de estados de RN15.

## Fora do escopo
Validar se a matrícula é verdadeira (P2: sem validação nesta versão, risco documentado no README). Cursos oferecidos por instituição (adiado, 9.4).

## Subtarefa 1: Modelo e cadastro
**Modelo de dados:** `enrollments`: `id`, `student_id`, `institution_id`, `course_id`, `start_date`, `end_date` (nula), `semester` (AAAA/SS), `status` (`active`, `locked`, `completed`, `cancelled`), `created_at`. FKs restritivas.

**Regras**
- **RN08:** sem duas matrículas ativas no mesmo curso **na mesma instituição**. Índice único parcial no banco.
- **RN09:** `end_date`, quando informada, não pode ser anterior a `start_date`; fica vazia enquanto ativa.
- **Semestre:** formato `AAAA/SS`, por exemplo `2026/02`. Decidir se `SS` aceita só `01` e `02` ou outros valores.
- Curso e instituição precisam existir; qualquer combinação é aceita (PR26).

**Decidir antes de começar:** RN08 fala em matrícula **ativa**, e RN15 deixa a trancada voltar a ativa. Se o aluno trancar a matrícula A, criar a B (ativa, mesmo curso e instituição) e destrancar A, haveria duas ativas. Opções: o índice único também cobre `locked`, ou a transição `locked → active` revalida. Sugestão: revalidar na transição, dentro de transação.

**Critérios de aceitação**
- Segunda matrícula ativa no mesmo curso e instituição: 409. Mesmo curso em outra instituição: aceita.
- `end_date` anterior ao início: 400. Semestre `2026-2`: 400.
- Instituição ou curso inexistente: 404 ou 400 (definir).

## Subtarefa 2: Situação da matrícula (RN15)
**Regras**
- Transições: ativa → trancada, concluída ou cancelada; trancada → ativa ou cancelada. Concluída e cancelada são finais. Qualquer outra transição: 409.
- Ao sair de **Ativa** (para trancada, concluída ou cancelada), chamar o gancho `onEnrollmentLeftActive(studentId, courseId, institutionId)`. A task 15 implementa o cancelamento das candidaturas em andamento (RN16); até lá o gancho é um no-op, mas já está testado como chamado.
- Concluída e cancelada preenchem `end_date`? Definir (sugestão: sim, com a data atual se não informada).
- Edição de datas e semestre: permitir enquanto ativa. Exclusão física: não há (histórico).

**Entrega complementar:** passar `hasLinks` de curso e de instituição (task 01, sub 5) a consultar `enrollments`.

**Critérios de aceitação**
- Cada transição proibida do RN15 retorna 409; cada permitida funciona.
- Um estudante só enxerga e altera as próprias matrículas (outro id: 404).
- Excluir curso ou instituição com matrícula: 409.

## Endpoints sugeridos
- `POST /api/v1/students/me/enrollments`, `GET /api/v1/students/me/enrollments`, `PATCH /api/v1/students/me/enrollments/:id`, `PATCH /api/v1/students/me/enrollments/:id/status`
- `GET /api/v1/courses`, `GET /api/v1/institutions` (da task 01)

---

# TASK 09: Empresa e responsável

## Contexto
Não existe nenhum código do perfil Responsável nem da Empresa. O `AuthService` aceita novos providers e o `EmailRegistry` aceita novos repositórios.

## Objetivo
Responsável consegue cadastrar a empresa junto com a própria conta, entrar, editar a empresa e o próprio perfil.

## Fora do escopo
Convite de outros responsáveis e desativação de responsável (task 10), desativação de empresa pelo admin (task 16), troca de e-mail do responsável (usa a task 07).

## Subtarefa 1: Modelo e cadastro (RF11)
**Modelo de dados (§6.3):** `companies` (`id`, `cnpj` único, `trade_name`, `legal_name`, `email` **não único**, `active`, `created_at`), `company_phones`, `responsibles` (`id`, `company_id`, `name`, `email` único, `password_hash` com `select: false`, `active`, `created_at`), `responsible_phones`.

**Regras**
- Cadastro **atômico**: empresa e primeiro responsável na mesma transação.
- **CNPJ** validado pelos dígitos verificadores; único. Extrair a validação de CPF para um módulo compartilhado (`shared/validators/documents`) e criar a de CNPJ ao lado.
- **RN06:** e-mail do responsável único entre os três perfis (`EmailRegistry`). O e-mail da empresa é contato institucional e não precisa ser único.
- **RN25** na senha; custo bcrypt pelo `PasswordHasher`.
- Telefones opcionais.
- **P5 (decidir):** empresa publica imediatamente ou espera aprovação. Sugestão do SRS: imediatamente, com o risco de empresas falsas documentado.

**Critérios de aceitação**
- CNPJ inválido ou repetido: recusado. E-mail de responsável já usado por estudante ou admin: 409. E-mail de empresa repetido: aceito.
- Falha ao gravar o responsável não deixa empresa órfã.

## Subtarefa 2: Login do responsável
**Entregas**
- `ResponsibleAuthProvider` (`role = RESPONSIBLE`), registrado no array do `AuthService` e no `Map` do `EmailRegistry`.
- `findForLogin` só com responsável ativo **e empresa ativa**; `isActive` verifica as duas coisas a cada requisição (RN21: responsável de empresa desativada não entra e perde o acesso na hora).
- Incluir `responsibles` na checagem de RN06 do script `create-first-admin.ts`.

**Critérios de aceitação**
- O responsável entra em `POST /auth/login` e recebe `role: "responsible"`.
- Responsável desativado, ou de empresa desativada, não entra; sessão aberta cai na requisição seguinte.

## Subtarefa 3: Edição de empresa e de perfil (RF13, RF22)
**Funcionalidades**
- `PATCH /companies/me`: todos os dados da empresa, **exceto o CNPJ** (rejeitar o campo, `.strict()`).
- `GET /responsibles/me` e `GET /companies/me`.
- `PATCH /responsibles/me`: nome, telefones e senha. Senha exige a atual e encerra todas as sessões (RN20, resposta avisa). E-mail só pela task 07.

**Regras**
- **RN13 (base):** o responsável só acessa a própria empresa. O `companyId` vem **do responsável autenticado**, nunca do corpo ou da URL. Criar um ponto único para resolver isso, reaproveitado nas tasks 10, 11 e 14.

**Critérios de aceitação**
- Enviar `cnpj` em `PATCH /companies/me`: 400.
- Token de estudante ou admin em rota de responsável: 403.
- Dois responsáveis da mesma empresa veem e editam a mesma empresa; de empresas diferentes, não.

## Endpoints sugeridos
- `POST /api/v1/companies` (público), `GET|PATCH /api/v1/companies/me`
- `GET|PATCH /api/v1/responsibles/me`

---

# TASK 10: Convite e gestão de responsáveis

## Contexto
Uma empresa pode ter vários responsáveis (RN05). O primeiro nasce no cadastro da empresa; os demais entram por convite (RF12). RN14 exige sempre ao menos um responsável ativo.

## Objetivo
Convidar responsáveis por e-mail, aceitar o convite e desativar responsáveis com segurança.

## Fora do escopo
Desativação feita pelo admin (task 16), reativação (só o admin, task 16).

## Subtarefa 1: Convite (RF12)
**Entregas**
- `POST /companies/me/invites` `{ email }` (responsável).
- `GET /invites/:token`: valida o link e devolve o nome da empresa.
- `POST /invites/accept` `{ token, name, password, phones? }`: o convidado **define a própria senha**, nunca recebe senha por e-mail.
- Usa `one_time_tokens` do tipo `responsible_invite`, com `company_id` e o e-mail convidado no `payload`.

**Regras**
- Link vale 72 horas, uso único.
- **RN06:** e-mail já cadastrado em qualquer perfil: convite recusado, na emissão e de novo na aceitação.
- O convidado entra na empresa **do convite**, não em outra.
- Reenviar convite para o mesmo e-mail invalida o anterior.

**Critérios de aceitação**
- Convite para e-mail de estudante, admin ou responsável: 409.
- Link vencido, usado ou de outra empresa: falha.
- Aceitar cria o responsável ativo, vinculado à empresa certa, e ele consegue entrar.

## Subtarefa 2: Desativação de responsável (RN14, RN21)
**Regras**
- O responsável pode ser desativado por si mesmo ou por outro responsável **da mesma empresa**.
- **Nunca o último ativo.** Verificação em transação com lock nas linhas ativas da empresa (mesmo padrão do `AdminRepository.deactivate`), para dois responsáveis se desativando ao mesmo tempo não zerarem a empresa.
- **RN21:** desativar encerra as sessões do desativado (`revokeAllSessions(RESPONSIBLE, id)`).
- Responsável de outra empresa: 404 (não 403, para não confirmar a existência).

**Critérios de aceitação**
- Desativar o último ativo: 409. Dois pedidos simultâneos entre os dois últimos: só um sucede.
- O desativado perde acesso na requisição seguinte.

## Endpoints sugeridos
- `POST /api/v1/companies/me/invites`, `GET /api/v1/invites/:token`, `POST /api/v1/invites/accept`
- `GET /api/v1/companies/me/responsibles`, `PATCH /api/v1/companies/me/responsibles/:id/deactivate`

---

# TASK 11: Vagas

## Contexto
É o centro do produto: a empresa publica, edita, encerra e exclui vagas. Depende de cursos e modalidades (task 01, sub 5 e 6) e do responsável autenticado (task 09). A tabela de candidaturas só existe na task 13, então as regras que dependem dela ficam atrás de um método de repositório isolado.

## Objetivo
O responsável publica e gerencia as vagas da própria empresa, com todas as validações do SRS.

## Fora do escopo
Busca pelo estudante (task 12), candidaturas (tasks 13 e 14), efeitos de encerramento sobre candidaturas e e-mails (task 15).

## Subtarefa 1: Modelo e publicação (RF14)
**Modelo de dados (§6.3):** `vacancies`: `id`, `company_id`, `course_id`, `modality_id`, `title`, `description`, `published_at` (gerada pelo sistema), `application_deadline` (timestamptz), `weekly_hours`, `positions` (padrão 1), `status` (`open`, `closed`); opcionais `city` (padrão Campo Grande/MS), `requirements`, `benefits`, `compensation`, `duration`, `schedule`. `vacancy_allowed_institutions`: `id`, `vacancy_id`, `institution_id`, com par único.

**Regras**
- **RN03, RN04:** a vaga pertence a um curso e a uma empresa; a empresa vem do responsável autenticado.
- **RN10:** `application_deadline` não pode ser anterior a `published_at`.
- **RN28:** o prazo chega com data, hora e fuso (America/Campo_Grande), é gravado em UTC. Recusar prazo sem fuso explícito ou definir o fuso padrão e documentar.
- **RN30:** `weekly_hours` de 1 a 30. Constante única de configuração, mais `CHECK` no banco. O SRS manda conferir o texto da Lei 11.788/2008 (art. 10) antes de implementar.
- `positions` mínimo 1. `city` só aceita Campo Grande por ora; guardar o campo, validar o valor.
- **RN35:** instituições permitidas são zero ou mais; vazio significa qualquer instituição. IDs duplicados na lista: recusar ou deduplicar (definir).
- A vaga nasce `open`.
- Só empresa ativa publica (já garantido pelo login, mas testar).

**Critérios de aceitação**
- Prazo anterior à publicação: 400. Carga de 31 horas: 400. Curso ou modalidade inexistente: recusado. Instituição inexistente na lista: recusado.
- Vaga criada com instituições grava as duas tabelas na mesma transação.
- A vaga aparece só para o responsável da empresa dona (RN13); outro responsável recebe 404.

## Subtarefa 2: Edição, extensão de prazo, encerramento e exclusão (RF15)
**Regras**
- **Campos bloqueados após a primeira candidatura (PR13):** curso alvo, modalidade, carga horária, quantidade de posições e instituições permitidas. Os demais continuam editáveis. Implementar `hasApplications(vacancyId)` no repositório (retorna `false` até a task 13 criar a tabela; depois consulta `applications`). Tentar alterar campo bloqueado: 409 com mensagem que diga quais campos.
- **Encerramento (RN17):** `PATCH /vacancies/:id/close`. É definitivo: vaga encerrada não reabre nem recebe edição. Chama o gancho `onVacancyClosed(vacancyId)`; a task 15 cancela as candidaturas em andamento e avisa os candidatos. Encerrar vaga já encerrada: 409.
- **Fim do prazo não encerra a vaga (PR1):** não há tarefa agendada. "Recebendo candidaturas" = `open` **e** prazo não vencido, calculado na consulta.
- **Exclusão (RN31):** `DELETE` só sem candidaturas; com candidaturas, 409 orientando a encerrar. Apaga também as instituições permitidas.
- **Extensão de prazo (P3, decidir antes):** é permitida, mas os limites não estão definidos. Sugestão do SRS: uma vez, só antes do vencimento, no máximo 30 dias, com aviso aos candidatos (o aviso depende da task 15). Registrar a decisão e implementar; o novo prazo respeita RN10.

**Critérios de aceitação**
- Depois de existir candidatura, alterar `weekly_hours` retorna 409, e alterar `description` funciona.
- Vaga encerrada: edição, nova extensão e reabertura retornam 409.
- Excluir vaga com candidatura: 409; sem candidatura: 204 e some do banco.
- Vaga com prazo vencido continua `open` e continua visível ao responsável.

## Endpoints sugeridos
- `POST /api/v1/vacancies`, `GET /api/v1/vacancies/mine`, `GET /api/v1/vacancies/mine/:id`
- `PATCH /api/v1/vacancies/:id`, `PATCH /api/v1/vacancies/:id/close`, `DELETE /api/v1/vacancies/:id`

## Entregas complementares
- Passar `hasLinks` de curso (task 01) a consultar `vacancies`, e de instituição a consultar `vacancy_allowed_institutions`.
- Para a modalidade, expor `GET /api/v1/modalities` (leitura) se ainda não existir.

---

# TASK 12: Busca de vagas

## Contexto
RF06 e RNF04: o estudante busca vagas que recebem candidaturas, com filtros combináveis, e a busca precisa responder em até 3 segundos em 95% das requisições, com 10.000 vagas e 100 usuários simultâneos.

## Objetivo
Endpoint de busca correto e com desempenho comprovado.

## Fora do escopo
Recomendação ou ordenação por relevância, favoritos.

## Subtarefa 1: Busca (RF06, RN17)
**Regras**
- Só entram vagas `open` **e** com prazo não vencido (`application_deadline >= now()`), calculado na consulta.
- Filtros combináveis: `courseId`, `modalityId`, faixa de carga horária (`minHours`, `maxHours`), palavra-chave (`q`) em título e descrição.
- Ordenação padrão: publicação mais recente primeiro, com `id` para desempatar; **20 por página**, com total.
- Decidir a busca textual: `ILIKE` simples ou `tsvector` com configuração `portuguese` + `unaccent` (para "estagio" achar "estágio"). Sugestão: começar com `unaccent` + índice trigram e medir.
- Vaga de empresa **desativada** não aparece (RN33). Se a empresa for desativada, as vagas são encerradas na task 16, mas o filtro defensivo por `companies.active` fica na consulta.
- Mostrar quais instituições a vaga restringe; se for barato, marcar se o estudante é elegível (RN12). Opcional.

**Critérios de aceitação**
- Vaga encerrada, vaga com prazo vencido e vaga de empresa desativada não aparecem.
- Filtros combinados retornam a interseção; `minHours` maior que `maxHours`: 400.
- Busca por "estagio" encontra "Estágio".
- Página 2 não repete nem pula resultados.

## Subtarefa 2: Desempenho (RNF04)
**Entregas**
- Índices para os filtros e a ordenação (por exemplo `(status, application_deadline)`, `course_id`, `modality_id`, `published_at DESC`, trigram em título e descrição). Conferir com `EXPLAIN ANALYZE`.
- Script de carga que cria 10.000 vagas e mede 100 usuários simultâneos (k6 ou autocannon), com p95 registrado no README.

**Critérios de aceitação**
- p95 ≤ 3 s com 10.000 vagas e 100 simultâneos, em ambiente parecido com o de produção.

## Endpoints sugeridos
- `GET /api/v1/vacancies?courseId=&modalityId=&minHours=&maxHours=&q=&page=` (estudante)
- `GET /api/v1/vacancies/:id` (detalhe; definir se vaga encerrada ainda é visível a quem já se candidatou)

---

# TASK 13: Candidatura do estudante

## Contexto
O estudante se candidata, cancela e acompanha. É aqui que nascem `applications` e o histórico (RNF10), e que a máquina de estados de RN16 passa a existir no código.

## Objetivo
Candidatura com todas as regras de elegibilidade, histórico completo e cancelamento pelo estudante.

## Fora do escopo
Mudança de situação pelo responsável (task 14), e-mails e cancelamentos automáticos (task 15).

## Subtarefa 1: Modelo, máquina de estados e histórico
**Modelo de dados**
- `applications`: `id`, `student_id`, `vacancy_id`, `applied_at`, `status` (`under_review`, `interview`, `approved`, `rejected`, `cancelled`). Par `(student_id, vacancy_id)` **único**.
- `application_history`: `id`, `application_id`, `previous_status` (nulo na criação), `new_status`, `changed_by_type`, `changed_by_id` (nulo quando for o sistema), `changed_at`, `note` (opcional, visível ao estudante).

**P7 (decidir antes):** como representar o sistema em `alterado_por`. Sugestão: `changed_by_type` com `student | responsible | system` e `changed_by_id` nulo para `system`.

**Regras**
- **RN16:** única fonte das transições, em um módulo `ApplicationStateMachine` (reaproveitado nas tasks 14 e 15). Em análise → entrevista, rejeitada, cancelada. Entrevista → aprovada, rejeitada, cancelada. Aprovada, rejeitada e cancelada são finais.
- **RNF10:** toda mudança grava histórico na **mesma transação** da mudança.

## Subtarefa 2: Candidatar-se (RF07)
**Regras**
- **RN11 / RN28:** só até o instante exato do prazo, inclusive (`now <= deadline`), e com a vaga `open`.
- **RN07:** uma candidatura por estudante e vaga, **inclusive depois de cancelar**. Constraint no banco; a violação vira 409.
- **RN12:** exige **uma única matrícula ativa** em que o curso seja o curso alvo **e**, se a vaga restringir instituições, a instituição seja uma das permitidas. Curso de uma matrícula com instituição de outra não vale (PR27). Fazer em uma consulta `EXISTS` que combine as duas condições.
- Nasce "Em análise", com `applied_at` do servidor e histórico (nulo → em análise, autor estudante).
- Estudante desativado não chega aqui (sessão derrubada). Vaga de empresa desativada: recusar.
- Notificar o responsável (gancho, implementado na task 15).

**Critérios de aceitação**
- Sem matrícula ativa no curso: 403 ou 409 (definir) com mensagem específica. Matrícula trancada ou concluída não vale.
- Vaga restrita: matrícula ativa no curso certo mas em instituição não permitida: recusado; com a matrícula certa na instituição permitida: aceito.
- Candidatura no instante exato do prazo: aceita; 1 ms depois: recusada.
- Segunda candidatura à mesma vaga: 409, inclusive após cancelar. Duas requisições simultâneas: uma sucede.
- Vaga encerrada: recusada.

## Subtarefa 3: Cancelar e acompanhar (RF08, RF09)
**Funcionalidades**
- Cancelar só em "Em análise" ou "Entrevista"; aprovada, rejeitada e cancelada retornam 409. Só a própria candidatura (outra: 404).
- Listar as próprias candidaturas com situação atual e a observação do responsável (RF09), paginado.
- Estudante desativado: as candidaturas continuam existindo e visíveis ao responsável (RN34); nada é apagado.

**Critérios de aceitação**
- Cancelar gera histórico com autor estudante; depois de cancelar, nova candidatura à mesma vaga é recusada.
- O estudante vê a observação registrada pelo responsável, e não vê a de outro estudante.

## Endpoints sugeridos
- `POST /api/v1/vacancies/:id/applications`
- `GET /api/v1/students/me/applications`, `PATCH /api/v1/applications/:id/cancel`

## Entrega complementar
- `hasApplications` da task 11 passa a consultar `applications`.

---

# TASK 14: Candidaturas na visão do responsável

## Contexto
O responsável avalia os candidatos das vagas da própria empresa (RF16), respeitando o limite de aprovados (RN29).

## Objetivo
Listar candidatos e mudar a situação com observação, sem aprovar acima das posições e sem expor o CPF completo.

## Fora do escopo
E-mails (task 15). Cancelamento pelo responsável não existe: só o estudante cancela por iniciativa própria (RN16); o sistema cancela nos casos automáticos.

## Subtarefa 1: Lista de candidatos (RF16, RN13, RN32, RN34)
**Regras**
- Só vagas da própria empresa; vaga de outra empresa: 404 (RN13).
- Cada candidato: nome, e-mail, telefone quando informado, instituição, curso, semestre e **CPF mascarado** no formato `•••.123.456-••` (RN32). Reutilizar a função `maskCpf` criada na task 01 (sub 3); se ainda não existir, criá-la em `shared/` com teste.
- Instituição, curso e semestre vêm da matrícula. Decidir qual mostrar quando o estudante tem mais de uma ativa (sugestão: a que torna a candidatura elegível, a mesma da consulta do RN12).
- Candidaturas de estudante **desativado continuam visíveis** (RN34).
- Paginação e filtro por situação.

**Critérios de aceitação**
- A resposta nunca contém os 11 dígitos do CPF (teste procura o CPF completo no corpo).
- O responsável de outra empresa recebe 404; estudante recebe 403.

## Subtarefa 2: Atualizar situação (RF16, RN16, RN29)
**Regras**
- Transições do responsável: em análise → entrevista ou rejeitada; entrevista → aprovada ou rejeitada. Qualquer outra, incluindo cancelar: 409.
- Observação opcional (limite de tamanho), visível ao estudante, gravada no histórico (autor responsável).
- **RN29:** aprovados ≤ `positions`. A contagem e a aprovação rodam em **transação com `SELECT ... FOR UPDATE` na vaga**, para duas aprovações simultâneas não passarem do limite. Ao atingir o limite, novas aprovações são recusadas (409), e o encerramento da vaga continua manual.
- A vaga com prazo vencido continua avaliável (RN17); vaga encerrada não tem candidatura em andamento para mexer.
- Dispara o gancho de notificação ao estudante (task 15).

**Critérios de aceitação**
- Com `positions = 1`, duas aprovações simultâneas: exatamente uma sucede.
- Rejeitada → aprovada: 409. Cada mudança cria uma linha de histórico com autor, data e observação.

## Endpoints sugeridos
- `GET /api/v1/vacancies/:id/applications`
- `PATCH /api/v1/applications/:id/status` `{ status, note? }`

---

# TASK 15: Notificações por e-mail e cancelamentos automáticos

## Contexto
RF17 (prioridade Importante) existe principalmente porque os cancelamentos automáticos dependem do aviso. Os ganchos foram deixados nas tasks 08, 11, 13 e 14, e o envio vem da task 05.

## Objetivo
Cancelar candidaturas automaticamente nos três casos do SRS e avisar os envolvidos.

## Fora do escopo
Notificação in-app, SMS, preferências de notificação.

## Subtarefa 1: Cancelamento automático (RN16, RN33, RNF10)
**Entregas:** um `ApplicationAutoCanceller` que cancela as candidaturas **em andamento** (em análise ou entrevista), com histórico de autor `system`, e devolve a lista de estudantes afetados. Acionado por:
- encerramento da vaga (gancho da task 11);
- matrícula do estudante no **curso alvo** que deixou de estar Ativa (gancho da task 08; só as candidaturas a vagas daquele curso e, se houver restrição, daquela instituição);
- desativação da empresa (task 16), com aviso de que foi por razões da empresa.

**Regras**
- O cancelamento e o histórico são **uma transação**; o envio de e-mail acontece **depois do commit**.
- Aprovadas e rejeitadas não são tocadas.
- Idempotente: acionar duas vezes não gera histórico duplicado.

**Critérios de aceitação**
- Encerrar vaga com 3 candidaturas (2 em andamento, 1 rejeitada): 2 viram canceladas com autor `system`, a rejeitada permanece.
- Trancar a única matrícula ativa do curso alvo cancela as candidaturas em andamento a vagas desse curso, e não as de outros cursos.

## Subtarefa 2: E-mails (RF17)
**Entregas e regras**
- E-mail ao estudante a cada mudança de situação, inclusive nos cancelamentos automáticos, indicando o motivo (vaga encerrada, matrícula, razões da empresa) e a observação do responsável, quando houver.
- E-mail ao responsável quando recebe uma nova candidatura.
- Em lote grande (vaga com muitas candidaturas), enviar sem bloquear a requisição.
- Falha de envio não desfaz a mudança de situação. Decidir entre log simples e tabela de saída (`email_outbox`) com nova tentativa; sugestão: começar com log e registrar a decisão.
- Aviso aos candidatos na extensão de prazo da vaga (P3, task 11).

**Critérios de aceitação**
- Cada mudança de situação gera exatamente um e-mail ao estudante (teste com o fake da task 05).
- Falha simulada no SMTP não faz a requisição falhar.

---

# TASK 16: Administração, fase 2: responsáveis e empresas

## Contexto
A task 01 deixou de fora a gestão de responsáveis e empresas (RF20, RN33), que dependem dos módulos de empresa, vaga e candidatura. O desenho da fase 1 já previu o ponto de extensão.

## Objetivo
O admin lista, desativa e reativa responsáveis e empresas, com todos os efeitos de RN33.

## Fora do escopo
Validação cadastral de empresas, denúncia e moderação (adiados, 9.4).

## Subtarefa 1: Responsáveis (RF20, RN14, RN21, PR25)
**Regras**
- Listar e buscar responsáveis (nome, e-mail, empresa, situação), paginado.
- Desativar encerra as sessões (`revokeAllSessions(RESPONSIBLE, id)`). Reativar: o admin é o único que reativa.
- **RN14:** o admin **não** desativa o último responsável ativo de uma empresa ativa; para isso, desativa a empresa. Mesma transação com lock da task 10.
- Idempotência de desativar já inativo e reativar já ativo: seguir o que a task 01 (sub 3) decidiu, para os três perfis ficarem iguais.

## Subtarefa 2: Empresas (RF20, RN33)
**Regras**
- Listar e buscar empresas (nome fantasia, CNPJ, situação), paginado. CNPJ pode aparecer completo (a máscara de RN32 é só do CPF).
- **Desativar empresa**, numa transação: marca `active = false`; **encerra as vagas abertas** (definitivo, como RN17); cancela as candidaturas em andamento pelo `ApplicationAutoCanceller` com o aviso "razões da empresa"; encerra as sessões de **todos** os responsáveis (RN21).
- As vagas somem da busca (a task 12 já filtra por `companies.active`).
- **Reativar empresa:** devolve o login dos responsáveis. As vagas **não reabrem**; a empresa publica novas (RN33, PR9). Não há como "provar regularidade" no sistema: é decisão do admin; avaliar um campo de motivo opcional.
- Reativar empresa já ativa e desativar empresa já inativa: mesma regra de idempotência.

**Critérios de aceitação**
- Desativar empresa com 2 vagas abertas e 5 candidaturas em andamento: vagas `closed`, candidaturas `cancelled` com autor `system`, e-mails enviados, responsáveis sem acesso na requisição seguinte.
- Reativar: responsáveis entram de novo; as vagas continuam encerradas.
- Desativar o último responsável ativo de empresa ativa: 409.

## Endpoints sugeridos
- `GET /api/v1/admin/responsibles`, `PATCH /api/v1/admin/responsibles/:id/deactivate|reactivate`
- `GET /api/v1/admin/companies`, `PATCH /api/v1/admin/companies/:id/deactivate|reactivate`

## Ordem sugerida
A subtarefa 1 pode sair logo após a task 10. A subtarefa 2 só depois das tasks 11 e 15.

---

# TASK 17: Exclusão de conta e LGPD

> **Bloqueada.** Depende das decisões P4 e P6. Esta task descreve as opções para a decisão, não um desenho final.

## Contexto
RF10 e RNF03: o estudante pode pedir a exclusão dos dados pessoais, atendida em até 15 dias. O SRS não define quem executa nem o que acontece com candidaturas e histórico, e a anonimização conflita com RN07 (não candidatar de novo) e RNF10 (auditoria).

## Decisões necessárias antes de começar
1. **Quem executa:** automático ao pedir, ou o admin em até 15 dias.
2. **O que acontece com os dados:** exclusão física, ou anonimização (nome, e-mail, CPF, telefones, perfil profissional) mantendo `students.id`, candidaturas e histórico.
3. **E-mail e CPF anonimizados voltam a ficar livres?** Hoje RN06 diz que a desativação não os libera.
4. **P6:** encarregado de dados, base legal por tratamento e canal do titular; conferir as regras da ANPD para agentes de pequeno porte. Há ressalva jurídica no SRS.

**Sugestão para discussão:** anonimizar em vez de apagar, mantendo o `id` do estudante, as candidaturas e o histórico. Isso preserva RN07 e RNF10, porque a regra de uma candidatura por vaga é por `student_id` e não por CPF. Fluxo em duas etapas: o estudante registra o pedido e o admin executa dentro do prazo de 15 dias.

## Entregas após a decisão
- Tabela `deletion_requests` (`id`, `student_id`, `requested_at`, `due_at` = pedido + 15 dias, `status`, `executed_by`, `executed_at`).
- `POST /students/me/deletion-request` e tela do admin para listar pedidos pendentes, com destaque para os perto do prazo.
- Execução em transação: anonimiza, encerra sessões, cancela candidaturas em andamento (autor `system`, com e-mail se ainda houver endereço), registra a execução.
- Registro de quem executou e quando (conversa com a auditoria ampliada, adiada em 9.4).

**Critérios de aceitação (a refinar após a decisão)**
- Depois da execução, nenhuma consulta devolve dados pessoais do estudante; candidaturas e histórico seguem coerentes para o responsável.
- O pedido fora do prazo de 15 dias aparece como atrasado para o admin.

---

# TASK 18: Documentação e entrega

## Contexto
Itens transversais que fecham o back-end para o front e para a publicação.

## Objetivo
API documentada, ambiente reproduzível e requisitos não funcionais verificados.

## Subtarefas
**Documentação**
- Swagger com **todas** as rotas, incluindo erros por status, esquema de autenticação (Bearer) e exemplos. Conferir que nenhuma rota ficou de fora (um teste que compara as rotas do Express com o Swagger evita esquecimento).
- README: pré-requisitos, `.env.example`, migrations, script do primeiro admin, scripts de teste e de carga, papéis e matriz de permissões (Anexo A), riscos documentados (P2 e P5).

**Operação**
- `GET /health` (aplicação e banco).
- CORS por variável de ambiente (hoje só `http://localhost:5173` fixo no código).
- Sentry: `config.sentryDsn` existe, mas não aparece inicialização nos arquivos enviados; conferir e ligar ou remover.
- **RNF02:** TLS 1.2 ou superior é do proxy ou da plataforma; registrar no README quem termina o TLS e confirmar que o Cloud Run ou o balanceador aplica.
- **RNF07:** definir como medir 99% de disponibilidade mensal (monitor externo no `/health`).

**Segurança e qualidade**
- Revisão da matriz do Anexo A rota por rota: um teste percorre todas as rotas protegidas com token de cada perfil e confere 401 e 403.
- Varredura de dependências (`npm audit` na CI).
- Limite geral de requisições por origem (além do de login).

**Critérios de aceitação**
- Uma pessoa nova sobe o projeto só com o README.
- O teste de matriz de permissões passa para todas as rotas.
- Swagger lista 100% das rotas registradas.

---

## Fora do escopo do projeto (SRS 9.4, adiados)
2FA do administrador, tempos de sessão por perfil, confirmação de e-mail no cadastro, versionamento do aceite de termos, carta de apresentação do candidato, validação cadastral de empresas, controle pós-aprovação, denúncia e moderação, auditoria ampliada e retenção de logs, expansão para outras cidades, rejeição de senhas comuns, cursos oferecidos por instituição, consentimento do responsável legal para menores de 18 anos.
