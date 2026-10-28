// POR QUE EXISTE: esta é a única parte do site que estranho vê sem conta, e
// é por ela que todo candidato entra. Duas coisas podem dar errado e as
// duas são graves: vaga que não devia aparecer aparecendo (suspensa por
// denúncia, encerrada, vencida), e dado que não devia sair saindo (valor
// pago, código do PIX, contato do anunciante). O resto é conveniência.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { truncateAll } from "../../setup/truncate";
import {
  createAdvertiser,
  createCourse,
  createVacancy,
  DEFAULT_PASSWORD,
  vacancyPayload,
} from "../../utils/fixtures";
import { VerificationStatus } from "@/modules/advertiser/types/AdvertiserEnums";
import { SCAM_WARNING } from "@/modules/vacancy/types/VacancyTypes";
import {
  VacancyModality,
  VacancySituation,
} from "@/modules/vacancy/types/VacancyEnums";
import { EducationLevel } from "@/modules/student/types/StudentEnums";
import { VacancyType } from "@/shared/types/VacancyType";

let ctx: TestContext;
let advertiserId: string;
let responsibleId: string;

const SEARCH = "/api/v1/public/vacancies";

// Uma vaga ABERTA e válida, que é o único estado que a busca mostra.
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
  const { advertiser, responsible } = await createAdvertiser(
    ctx.dataSource,
    ctx.hasher,
    { verification: VerificationStatus.VERIFIED },
  );
  advertiserId = advertiser.id;
  responsibleId = responsible.id;
});

function open(overrides: Record<string, unknown> = {}) {
  return createVacancy(ctx.dataSource, advertiserId, responsibleId, {
    ...OPEN,
    ...overrides,
  } as never);
}

describe("RF14 — busca sem login", () => {
  it("visitante sem token recebe 200", async () => {
    await open({ slug: "estagio-campo-grande-aaa111" });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.items).toHaveLength(1);
  });

  it("traz o aviso anti-golpe da RN-V6, palavra por palavra", async () => {
    await open({ slug: "estagio-campo-grande-aaa112" });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.scamWarning).toBe(SCAM_WARNING);
    expect(res.body.data.scamWarning).toMatch(
      /Nenhuma vaga legítima cobra taxa, curso ou material/,
    );
  });

  it("mais recentes primeiro", async () => {
    await open({
      slug: "antiga-campo-grande-aaa113",
      title: "Vaga antiga de estágio",
      publishedAt: new Date(Date.now() - 10 * 86_400_000),
    });
    await open({
      slug: "nova-campo-grande-aaa114",
      title: "Vaga nova de estágio",
      publishedAt: new Date(),
    });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.items[0].title).toBe("Vaga nova de estágio");
  });

  it("20 por página, e o limite não vem da URL", async () => {
    for (let i = 0; i < 22; i += 1) {
      await open({ slug: `vaga-campo-grande-b${String(i).padStart(5, "0")}` });
    }

    const p1 = await ctx.request.get(SEARCH).expect(200);
    expect(p1.body.data.items).toHaveLength(20);
    expect(p1.body.data.total).toBe(22);

    const p2 = await ctx.request.get(`${SEARCH}?page=2`).expect(200);
    expect(p2.body.data.items).toHaveLength(2);

    // `?limit=5000` seria o caminho mais curto para derrubar os 2 s da
    // RNF04. O parâmetro é ignorado, não obedecido.
    const forcado = await ctx.request.get(`${SEARCH}?limit=5000`).expect(200);
    expect(forcado.body.data.items).toHaveLength(20);
    expect(forcado.body.data.limit).toBe(20);
  });
});

describe("RF14 — o que NÃO aparece", () => {
  it("vaga suspensa e vaga encerrada ficam fora", async () => {
    await open({ slug: "aberta-campo-grande-ccc111" });
    await open({
      slug: "suspensa-campo-grande-ccc112",
      situation: VacancySituation.SUSPENDED,
    });
    await open({
      slug: "encerrada-campo-grande-ccc113",
      situation: VacancySituation.CLOSED,
      closedAt: new Date(),
    });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].slug).toBe("aberta-campo-grande-ccc111");
  });

  it("rascunho e vaga aguardando pagamento ficam fora", async () => {
    await createVacancy(ctx.dataSource, advertiserId, responsibleId, {
      situation: VacancySituation.DRAFT,
    });
    await createVacancy(ctx.dataSource, advertiserId, responsibleId, {
      situation: VacancySituation.AWAITING_PAYMENT,
      value: 5,
    });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.total).toBe(0);
  });

  it("vaga vencida fica fora mesmo ainda marcada como aberta", async () => {
    // A rotina que encerra vaga vencida é diária (task 22). Entre a
    // meia-noite e a rotina existe vaga `aberta` já vencida, e ela não pode
    // aparecer nessa janela.
    await open({
      slug: "vencida-campo-grande-ddd111",
      expiresAt: new Date(Date.now() - 86_400_000),
    });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.total).toBe(0);
  });

  it("vaga com prazo de candidatura vencido fica fora", async () => {
    await open({
      slug: "prazo-campo-grande-ddd112",
      deadline: new Date(Date.now() - 60_000),
    });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.total).toBe(0);
  });

  it("vaga sem prazo aparece: o prazo é opcional (RN-VG3)", async () => {
    await open({ slug: "semprazo-campo-grande-ddd113", deadline: null });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.total).toBe(1);
  });
});

describe("RF14 — filtros combinam", () => {
  beforeEach(async () => {
    await open({
      slug: "a-campo-grande-eee111",
      type: VacancyType.INTERNSHIP,
      modality: VacancyModality.ON_SITE,
      city: "Campo Grande",
      minEducation: EducationLevel.UNDERGRADUATE_IN_PROGRESS,
    });
    await open({
      slug: "b-dourados-eee112",
      type: VacancyType.INTERNSHIP,
      modality: VacancyModality.REMOTE,
      city: "Dourados",
      minEducation: EducationLevel.UNDERGRADUATE_IN_PROGRESS,
    });
    await open({
      slug: "c-campo-grande-eee113",
      type: VacancyType.EMPLOYMENT,
      modality: VacancyModality.ON_SITE,
      city: "Campo Grande",
      workHours: 44,
      minEducation: EducationLevel.HIGH_SCHOOL_COMPLETE,
    });
  });

  it("filtra por tipo", async () => {
    const res = await ctx.request
      .get(`${SEARCH}?type=${VacancyType.EMPLOYMENT}`)
      .expect(200);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].slug).toBe("c-campo-grande-eee113");
  });

  it("filtra por modalidade", async () => {
    const res = await ctx.request
      .get(`${SEARCH}?modality=${VacancyModality.REMOTE}`)
      .expect(200);

    expect(res.body.data.total).toBe(1);
  });

  it("filtra por cidade, ignorando maiúscula", async () => {
    // A cidade é texto livre do anunciante: "Campo Grande" e "campo grande"
    // são a mesma cidade, e o candidato não devia ter de acertar a caixa.
    const res = await ctx.request
      .get(`${SEARCH}?city=campo grande`)
      .expect(200);

    expect(res.body.data.total).toBe(2);
  });

  it("filtra por escolaridade mínima", async () => {
    const res = await ctx.request
      .get(`${SEARCH}?minEducation=${EducationLevel.HIGH_SCHOOL_COMPLETE}`)
      .expect(200);

    expect(res.body.data.total).toBe(1);
  });

  it("filtra por curso", async () => {
    const curso = await createCourse(ctx.dataSource, { name: "Administração" });
    await open({ slug: "d-campo-grande-eee114", courseId: curso.id });

    const res = await ctx.request
      .get(`${SEARCH}?courseId=${curso.id}`)
      .expect(200);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].slug).toBe("d-campo-grande-eee114");
  });

  it("dois filtros juntos estreitam o resultado", async () => {
    const res = await ctx.request
      .get(
        `${SEARCH}?type=${VacancyType.INTERNSHIP}&modality=${VacancyModality.ON_SITE}&city=Campo Grande`,
      )
      .expect(200);

    // Só a primeira casa com os três ao mesmo tempo.
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].slug).toBe("a-campo-grande-eee111");
  });

  it("filtro sem resultado devolve lista vazia, não erro", async () => {
    const res = await ctx.request.get(`${SEARCH}?city=Corumbá`).expect(200);

    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });
});

describe("RF14 — palavra-chave", () => {
  it("acha pelo título e flexiona a palavra", async () => {
    await open({
      slug: "vend-campo-grande-fff111",
      title: "Vendedor de loja no centro",
    });
    await open({
      slug: "cozinha-campo-grande-fff112",
      title: "Auxiliar de cozinha",
    });

    // Busca em português: "vendedores" casa com "Vendedor" pelo radical.
    const res = await ctx.request
      .get(`${SEARCH}?keyword=vendedores`)
      .expect(200);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].slug).toBe("vend-campo-grande-fff111");
  });

  it("acha pela descrição também", async () => {
    await open({
      slug: "desc-campo-grande-fff113",
      title: "Auxiliar administrativo",
      description:
        "Trabalho com planilhas, relatórios e atendimento ao cliente.",
    });

    const res = await ctx.request
      .get(`${SEARCH}?keyword=planilhas`)
      .expect(200);

    expect(res.body.data.total).toBe(1);
  });

  it("título pesa mais que descrição", async () => {
    await open({
      slug: "mencao-campo-grande-fff114",
      title: "Auxiliar de limpeza",
      description: "Vaga de limpeza; não é vaga de vendedor.",
      publishedAt: new Date(),
    });
    await open({
      slug: "titulo-campo-grande-fff115",
      title: "Vendedor interno",
      description: "Atendimento no balcão.",
      // Mais ANTIGA: se a ordem fosse só por data, ela viria depois.
      publishedAt: new Date(Date.now() - 5 * 86_400_000),
    });

    const res = await ctx.request.get(`${SEARCH}?keyword=vendedor`).expect(200);

    // Com palavra-chave, relevância manda: quem digita "vendedor" quer a
    // vaga DE vendedor, não a mais recente que menciona vendedor de passagem.
    expect(res.body.data.items[0].slug).toBe("titulo-campo-grande-fff115");
  });

  it("palavra que não existe devolve vazio", async () => {
    await open({ slug: "nada-campo-grande-fff116" });

    const res = await ctx.request
      .get(`${SEARCH}?keyword=astronauta`)
      .expect(200);

    expect(res.body.data.total).toBe(0);
  });

  it("aspas e símbolos não quebram a busca", async () => {
    await open({ slug: "sym-campo-grande-fff117" });

    // `websearch_to_tsquery` aceita o que a pessoa digitar. Com
    // `to_tsquery` isto seria erro de sintaxe e 500.
    await ctx.request
      .get(`${SEARCH}?keyword=${encodeURIComponent('"vaga" & !x')}`)
      .expect(200);
  });
});

describe("o que a busca pública NÃO devolve", () => {
  it("nada de valor, código de referência nem contato do anunciante", async () => {
    await open({
      slug: "privado-campo-grande-ggg111",
      value: 5,
      free: false,
      referenceCode: "ZZZZ2345",
    });

    const res = await ctx.request.get(SEARCH).expect(200);
    const item = res.body.data.items[0];

    // Valor e gratuidade são a relação comercial com o site, não assunto do
    // candidato. O código de referência é identificador de pagamento.
    expect(item).not.toHaveProperty("value");
    expect(item).not.toHaveProperty("free");
    expect(item).not.toHaveProperty("referenceCode");
    expect(item).not.toHaveProperty("createdBy");
    // O contato sai pelo site (task 16), não raspado da página.
    expect(item).not.toHaveProperty("advertiserDocument");
    expect(item).not.toHaveProperty("advertiserEmail");
    expect(JSON.stringify(item)).not.toContain("ZZZZ2345");
  });

  it("mostra o selo de verificado (RN-V5)", async () => {
    await open({ slug: "selo-campo-grande-ggg112" });

    const res = await ctx.request.get(SEARCH).expect(200);

    expect(res.body.data.items[0].advertiserVerified).toBe(true);
  });

  it("anunciante não verificado aparece sem selo (RN-V4)", async () => {
    const outro = await createAdvertiser(ctx.dataSource, ctx.hasher, {
      document: "04252011000110",
      email: "naoverif@test.local",
      verification: VerificationStatus.PENDING,
      displayName: "Loja Sem Selo",
    });
    await createVacancy(
      ctx.dataSource,
      outro.advertiser.id,
      outro.responsible.id,
      { ...OPEN, slug: "semselo-campo-grande-ggg113" } as never,
    );

    const res = await ctx.request
      .get(`${SEARCH}?keyword=${encodeURIComponent("estágio")}`)
      .expect(200);

    const item = res.body.data.items.find(
      (i: { advertiserName: string }) => i.advertiserName === "Loja Sem Selo",
    );
    // A vaga APARECE — o não verificado publica a gratuita (RN-V4). O que
    // muda é o selo, que a página troca por aviso.
    expect(item.advertiserVerified).toBe(false);
  });
});
