import { Router } from "express";
import { Container } from "../../shared/container";

// RF14 e RF42: a parte pública das vagas. Montado em
// `/api/v1/public/vacancies`, FORA do `vacancyRoutes`, que exige token de
// responsável em todas as suas rotas.
//
// Não há `authenticate` aqui, e é o ponto da task: a busca e a página da
// vaga funcionam sem login (RF14). O visitante sem token recebe 200.
export function publicVacancyRoutes(container: Container): Router {
  const router = Router();
  const vacancies = container.publicVacancyController;

  /**
   * @swagger
   * /api/v1/public/vacancies:
   *   get:
   *     tags: [Vagas públicas]
   *     summary: Buscar vagas, sem login (RF14)
   *     description: >
   *       **Sem autenticação:** visitante sem token recebe 200. Só vagas
   *       `aberta` e **dentro do prazo**, 20 por página, mais recentes
   *       primeiro. Os filtros combinam entre si.
   *
   *       "Dentro do prazo" é conferido por **data**, não pela situação: a
   *       rotina que encerra vaga vencida é diária (task 22), então entre a
   *       meia-noite e a rotina existiria vaga `aberta` já vencida. Vaga
   *       suspensa por denúncia (RN-V7) e vaga encerrada nunca aparecem.
   *
   *       `keyword` usa busca textual do Postgres em português, com o
   *       título pesando mais que a cidade e a cidade mais que a descrição.
   *       Ela **não** casa pedaço de palavra: "vendedor" acha "vendedores",
   *       mas "vend" não acha nada. Com palavra-chave, o resultado vem por
   *       relevância e a data desempata; sem ela, vale o "mais recentes
   *       primeiro" puro.
   *
   *       `limit` não existe de propósito: são sempre 20 (RNF04).
   *
   *       Cada vaga traz `advertiserVerified` para a página mostrar o selo
   *       "Verificado" ou o aviso de anunciante não verificado (RN-V4,
   *       RN-V5). Valor, código de referência e contato do anunciante
   *       **não** vêm: a candidatura acontece dentro do site.
   *
   *       `scamWarning` (RN-V6) vem no topo da resposta.
   *     parameters:
   *       - in: query
   *         name: type
   *         schema: { type: string, enum: [estagio, emprego, jovem_aprendiz] }
   *       - in: query
   *         name: modality
   *         schema: { type: string, enum: [presencial, remoto, hibrido] }
   *       - in: query
   *         name: city
   *         description: Comparada em minúsculas; "Campo Grande" e "campo grande" são a mesma.
   *         schema: { type: string }
   *       - in: query
   *         name: minEducation
   *         description: Casamento exato com a escolaridade mínima da vaga.
   *         schema: { type: string }
   *       - in: query
   *         name: courseId
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: keyword
   *         schema: { type: string, minLength: 2, maxLength: 100 }
   *       - in: query
   *         name: page
   *         schema: { type: integer, minimum: 1, default: 1 }
   *     responses:
   *       200: { description: Vagas abertas que casam com os filtros }
   *       400: { $ref: "#/components/responses/BadRequest" }
   */
  router.get("/", vacancies.searchController);

  /**
   * @swagger
   * /api/v1/public/vacancies/{slug}:
   *   get:
   *     tags: [Vagas públicas]
   *     summary: Página pública da vaga (RF42)
   *     description: >
   *       **Sem autenticação.** A vaga é encontrada pelo endereço legível,
   *       não pelo id — `vendedor-centro-k3m9qp`. O endereço nasce na
   *       publicação: antes dela a vaga não tem página.
   *
   *       Aplica **exatamente** os mesmos cortes da busca. Uma vaga que saiu
   *       da busca não pode seguir acessível pelo link direto, senão o link
   *       compartilhado no WhatsApp vira porta dos fundos — e a vaga
   *       suspensa por denúncia (RN-V7), que some da busca para ser
   *       julgada, continuaria no ar para quem tem o link. Prazo vencido
   *       também responde 404, e não a página com um aviso: sem candidatura
   *       possível, a página seria um convite a se candidatar para nada.
   *
   *       `scamWarning` (RN-V6) vem junto, sempre.
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema: { type: string, pattern: "^[a-z0-9-]+$" }
   *     responses:
   *       200: { description: A vaga }
   *       400: { $ref: "#/components/responses/BadRequest" }
   *       404: { $ref: "#/components/responses/NotFound" }
   */
  router.get("/:slug", vacancies.getBySlugController);

  return router;
}
