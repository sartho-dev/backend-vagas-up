# Documento de Requisitos de Software (SRS)

**Sistema:** EstagiaAqui — plataforma de vagas de emprego e estágio
**Versão:** 4.9 — 14/10/2026

> Conversão fiel de `EstagiaAqui_Requisitos_v4_9.docx.pdf` para markdown. O conteúdo é o mesmo; só a formatação mudou (tabelas, listas e títulos). A ordem dos requisitos é a do documento original, inclusive onde os IDs não estão em sequência.

**Convenção:** tudo o que não está marcado é decisão. `[Em aberto Pn]` aponta pendência da seção 9.2. A v4.0 reescreve o documento: o produto deixou de ser "estágio para universitários" e passou a ser "vagas para todos os níveis de escolaridade". As decisões da v3 que continuam valendo foram mantidas; as que não cabem mais foram removidas ou adiadas (seção 9.3).

---

## 1. Introdução

### 1.1 Objetivo

Especificar funcionalidades, regras de negócio, restrições e modelo de dados do sistema, servindo de guia único para desenvolvimento e validação.

### 1.2 Escopo

Plataforma web onde anunciantes (empresas com CNPJ ou pessoas físicas com CPF) publicam vagas de emprego e de estágio, e candidatos de qualquer escolaridade (ensino médio, superior em andamento, superior completo etc.) as encontram e se candidatam. Candidatos podem, se quiserem, deixar o perfil visível no banco de talentos, onde anunciantes verificados os encontram e entram em contato. Administradores verificam anunciantes, tratam denúncias e mantêm o cadastro de cursos.

O atendimento inicial é Campo Grande (MS); o campo cidade já existe para expansão. Não há pagamento processado dentro do site: o anunciante paga por PIX fora dele e o administrador confirma (seção 2.4). É um web app responsivo, sem aplicativo nativo. A estratégia é incremental: lançar simples, ganhar usuários e evoluir com o uso.

### 1.3 Definições

- **Candidato:** pessoa que procura vaga. Substitui o "estudante" da v3.
- **Anunciante:** quem publica vagas. Pode ser PJ (CNPJ) ou PF (CPF). Não faz login; quem faz login são seus responsáveis.
- **Responsável:** pessoa que entra no site em nome de um anunciante: publica e paga vagas, avalia candidatos e busca no banco de talentos. Um anunciante pode ter vários responsáveis (ex.: dono e RH). Não tem relação com patrocínio.
- **Administrador:** usuário interno que verifica anunciantes, trata denúncias e mantém cursos e contas.
- **Verificado:** selo dado pelo administrador a um anunciante cuja existência foi confirmada (seção RN-V).
- **Banco de talentos:** lista de candidatos que optaram por ficar visíveis a anunciantes verificados.
- **Hash:** transformação de mão única (não é criptografia: não dá para reverter). Usada para senhas e tokens.

---

## 2. Descrição Geral

### 2.1 Perfis

| Perfil | O que faz |
|---|---|
| Visitante (sem login) | Vê e busca vagas, vê página do anunciante, cadastra-se. |
| Candidato | Mantém perfil e formações, candidata-se, acompanha candidaturas, decide se aparece no banco de talentos, denuncia vagas. |
| Responsável | Mantém dados do anunciante, convida outros responsáveis, publica e gerencia vagas, avalia candidaturas, busca no banco de talentos (só se verificado). |
| Administrador | Verifica anunciantes, trata denúncias, desativa/reativa contas, mantém cursos e outros administradores. |

A matriz completa está no [Anexo A](#anexo-a--matriz-de-permissões).

### 2.2 Princípio de intermediação

O site só põe as partes em contato. Não guarda nenhum documento (RG, carteira de trabalho, comprovantes, currículo em arquivo) e não participa da contratação. A verificação de anunciantes pelo administrador é feita olhando, não arquivando (RN-V3). Cada parte é responsável por conferir a outra antes de fechar qualquer acordo, e o site orienta como fazer isso (RF36).

### 2.3 Arquitetura e restrições técnicas

- Front-end estático hospedado em serviço gratuito (domínio gratuito ou subdomínio); API REST em uma VPS; banco PostgreSQL na mesma VPS.
- A API tem HTTPS próprio (Let's Encrypt). Front e API se comunicam só por HTTPS; o CORS da API aceita apenas o domínio do front.
- Backup diário automático do banco, guardado fora da VPS.
- Envio de e-mail por serviço externo (recuperação de senha, convites, notificações).
- Fuso America/Campo_Grande (UTC−4) na exibição; datas armazenadas em UTC.
- Todas as chaves primárias são UUID.

### 2.4 Modelo de receita

- Pagamento por vaga, não assinatura: o anunciante paga uma vez por vaga publicada. Assinatura não funciona para vagas, porque a empresa contrata e cancela.
- A primeira vaga de cada anunciante é gratuita, para atrair empresas no início.
- O pagamento é feito por PIX fora do site; o administrador confirma no painel e a vaga é publicada (RN-P).
- Candidatos nunca pagam nada.
- Receita complementar: anúncios de dois tipos — (a) **patrocinadores diretos**: empresas locais que pagam um valor fixo por mês para aparecer num espaço marcado como "Patrocinado", cadastrados pelo administrador (RF38); (b) **rede de anúncios do Google (AdSense)**, que paga por visualização e clique. Nunca dentro da página de uma vaga nem no fluxo de candidatura; AdSense só com anúncios não personalizados até haver banner de consentimento de cookies.
- Estratégia de anúncios (decidida): começar só com patrocinadores diretos, porque com pouco tráfego o AdSense rende centavos por dia, enquanto um patrocinador local paga valor fixo (referência inicial: R$ 50 a R$ 200 por mês por espaço). Público-alvo dos patrocinadores: escolas de idiomas, cursinhos, cursos técnicos, faculdades particulares, escolas de informática, gráficas e fotógrafos de foto para currículo. O AdSense entra depois, quando o tráfego crescer, e exige domínio próprio, política de privacidade e páginas de contato e "sobre".
- Patrocínio exige contrato simples (período, posição, valor) e nota fiscal (P8). O patrocinador não pode anunciar vagas pelo espaço de patrocínio: vaga se publica pelo fluxo normal e pago.
- Avisos aos administradores: por e-mail e no painel do administrador.

### 2.5 Divulgação: Instagram como vitrine

O Instagram (e, se quiserem, os Status/Canal do WhatsApp) é a vitrine e o site é o destino. O site não concorre com os perfis de vagas da cidade: usa o alcance deles e oferece o que eles não têm (candidatura organizada, filtros, histórico, verificação, segurança).

- **Fluxo:** o post mostra a vaga resumida ("Vendedor(a) — Centro — Emprego — R$ 1.800") e o link leva para a página da vaga no site, onde estão os detalhes e o botão de candidatura. Nada de candidatura pelo Direct.
- **Conteúdo além de vagas:** dicas da Central de Segurança, números do mural ("312 pessoas de Administração já estão no EstagiaAqui"), selo "Verificado" das empresas. Isso reforça a confiança que diferencia o site.
- Link na bio aponta para a busca de vagas; cada post de vaga usa o link direto da vaga.
- Só vagas publicadas no site vão para o Instagram, com as mesmas regras de verificação e o mesmo aviso de anunciante não verificado. Vagas de terceiros só com autorização da empresa.
- A publicação no Instagram é manual na v1 (feita pela equipe com ajuda da RF42). Postagem automática pela API do Instagram fica para depois.

---

## 3. Requisitos Funcionais

Prioridade: **E** = Essencial (v1 não sai sem), **I** = Importante (v1 se der), **D** = Desejável (depois).

### Acesso

| ID | Requisito | Pri. |
|---|---|---|
| RF01 | Entrar com e-mail e senha, sair, recuperar senha por link no e-mail (regras em RN-A). | E |
| RF02 | Cada perfil acessa apenas o que o Anexo A permite. | E |
| RF03 | Qualquer usuário edita o próprio nome, telefone e senha. Trocar e-mail exige confirmação por link no novo endereço. | I |

### Candidato

| ID | Requisito | Pri. |
|---|---|---|
| RF10 | Cadastro de candidato: nome, e-mail, senha, CPF, data de nascimento, cidade, escolaridade atual e telefone (opcional), com a marcação "este número tem WhatsApp". Exige aceite dos termos e da política de privacidade. | E |
| RF11 | Formações: o candidato registra zero ou mais formações (nível, curso, instituição, situação, início e fim). Ex.: "Superior — Administração — UFMS — em andamento". | E |
| RF12 | Perfil profissional opcional: resumo, foto e link de currículo/portfólio (RN-C10). A tela orienta a usar foto real e não gerada por IA. | I |
| RF13 | Visibilidade do perfil, escolhida pelo candidato e alterável a qualquer momento (RN-C9): Oculto (padrão), Só anunciantes verificados ou Público. | E |
| RF19 | Mural de candidatos (também sem login): lista os perfis Públicos em cartões resumidos (primeiro nome + inicial do sobrenome, foto se houver, escolaridade, formação principal, cidade) e mostra, para cada curso, um ícone ilustrativo do curso com o total de candidatos cadastrados (ex.: ícone de Administração + "312 pessoas"), contando também os ocultos, só como número. Os cartões carregam com esqueleto cinza enquanto as fotos chegam. | I |
| RF14 | Busca de vagas (também sem login): só vagas abertas e dentro do prazo, filtráveis por tipo, modalidade, cidade, escolaridade mínima, curso e palavra-chave; mais recentes primeiro, 20 por página. | E |
| RF15 | Candidatar-se a uma vaga, se atender aos requisitos da RN-C. | E |
| RF16 | Cancelar a própria candidatura enquanto não for final. | I |
| RF17 | Acompanhar candidaturas, ver a situação e a observação do anunciante. | E |
| RF18 | Excluir a própria conta (LGPD), confirmando com a senha (RN-L). | I |

### Anunciante

| ID | Requisito | Pri. |
|---|---|---|
| RF20 | Cadastro de anunciante + primeiro responsável. PJ: CNPJ, nome fantasia, razão social, e-mail e telefone de contato, site (opcional). PF: CPF, nome de exibição, e-mail e telefone de contato. Documento validado pelos dígitos. Nasce com verificação "pendente". | E |
| RF21 | Solicitar verificação: o responsável envia os dados que o administrador usará para confirmar a existência (RN-V). | E |
| RF22 | Convidar outros responsáveis por e-mail (link vale 72 h; convidado define a senha). | I |
| RF23 | Editar dados do anunciante, exceto tipo e documento. Alterar nome/razão social de um anunciante verificado o volta para "pendente". | I |
| RF24 | Publicar vaga: tipo (estágio, emprego ou jovem aprendiz), título, descrição, modalidade, cidade, carga horária semanal, escolaridade mínima, prazo (data e hora), número de posições (padrão 1), "exige 18 anos ou mais" (só quando a lei exigir, RN-VG9). Opcionais: curso desejado, requisitos, benefícios, remuneração, horário. | E |
| RF25 | Encerrar a vaga (obrigatório ao escolher o candidato) ou excluir vaga sem candidaturas. A vaga publicada não é editada (RN-P5). | E |
| RF28 | Pagar vaga: ao enviar uma vaga paga, o sistema mostra o valor, a chave PIX e um código de referência da vaga; a vaga fica "aguardando pagamento" até o administrador confirmar. | E |
| RF29 | Revisão antes de publicar: tela mostra a vaga exatamente como os candidatos a verão, com o aviso de validade de 60 dias e de que ela não poderá ser editada; o anunciante confirma duas vezes ("Revisei os dados" e "Publicar"). | E |
| RF26 | Ver candidatos de suas vagas e mudar a situação, com observação opcional visível ao candidato. | E |
| RF27 | Banco de talentos (só anunciante verificado): filtrar candidatos com visibilidade Só verificados ou Público por escolaridade, curso, cidade e palavra-chave; ver perfil; enviar mensagem de interesse, que gera notificação e e-mail ao candidato. | I |

### Administração e comuns

| ID | Requisito | Pri. |
|---|---|---|
| RF37 | Fila de pagamentos: listar vagas aguardando pagamento, conferir o PIX pelo código de referência e confirmar (publica a vaga) ou recusar (com motivo). Ver pagamentos por período. | E |
| RF39 | Tabela de preços: o administrador edita o valor de cada tipo de vaga (estágio, emprego, jovem aprendiz); o sistema registra quem alterou e quando. | E |
| RF38 | Patrocinadores: a negociação é feita fora do site (WhatsApp ou e-mail, com contrato e nota fiscal). Fechado o acordo, o administrador cadastra no painel o patrocinador, a imagem, o link, a posição e o período; o anúncio aparece só no período e sempre com o rótulo "Patrocinado". | I |
| RF40 | Página pública "Anuncie aqui": explica os espaços de patrocínio e traz o contato do administrador. Não há envio de imagem nem pagamento pelo site. | D |
| RF42 | Compartilhamento: cada vaga tem endereço próprio e legível (ex.: `estagiaaqui.com.br/vagas/vendedor-centro-a1b2`) e, ao ser compartilhada (Instagram, WhatsApp), mostra cartão com título, tipo, cidade e selo de verificação (metatags Open Graph). Botão "Compartilhar vaga" na página. No painel do administrador, botão que gera a arte da vaga em formato de post/story (1080×1080 e 1080×1920) para publicar no Instagram. | I |
| RF43 | Origem de acesso: links divulgados levam um marcador de origem (ex.: `?origem=instagram`) e o sistema conta visitas e candidaturas por origem, sem identificar pessoas, para saber quanto o Instagram traz. | D |
| RF41 | Comunidade de anunciantes: o painel do responsável de anunciante verificado mostra um convite opcional para a comunidade de anunciantes no WhatsApp (link configurado pelo administrador), canal para sugestões e contato direto com a equipe. | D |
| RF30 | Fila de verificação: listar anunciantes pendentes, ver dados, marcar como verificado ou recusado (com motivo). | E |
| RF31 | Denúncias: qualquer usuário logado denuncia uma vaga (motivo + texto). O administrador vê a fila e julga procedente (vaga encerrada, anunciante pode ser desativado) ou improcedente (vaga volta). | E |
| RF32 | Desativar e reativar contas de candidatos, responsáveis e anunciantes. | E |
| RF33 | Cadastrar cursos (nome único); curso sem uso pode ser excluído. | E |
| RF34 | Cadastrar e desativar outros administradores. O primeiro é criado por script. Nunca desativar a si mesmo nem o último ativo. | E |
| RF36 | Central de Segurança: página pública (sem login) com dicas para candidatos e para anunciantes: como reconhecer golpes, nunca pagar taxa, como verificar a outra parte com segurança, cuidado com links e arquivos, o que o site guarda e o que não guarda, e como denunciar. Link fixo no rodapé, no cadastro e na tela de cada vaga. | I |
| RF35 | Notificações no site (sino) e por e-mail: mudança de candidatura, nova candidatura, contato de anunciante, resultado de verificação e de denúncia. | I |

---

## 4. Requisitos Não Funcionais

| ID | Requisito |
|---|---|
| RNF01 | Senhas guardadas só como hash bcrypt (custo ≥ 12) ou Argon2id. Tokens de sessão e de links guardados só como hash SHA-256. |
| RNF02 | Toda comunicação em HTTPS. |
| RNF03 | LGPD: consentimento no cadastro, exibir só o necessário (CPF nunca aparece para anunciantes), atender pedido de exclusão (P3). |
| RNF04 | Busca de vagas e mural respondem em até 2 s nas condições normais de uso da v1: paginação de 20 itens, índices nos campos filtrados, fotos redimensionadas para miniatura no envio e carregadas sob demanda (lazy loading) com esqueleto cinza. |
| RNF05 | Interface responsiva de 360 px a 1920 px e com contraste e navegação por teclado adequados (WCAG AA como meta). |
| RNF06 | Integridade: todas as FKs com restrição no banco; registros com vínculos são desativados, não apagados. |
| RNF07 | Toda mudança de situação de candidatura e toda decisão do administrador (verificação, denúncia, desativação) fica registrada com autor e data. |

---

## 5. Regras de Negócio

### RN-A — Autenticação e sessão

- **RN-A1** Login com e-mail e senha. Mensagem única para qualquer falha: "E-mail ou senha inválidos".
- **RN-A2** Após o login, a API devolve um token de sessão aleatório; o navegador o envia em cada requisição (cabeçalho `Authorization: Bearer`). O banco guarda apenas o hash desse token, nunca o token em si. Não se usa JWT. (Ver nota abaixo.)
- **RN-A3** A sessão expira após 30 min sem uso ou 8 h desde o login. Sair, trocar a senha, recuperar a senha ou ter a conta desativada encerra as sessões da conta.
- **RN-A4** 5 falhas seguidas no mesmo e-mail bloqueiam o login por 15 min. Login bem-sucedido zera o contador.
- **RN-A5** Senha de 10 a 64 caracteres, sem exigência de tipos.
- **RN-A6** Recuperação de senha: resposta sempre igual exista ou não o e-mail; link vale 30 min e um uso; novo pedido invalida o anterior.
- **RN-A7** O e-mail é único entre todos os usuários (garantido pelo banco, pois há uma só tabela de usuários).

**Por que não JWT:** o JWT guarda os dados do usuário dentro do próprio token, assinados; o servidor confia nele sem consultar o banco até ele expirar. Isso ajuda quando há muitos servidores, mas impede encerrar uma sessão na hora (sair, trocar senha, desativar conta) sem montar uma lista de bloqueio no banco, que é justamente o que o token opaco já faz. Com uma VPS e um banco, o token opaco é mais simples e mais seguro.

**Nota sobre "não precisa de token, só hash":** hash e token não são alternativas, eles trabalham juntos. O hash protege o que fica guardado (senha e token). O token é o que o navegador mostra a cada requisição para provar que já fez login; sem ele, o usuário teria de mandar a senha em toda requisição, o que é pior. O que a equipe decidiu, na prática, é: sem JWT, token opaco, banco guarda só o hash — exatamente esta regra. Entendimento confirmado pela equipe em 10/10/2026.

### RN-V — Verificação de anunciantes e combate a fraudes

- **RN-V1** Todo anunciante nasce pendente. Situações: pendente → verificado ou recusado. Recusado pode pedir nova verificação.
- **RN-V2** Para verificar PJ, o administrador confere o CNPJ na consulta pública (situação ativa, razão social igual) **e** confirma o vínculo do responsável com a empresa por pelo menos um: e-mail no domínio da empresa, ou ligação para o telefone público da empresa.
- **RN-V3** Para verificar PF: (a) e-mail e telefone confirmados por código; (b) chamada de vídeo curta do administrador, em que a pessoa mostra o documento com foto e o nome e CPF batem com o cadastro; (c) prova da atividade quando houver (registro profissional como CRO, CRM ou OAB, perfil público do negócio ou endereço comercial). **Nenhuma imagem de documento é guardada:** o sistema registra só quem verificou, quando e o método.
- **RN-V3a** Anunciante PF tem no máximo 3 vagas abertas ao mesmo tempo, mesmo verificado e pagando.
- **RN-V4** Anunciante não verificado só publica a vaga gratuita (RN-P2), que exibe o aviso "Anunciante não verificado".
- **RN-V5** Anunciante verificado exibe o selo "Verificado" na página e em todas as vagas. Só ele acessa o banco de talentos.
- **RN-V6** Toda página de vaga mostra: "Nenhuma vaga legítima cobra taxa, curso ou material. Se pedirem dinheiro, denuncie." Pedir dinheiro ao candidato é motivo de desativação.
- **RN-V7** Uma vaga com 3 denúncias de usuários diferentes passa a suspensa (some da busca) até o administrador julgar. Cada usuário denuncia uma vaga uma única vez.
- **RN-V8** Denúncia procedente encerra a vaga; o administrador decide se também desativa o anunciante.

### RN-C — Candidatos e candidaturas

- **RN-C1** Idade mínima de 14 anos no cadastro (idade mínima legal do jovem aprendiz). *[Em aberto P4: conferir com orientação jurídica.]*
- **RN-C2** Escolaridade atual (lista fixa): fundamental incompleto, fundamental completo, médio em andamento, médio completo, técnico em andamento, técnico completo, superior em andamento, superior completo, pós-graduação.
- **RN-C3** Para se candidatar, a escolaridade do candidato deve ser igual ou superior à escolaridade mínima da vaga.
- **RN-C4** Vaga de estágio exige que o candidato tenha ao menos uma formação em andamento (estágio exige vínculo de ensino — Lei 11.788/2008). Se a vaga indicar curso, a formação em andamento deve ser nesse curso.
- **RN-C5** Um candidato se candidata uma única vez a cada vaga, mesmo após cancelar.
- **RN-C6** Situações: Em análise → Entrevista → Aprovada; Em análise ou Entrevista → Rejeitada ou Cancelada. Aprovada, Rejeitada e Cancelada são finais. Só o candidato cancela; o anunciante faz as demais; o sistema cancela automaticamente quando a vaga é encerrada ou o anunciante desativado.
- **RN-C7** Aprovadas não podem passar do número de posições da vaga.
- **RN-C8** O anunciante vê do candidato: nome, e-mail, telefone, cidade, escolaridade, formações e perfil profissional. Nunca o CPF nem a data de nascimento completa.
- **RN-C9** Visibilidade: **Oculto** — só os anunciantes das vagas a que o candidato se candidatou veem o perfil; **Só verificados** — aparece também no banco de talentos; **Público** — aparece ainda no mural com dados resumidos (RF19). E-mail, telefone e link de currículo nunca aparecem no mural, só para anunciantes verificados ou para os anunciantes das vagas a que se candidatou. A mudança vale na hora. Menores de 18 não podem escolher Público.
- **RN-C11** Telefone do candidato: segue a mesma regra de visibilidade do e-mail (RN-C9) e nunca aparece no mural. Se marcado como WhatsApp, o anunciante vê um botão "Chamar no WhatsApp" (link `wa.me`, sem integração paga). O cadastro avisa que qualquer pessoa que veja o número pode chamá-lo no WhatsApp, e o candidato pode deixar o telefone em branco e ser contatado só por e-mail.
- **RN-C10** Link de currículo ou portfólio: só https e só de domínios permitidos (Google Drive, OneDrive, Dropbox, LinkedIn, GitHub, Canva); visível só a anunciantes, nunca no mural; ao clicar, aviso "você está saindo do site". O candidato é avisado ao cadastrar o link (deve apontar só para o próprio currículo, com acesso de leitura) e o anunciante é avisado ao abrir (não baixar executáveis, desconfiar de pedidos de login). O sistema não armazena arquivos de currículo.

### RN-VG — Vagas

- **RN-VG1** Situações: Rascunho, Aguardando pagamento, Aberta, Suspensa (por denúncia), Encerrada (final, não reabre).
- **RN-VG2** A vaga é encerrada automaticamente 60 dias após a publicação (tarefa diária no servidor) ou antes, pelo anunciante. Quando o anunciante escolhe o candidato, ele deve encerrar a vaga; as candidaturas ainda em andamento passam a Cancelada e os candidatos são avisados. O anunciante recebe aviso 7 dias e 1 dia antes do encerramento automático, para concluir o processo seletivo.
- **RN-VG3** O prazo de candidatura é opcional; se informado, não pode ser anterior à publicação nem passar dos 60 dias de validade. Para continuar contratando depois do encerramento, publica-se uma nova vaga (novo pagamento).
- **RN-VG4** Estágio: carga horária máxima de 30 h semanais (Lei 11.788/2008, art. 10). Emprego: máximo 44 h (CLT). Jovem aprendiz: máximo 6 h diárias (CLT, art. 432).
- **RN-VG9** A vaga não define faixa de idade: anúncio com limite de idade é prática discriminatória (Lei 9.029/1995). A idade entra só por regra legal: jovem aprendiz aceita candidatos de 14 a 24 anos (CLT, art. 428), e a vaga pode marcar "exige 18 anos ou mais" quando a lei proíbe menores (trabalho noturno, perigoso ou insalubre). Vagas de emprego e estágio sem essa marca aceitam a partir de 16 anos; menores de 16 só se candidatam a jovem aprendiz.
- **RN-VG5** Vaga publicada não é editada (RN-P5). Antes da publicação (rascunho ou aguardando pagamento), tudo é editável.
- **RN-VG6** Vaga sem candidaturas pode ser excluída; com candidaturas, só encerrada.
- **RN-VG7** Anunciante desativado: vagas abertas são encerradas e candidaturas em andamento canceladas, com aviso aos candidatos.
- **RN-VG8** O anunciante sempre tem ao menos um responsável ativo; para tirar o último, desativa-se o anunciante.

### RN-P — Pagamento de vagas

- **RN-P1** Cada anunciante tem uma vaga gratuita (a primeira). As demais exigem pagamento único por vaga. O preço é definido por tipo de vaga e o administrador pode alterá-lo a qualquer momento (RF39). Preços iniciais: estágio R$ 20 e emprego R$ 35; jovem aprendiz a definir (P7).
- **RN-P2** Só anunciante verificado publica vaga paga. O não verificado fica na vaga gratuita, com o aviso de RN-V4. Assim ninguém paga e depois é recusado.
- **RN-P3** Vaga paga começa em "Aguardando pagamento" e só vai para "Aberta" quando o administrador confirma o PIX. O código de referência da vaga deve constar na descrição do PIX.
- **RN-P4** Validade: cada vaga dura 60 dias a partir da publicação e então é encerrada (RN-VG2). Não há renovação. O aviso de validade aparece na tela de revisão e na de pagamento.
- **RN-P5** A vaga não pode ser editada depois de publicada: os dados são conferidos na revisão com dupla confirmação (RF29). Isso evita informação falsa ou alterada depois que os candidatos se inscreveram e impede reaproveitar uma vaga paga para outro cargo. Erro encontrado depois: encerrar e publicar outra. O número de posições pode ser maior que 1 na mesma vaga.
- **RN-P6** Reembolso: só se o administrador recusar a vaga antes de publicá-la. Vaga encerrada por denúncia procedente não é reembolsada. *[Em aberto P8: conferir direito de arrependimento do Código de Defesa do Consumidor.]*
- **RN-P8** Mudança de preço vale só para vagas enviadas para pagamento depois da mudança. A vaga guarda o valor do momento em que foi enviada, e é esse valor que aparece no PIX e no PAGAMENTO.
- **RN-P7** O sistema não guarda comprovante: registra valor, data, código de referência e o administrador que confirmou.

### RN-L — Exclusão de conta (LGPD)

- **RN-L1** O usuário exclui a conta pela própria tela, confirmando com a senha. O efeito é imediato, sem fila do administrador.
- **RN-L2** Na exclusão, o sistema anonimiza em vez de apagar a linha: o nome vira "Usuário removido" e o e-mail um valor aleatório; CPF, telefone, data de nascimento, foto, resumo, link e formações são apagados; sessões e tokens são apagados; `ativo = falso`.
- **RN-L3** Candidaturas em andamento são canceladas; as já finalizadas permanecem anonimizadas no histórico do anunciante. Contatos, notificações e denúncias do usuário ficam sem identificação.
- **RN-L4** Anunciante PF que exclui a conta: vagas abertas encerradas e dados pessoais anonimizados. Anunciante PJ: só os dados do responsável são anonimizados.
- **RN-L5** Cópias de backup expiram em até 30 dias; a política de privacidade informa esse prazo.
- **RN-L6** Como o CPF é apagado, a pessoa pode criar uma conta nova depois com o mesmo CPF.

---

## 6. Modelo de Dados

17 tabelas (a v3 tinha 18). Principais mudanças: uma única tabela `USUARIO` para todos os perfis (resolve o e-mail único e as FKs de sessão e token, que no DER antigo ficavam "sem FK"); telefone vira coluna; modalidade, escolaridade e situações viram enum; saem `CONTROLE_TENTATIVAS_LOGIN` (vira duas colunas), `VAGA_INSTITUICAO` e as três tabelas de telefone; entram `ANUNCIANTE` (PJ/PF), `FORMACAO`, `DENUNCIA`, `NOTIFICACAO` e `CONTATO`.

| Tabela | Campos |
|---|---|
| USUARIO | `id` PK, `email` UK, `senha_hash`, `nome`, `telefone?`, `perfil` (candidato \| responsavel \| admin), `anunciante_id` FK? (só responsável), `ativo`, `falhas_login`, `bloqueado_ate?`, `criado_em` |
| CANDIDATO | `usuario_id` PK/FK, `cpf` UK, `data_nasc`, `cidade`, `telefone_whatsapp` (bool), `escolaridade` (enum), `resumo?`, `foto_url?`, `link_curriculo?`, `visibilidade` (oculto \| verificados \| publico), `aceite_termos_em`; `cpf` e `data_nasc` anuláveis por causa da anonimização (RN-L2) |
| FORMACAO | `id` PK, `candidato_id` FK, `nivel` (enum), `curso_id` FK?, `instituicao` (texto), `situacao` (em andamento \| concluída \| trancada), `inicio`, `fim?` |
| CURSO | `id` PK, `nome` UK |
| ANUNCIANTE | `id` PK, `tipo` (PJ \| PF), `documento` UK (CNPJ ou CPF), `nome_exibicao`, `razao_social?`, `email_contato`, `telefone_contato`, `site?`, `verificacao` (pendente \| verificado \| recusado), `verificado_por` FK USUARIO?, `verificado_em?`, `metodo_verificacao?`, `motivo_recusa?`, `ativo`, `criado_em` |
| VAGA | `id` PK, `anunciante_id` FK, `criado_por` FK USUARIO, `tipo` (estagio \| emprego \| jovem_aprendiz), `exige_maior_idade` (bool), `titulo`, `descricao`, `modalidade` (presencial \| remoto \| hibrido), `cidade`, `carga_horaria`, `escolaridade_minima`, `curso_id` FK?, `requisitos?`, `beneficios?`, `remuneracao?`, `horario?`, `prazo` (timestamptz), `posicoes`, `situacao` (rascunho \| aguardando_pagamento \| aberta \| suspensa \| encerrada), `gratuita` (bool), `valor` (copiado de PRECO_VAGA no envio), `codigo_referencia` UK, `publicada_em?`, `expira_em?` |
| PAGAMENTO | `id` PK, `vaga_id` FK UK, `valor`, `codigo_referencia`, `situacao` (confirmado \| recusado \| reembolsado), `confirmado_por` FK USUARIO, `confirmado_em`, `observacao?` |
| PRECO_VAGA | `tipo` PK (estagio \| emprego \| jovem_aprendiz), `valor`, `atualizado_por` FK USUARIO, `atualizado_em` |
| CONFIGURACAO | `chave` PK, `valor`, `atualizado_em` (ex.: link da comunidade de anunciantes, contato de "Anuncie aqui") |
| PATROCINIO | `id` PK, `patrocinador` (texto), `imagem_url`, `link`, `posicao` (topo \| lateral \| rodape), `inicio`, `fim`, `valor_mensal?`, `criado_por` FK USUARIO |
| CANDIDATURA | `id` PK, `vaga_id` FK, `candidato_id` FK, `situacao`, `observacao?`, `criada_em`; UK (`vaga_id`, `candidato_id`) |
| HISTORICO_CANDIDATURA | `id` PK, `candidatura_id` FK, `situacao_anterior`, `situacao_nova`, `alterado_por` FK USUARIO? (vazio = sistema), `observacao?`, `alterado_em` |
| CONTATO | `id` PK, `anunciante_id` FK, `candidato_id` FK, `enviado_por` FK USUARIO, `mensagem`, `criado_em` |
| DENUNCIA | `id` PK, `vaga_id` FK, `usuario_id` FK, `motivo` (cobra dinheiro \| falsa \| ofensiva \| outro), `descricao?`, `situacao` (aberta \| procedente \| improcedente), `resolvida_por` FK USUARIO?, `criada_em`; UK (`vaga_id`, `usuario_id`) |
| NOTIFICACAO | `id` PK, `usuario_id` FK, `tipo`, `texto`, `link?`, `lida_em?`, `criada_em` |
| SESSAO | `id` PK, `usuario_id` FK, `token_hash` UK, `criada_em`, `ultimo_uso_em`, `expira_em`, `encerrada_em?` |
| TOKEN_USO_UNICO | `id` PK, `usuario_id` FK?, `anunciante_id` FK? (só no convite: a conta do convidado ainda não existe), `email_destino`, `tipo` (recuperacao \| convite \| troca_email), `token_hash` UK, `expira_em`, `usado_em?` |

Regras que o banco garante sozinho: unicidade de e-mail, CPF do candidato, documento do anunciante, candidatura por vaga e denúncia por vaga. As demais (escolaridade, limite de vagas do não verificado, limite de aprovados) ficam na API.

---

## 7. Histórias de Usuário (v1)

| Como... | quero... | Critérios de aceitação |
|---|---|---|
| visitante | ver vagas sem cadastro | Só vagas abertas e no prazo; selo/aviso de verificação visível; pedir para candidatar leva ao cadastro. |
| candidato | me cadastrar com minha escolaridade | CPF inválido ou repetido recusado; e-mail repetido recusado; menor de 16 recusado; sem aceite não conclui. |
| candidato | me candidatar | Bloqueado se escolaridade abaixo da mínima; estágio sem formação em andamento é bloqueado; segunda candidatura recusada; começa "Em análise". |
| candidato | escolher quem me vê | Padrão Oculto; Público aparece no mural só com nome resumido, formação e cidade; contatos nunca aparecem no mural; a mudança vale na hora. |
| visitante | ver que há gente cadastrada | O mural mostra cartões públicos e totais por curso; os cartões aparecem com esqueleto cinza enquanto as fotos carregam. |
| candidato | excluir minha conta | Pede a senha; dados pessoais anonimizados na hora; candidaturas em andamento canceladas; posso me cadastrar de novo com o mesmo CPF. |
| candidato | denunciar uma vaga | Uma vez por vaga; na 3ª denúncia a vaga some da busca. |
| anunciante | cadastrar minha empresa ou a mim (PF) | Documento inválido ou repetido recusado; nasce pendente; aviso "não verificado" aparece. |
| anunciante não verificado | publicar vaga | A primeira vaga é gratuita e sai com aviso "não verificado"; vaga paga é bloqueada com explicação de como se verificar. |
| anunciante verificado | publicar uma vaga paga | Vejo valor, chave PIX e código; vaga fica "aguardando pagamento"; quando o admin confirma, ela abre e sou avisado por e-mail. |
| administrador | confirmar pagamentos | Recebo e-mail e vejo a fila no painel; confirmo pelo código; a vaga abre; o registro guarda quem confirmou. |
| anunciante verificado | buscar candidatos | Vejo só os visíveis; nunca vejo CPF; mensagem gera notificação e e-mail. |
| administrador | verificar anunciantes | Fila de pendentes; verificar ou recusar com motivo; anunciante é notificado; decisão registrada. |
| administrador | julgar denúncias | Procedente encerra a vaga; improcedente a reabre; denunciantes não são identificados ao anunciante. |

---

## 8. Histórico de Versões

| Versão | Data | Descrição |
|---|---|---|
| 1.0 – 3.3 | até 09/10/2026 | Sistema de estágio para universitários (ver versões anteriores). |
| 4.9 | 14/10/2026 | Nome definido: EstagiaAqui, com domínio estagiaaqui.com.br e redirecionamentos (P6). |
| 4.8 | 14/10/2026 | Estratégia de divulgação com Instagram como vitrine (2.5); compartilhamento com link próprio, cartão de prévia e geração de arte para post/story (RF42); contagem de acessos por origem (RF43); pendência P9 sobre lançamento grátis e destaque pago. |
| 4.7 | 10/10/2026 | DER novo com as 17 tabelas (arquivo `Estagiaqui_DER_v4_7`); TOKEN_USO_UNICO ganha `anunciante_id` para o convite de responsável. |
| 4.6 | 10/10/2026 | Preço por tipo de vaga editável pelo administrador (RF39, PRECO_VAGA); "membro" renomeado para "responsável"; telefone com marcação de WhatsApp e botão wa.me (RN-C11); patrocínio negociado fora do site com página "Anuncie aqui" (RF38, RF40); comunidade de anunciantes no WhatsApp (RF41, CONFIGURACAO). |
| 4.5 | 10/10/2026 | Nome do sistema passa a ser Estagiaqui; estratégia de anúncios decidida: patrocinadores diretos primeiro, AdSense depois (2.4). |
| 4.4 | 10/10/2026 | Vaga encerrada automaticamente em 60 dias, sem renovação; vaga publicada não é editável, com revisão e dupla confirmação (RF29); preços iniciais R$ 20 (estágio) e R$ 35 (emprego); patrocinadores diretos e AdSense (RF38, tabela PATROCINIO). |
| 4.3 | 10/10/2026 | Modelo de receita por vaga com primeira vaga gratuita e PIX fora do site (2.4, RF28, RF29, RF37, RN-P); validade de 60 dias com renovação gratuita; nova tabela PAGAMENTO; avisos aos admins por e-mail e painel. |
| 4.2 | 10/10/2026 | Ícone e total por curso no mural (RF19); Central de Segurança pública (RF36); princípio de intermediação sem guarda de documentos (2.2); avisos de link ao candidato e ao anunciante (RN-C10). |
| 4.1 | 10/10/2026 | Visibilidade em três níveis e mural público (RF19, RN-C9); regras do link de currículo (RN-C10); verificação de PF sem guardar documento (RN-V3); exclusão por anonimização (RN-L); tipo jovem aprendiz, cadastro a partir de 14 anos e proibição de faixa etária nas vagas (RN-VG9); justificativa da ausência de JWT; P1, P2 e P3 resolvidas. |
| 4.0 | 10/10/2026 | Reescrita: vagas de emprego e estágio para qualquer escolaridade; anunciante PJ ou PF com verificação pelo administrador, selo e limites; denúncias; banco de talentos opt-in; vagas visíveis sem login; modelo de dados reduzido de 18 para 13 tabelas com tabela única de usuários; remoção de instituições restritivas, controle de CPF por tela de correção, sessão única e metas de disponibilidade irreais para a v1; correção das contradições da seção 9 da v3. |

---

## 9. Decisões, Pendências e Adiados

### 9.1 Decisões (10/10/2026)

| Tema | Decisão |
|---|---|
| Público | Geral: qualquer escolaridade, vagas de emprego e estágio. |
| Anunciantes | Empresas (CNPJ) e pessoas físicas (CPF). |
| Fraude | Administrador verifica e aprova a existência; anunciante não verificado publica com aviso e limite de 2 vagas; selo "Verificado"; aviso anti-golpe; denúncias na v1. |
| Visibilidade | Ninguém é exposto sem escolher: Oculto, Só verificados ou Público (resumido). Contatos só para anunciantes. |
| Currículo | Só link externo de domínios permitidos; o sistema não guarda arquivos. |
| Exclusão de conta | Imediata, por anonimização. |
| Idade | A vaga não escolhe faixa etária; o tipo jovem aprendiz cobre 14 a 24 anos. |
| Sessão | Token opaco, banco guarda só o hash, sem JWT. |
| Pagamentos | Não há. |
| Receita | Pagamento único por vaga (primeira grátis), PIX fora do site confirmado pelo admin; anúncios como receita extra. |
| Nome | EstagiaAqui (domínio principal: estagiaaqui.com.br). |
| Anúncios | Patrocinadores diretos primeiro; AdSense só com mais tráfego. |
| Patrocínio | Negociado fora do site; administrador cadastra o anúncio no painel. |
| Divulgação | Instagram como vitrine, site como destino; postagem manual com arte gerada pelo site. |
| Comunidade | Grupo/Comunidade de WhatsApp opcional para anunciantes verificados, administrado manualmente. |
| Avisos ao admin | E-mail e painel (sem WhatsApp na v1). |
| Hospedagem | API e banco em VPS; front em hospedagem gratuita. |

### 9.2 Pendências

| ID | Pendência |
|---|---|
| P4 | Conferir com orientação jurídica o cadastro a partir de 14 anos, as regras de jovem aprendiz (que exige vínculo com programa de aprendizagem) e a RN-VG9. |
| P5 | Encarregado de dados (LGPD), canal de contato do titular e textos de termos/política. |
| P6 | Registrar estagiaaqui.com.br (principal) e, como redirecionamento, estagiaqui.com.br e estagia-aqui.com.br; reservar @estagiaaqui no Instagram; conferir a marca no INPI. |
| P7 | Preço da vaga de jovem aprendiz; revisão dos preços após o lançamento. |
| P9 | Lançamento: abrir com preço R$ 0 (RF39) por 2 ou 3 meses para formar base de candidatos antes de cobrar? E criar o "destaque" pago (vaga no topo + post no Instagram) como produto além da vaga normal? |
| P8 | Formalização para receber: MEI ou CNPJ, emissão de nota fiscal, termos de uso com preço e política de reembolso (CDC). |

### 9.3 Adiados

| Item | Observação |
|---|---|
| Verificação automática de CNPJ via API pública | Hoje é manual pelo administrador. |
| Confirmação de e-mail no cadastro | Recomendada logo após a v1: reduz contas falsas. |
| Chat interno entre anunciante e candidato | Na v1, contato por e-mail, telefone/WhatsApp e mensagem de interesse. |
| Pedido de patrocínio pelo próprio site (envio de imagem e pagamento) | Só quando houver muitos patrocinadores; na v1 é negociado por fora (RF38). |
| Restrição de vaga por instituição de ensino | Removida da v1 (era RN35 da v3). |
| Upload de currículo em PDF | Na v1, link externo (RN-C10). |
| Dois fatores para administrador | Recomendado assim que houver usuários reais. |
| Auditoria ampliada (login, logout) | Futuro. |
| Expansão para outras cidades | Campo cidade já existe. |
| Confirmação automática de PIX (API de banco ou intermediador) | Quando o volume de pagamentos tornar a confirmação manual cara. |
| Destaque pago de vaga (P9) e avisos via WhatsApp/Telegram | Futuro. |
| Postagem automática no Instagram (API da Meta) | Na v1 a equipe publica manualmente. |

---

## Anexo A — Matriz de Permissões

| Funcionalidade | Visitante | Candidato | Responsável | Admin |
|---|---|---|---|---|
| Buscar e ver vagas e anunciantes | Sim | Sim | Sim | Sim |
| Cadastrar-se (candidato ou anunciante) | Sim | — | — | — |
| Editar próprio perfil e senha | — | Sim | Sim | Sim |
| Formações, perfil profissional, visibilidade | — | Próprio | — | — |
| Candidatar-se, cancelar, acompanhar | — | Próprias | — | — |
| Denunciar vaga | — | Sim | Sim | — |
| Editar anunciante, convidar responsáveis | — | — | Próprio | — |
| Publicar e gerenciar vagas | — | — | Próprio (paga só se verificado) | — |
| Confirmar pagamentos | — | — | — | Sim |
| Editar preços das vagas e patrocínios | — | — | — | Sim |
| Ver convite da comunidade de anunciantes | — | — | Só verificado | Sim |
| Avaliar candidaturas | — | — | Próprias vagas | — |
| Ver mural público de candidatos | Sim | Sim | Sim | Sim |
| Central de Segurança | Sim | Sim | Sim | Sim |
| Banco de talentos (perfil completo) | — | — | Só verificado | Sim |
| Verificar anunciantes, julgar denúncias | — | — | — | Sim |
| Desativar contas, cursos, administradores | — | — | — | Sim |
| Ver CPF | — | Próprio | Nunca | Sim |
