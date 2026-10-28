// POR QUE EXISTE: a página da vaga é o link que circula no WhatsApp, e o
// link sobrevive à vaga. Se ele continuar abrindo depois de a vaga ser
// suspensa por denúncia (RN-V7) ou vencer, o endereço vira porta dos fundos
// para exatamente o que a busca foi feita para esconder. O endereço também
// tem de nascer na publicação, nos DOIS caminhos — gratuita e paga —, senão
// metade das vagas fica sem página.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import {
  createAdmin,
  createAdvertiser,
  createCourse,
  createVacancy,
  DEFAULT_PASSWORD,
  vacancyPayload,
} from "../../utils/fixtures";
import { VerificationStatus } from "@/modules/advertiser/types/AdvertiserEnums";
import { SCAM_WARNING } from "@/modules/vacancy/types/VacancyTypes";
import { VacancySituation } from "@/modules/vacancy/types/VacancyEnums";
import { Vacancy } from "@/modules/vacancy/schema/Vacancy.schema";
import { VacancyRepository } from "@/modules/vacancy/repository/VacancyRepository";

let ctx: TestContext;
let advertiserId: string;
let responsibleId: string;
let responsibleJwt: string;
let adminJwt: string;

const PUBLIC = "/api/v1/public/vacancies";
const VACANCIES = "/api/v1/vacancies";

const OPEN = {
  situation: VacancySituation.OPEN,
  publishedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 86_400_000),
};

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
  const admin = await createAdmin(ctx.dataSource, ctx.hasher);
  adminJwt = (await loginAs(ctx, admin.email, DEFAULT_PASSWORD)).token;

  const { advertiser, responsible } = await createAdvertiser(
    ctx.dataSource,
    ctx.hasher,
    { verification: VerificationStatus.VERIFIED },
  );
  advertiserId = advertiser.id;
  responsibleId = responsible.id;
  responsibleJwt = (await loginAs(ctx, responsible.email, DEFAULT_PASSWORD))
    .token;
});

describe("RF42 — o endereço nasce na publicação", () => {
  it("rascunho e vaga aguardando pagamento não têm endereço", async () => {
    const criada = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload())
      .expect(201);

    const rascunho = await ctx.dataSource
      .getRepository(Vacancy)
      .findOne({ where: { id: criada.body.data.id } });

    // Link que abre em 404 é pior que link nenhum.
    expect(rascunho!.slug).toBeNull();
  });

  it("a vaga GRATUITA ganha endereço legível ao ser enviada", async () => {
    const criada = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(
        vacancyPayload({
          title: "Vendedor de loja no Centro",
          city: "Campo Grande",
        }),
      )
      .expect(201);

    await ctx.request
      .post(`${VACANCIES}/${criada.body.data.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(200);

    const publicada = await ctx.dataSource
      .getRepository(Vacancy)
      .findOne({ where: { id: criada.body.data.id } });

    // Título e cidade primeiro, sufixo sorteado no fim: é o endereço que a
    // pessoa lê colado no WhatsApp antes de clicar.
    expect(publicada!.slug).toMatch(
      /^vendedor-de-loja-no-centro-campo-grande-[a-z0-9]{6}$/,
    );
  });

  it("a vaga PAGA ganha endereço quando o admin confirma o PIX", async () => {
    // Gasta a gratuita para a próxima ser paga.
    const gratuita = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload())
      .expect(201);
    await ctx.request
      .post(`${VACANCIES}/${gratuita.body.data.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(200);

    const paga = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(vacancyPayload({ title: "Auxiliar de cozinha" }))
      .expect(201);
    await ctx.request
      .post(`${VACANCIES}/${paga.body.data.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(200);

    const antes = await ctx.dataSource
      .getRepository(Vacancy)
      .findOne({ where: { id: paga.body.data.id } });
    expect(antes!.slug).toBeNull();

    await ctx.request
      .post(`/api/v1/admin/payments/${paga.body.data.id}/confirm`)
      .set(authHeader(adminJwt))
      .send({ note: null })
      .expect(201);

    const depois = await ctx.dataSource
      .getRepository(Vacancy)
      .findOne({ where: { id: paga.body.data.id } });

    // Os dois caminhos de publicação passam pelo mesmo método, então nenhum
    // deles pode esquecer o endereço.
    expect(depois!.slug).toMatch(
      /^auxiliar-de-cozinha-campo-grande-[a-z0-9]{6}$/,
    );
  });

  it("acento e pontuação saem do endereço", async () => {
    const criada = await ctx.request
      .post(VACANCIES)
      .set(authHeader(responsibleJwt))
      .send(
        vacancyPayload({
          title: "Estágio em Nutrição (manhã)",
          city: "São Paulo",
        }),
      )
      .expect(201);
    await ctx.request
      .post(`${VACANCIES}/${criada.body.data.id}/submit`)
      .set(authHeader(responsibleJwt))
      .send({ confirmed: true })
      .expect(200);

    const publicada = await ctx.dataSource
      .getRepository(Vacancy)
      .findOne({ where: { id: criada.body.data.id } });

    // "São" vira "sao", não "s-o": o acento é removido da letra, não
    // trocado por hífen.
    expect(publicada!.slug).toMatch(
      /^estagio-em-nutricao-manha-sao-paulo-[a-z0-9]{6}$/,
    );
  });

  it("duas vagas de mesmo título e cidade têm endereços diferentes", async () => {
    const slugs: string[] = [];

    for (let i = 0; i < 3; i += 1) {
      const vaga = await createVacancy(
        ctx.dataSource,
        advertiserId,
        responsibleId,
        { value: 0, free: true },
      );
      // Chamando o repositório direto: publicar três vagas pelas rotas
      // exigiria três anunciantes (a gratuita é uma por anunciante) e o que
      // se testa aqui é só o sorteio do sufixo.
      const repository = new VacancyRepository(
        ctx.dataSource.getRepository(Vacancy),
      );
      const publicada = await repository.publish(
        vaga.id,
        new Date(),
        new Date(Date.now() + 30 * 86_400_000),
      );
      slugs.push(publicada!.slug!);
    }

    expect(new Set(slugs).size).toBe(3);
  });
});

describe("RF42 — a página da vaga", () => {
  it("visitante sem token abre a página e vê o aviso da RN-V6", async () => {
    const curso = await createCourse(ctx.dataSource, { name: "Nutrição" });
    await createVacancy(ctx.dataSource, advertiserId, responsibleId, {
      ...OPEN,
      slug: "vendedor-centro-a1b2c3",
      title: "Vendedor no Centro",
      description: "Descrição completa da vaga, com os detalhes do dia a dia.",
      courseId: curso.id,
    } as never);

    const res = await ctx.request
      .get(`${PUBLIC}/vendedor-centro-a1b2c3`)
      .expect(200);

    expect(res.body.data.vacancy).toMatchObject({
      slug: "vendedor-centro-a1b2c3",
      title: "Vendedor no Centro",
      courseName: "Nutrição",
      advertiserVerified: true,
    });
    // RN-V6: em toda página de vaga, sempre.
    expect(res.body.data.scamWarning).toBe(SCAM_WARNING);
  });

  it("a página traz o texto completo, que a busca não devolve", async () => {
    await createVacancy(ctx.dataSource, advertiserId, responsibleId, {
      ...OPEN,
      slug: "com-texto-campo-grande-aaa999",
      description: "Texto longo da vaga que a listagem não carrega.",
      requirements: "Ensino médio completo.",
      benefits: "Vale transporte.",
    } as never);

    const page = await ctx.request
      .get(`${PUBLIC}/com-texto-campo-grande-aaa999`)
      .expect(200);
    expect(page.body.data.vacancy.description).toMatch(/Texto longo/);
    expect(page.body.data.vacancy.requirements).toBe("Ensino médio completo.");

    // A listagem não carrega 20 descrições inteiras.
    const search = await ctx.request.get(PUBLIC).expect(200);
    expect(search.body.data.items[0]).not.toHaveProperty("description");
  });

  it("endereço que não existe é 404", async () => {
    await ctx.request.get(`${PUBLIC}/nao-existe-aaa111`).expect(404);
  });

  it("endereço com caractere estranho é 400", async () => {
    await ctx.request
      .get(`${PUBLIC}/${encodeURIComponent("VAGA MAIÚSCULA")}`)
      .expect(400);
  });
});

describe("RF42 — o link não é porta dos fundos", () => {
  // Cada caso aqui é uma vaga que a busca esconde. Se o link direto ainda
  // abrisse, esconder da busca não valeria nada.
  async function pageOf(
    overrides: Record<string, unknown>,
    slug: string,
  ): Promise<number> {
    await createVacancy(ctx.dataSource, advertiserId, responsibleId, {
      ...OPEN,
      slug,
      ...overrides,
    } as never);

    const res = await ctx.request.get(`${PUBLIC}/${slug}`);

    return res.status;
  }

  it("vaga suspensa por denúncia responde 404", async () => {
    // RN-V7: ela some da busca até o admin julgar. O link tem de sumir junto.
    expect(
      await pageOf(
        { situation: VacancySituation.SUSPENDED },
        "suspensa-campo-grande-hhh111",
      ),
    ).toBe(404);
  });

  it("vaga encerrada responde 404", async () => {
    expect(
      await pageOf(
        { situation: VacancySituation.CLOSED, closedAt: new Date() },
        "encerrada-campo-grande-hhh112",
      ),
    ).toBe(404);
  });

  it("vaga vencida responde 404 mesmo marcada como aberta", async () => {
    expect(
      await pageOf(
        { expiresAt: new Date(Date.now() - 86_400_000) },
        "vencida-campo-grande-hhh113",
      ),
    ).toBe(404);
  });

  it("prazo de candidatura vencido responde 404", async () => {
    // Sem candidatura possível, a página seria convite a se candidatar
    // para nada.
    expect(
      await pageOf(
        { deadline: new Date(Date.now() - 60_000) },
        "prazo-campo-grande-hhh114",
      ),
    ).toBe(404);
  });
});
