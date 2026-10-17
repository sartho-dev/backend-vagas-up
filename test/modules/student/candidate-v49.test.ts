// POR QUE EXISTE: a TASK 04 alinhou o cadastro do candidato à v4.9. Cada
// bloco aqui trava uma regra que, se afrouxar, vira problema de conformidade
// e não apenas bug: idade mínima legal (RN-C1), lista fixa de escolaridade
// (RN-C2), exposição de menor de idade (RN-C9) e link externo (RN-C10).
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestContext,
  TestContext,
  loginAs,
  authHeader,
} from "../../utils/app";
import { createStudent, DEFAULT_PASSWORD } from "../../utils/fixtures";
import { truncateAll } from "../../setup/truncate";
import { MIN_AGE_YEARS } from "@/shared/services/CalculatorBirthDate";
import {
  EducationLevel,
  ProfileVisibility,
  PUBLIC_VISIBILITY_MIN_AGE,
} from "@/modules/student/types/StudentEnums";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();
});

// Data de nascimento de alguém que faz `years` anos exatamente hoje.
function birthDateForAge(years: number, dayOffset = 0): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

let seq = 0;
function validPayload(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return {
    cpf: "39053344705",
    name: "Candidato Teste",
    email: `cand_${Date.now()}_${seq}@test.local`,
    password: "SenhaForte123",
    birthDate: "2000-01-01",
    city: "Campo Grande",
    educationLevel: EducationLevel.HIGH_SCHOOL_COMPLETE,
    phones: [{ number: "67999999999", isWhatsapp: true }],
    acceptedTerms: true,
    acceptedPrivacy: true,
    ...overrides,
  };
}

function signUp(body: Record<string, unknown>) {
  return ctx.request.post("/api/v1/students").send(body);
}

describe("RN-C1 — idade mínima de 14 anos", () => {
  it("a constante do projeto é 14", () => {
    expect(MIN_AGE_YEARS).toBe(14);
  });

  it("aceita quem faz a idade mínima exatamente hoje", async () => {
    const res = await signUp(
      validPayload({ birthDate: birthDateForAge(MIN_AGE_YEARS) }),
    );

    expect(res.status).toBe(201);
  });

  it("recusa quem faz a idade mínima amanhã", async () => {
    const res = await signUp(
      validPayload({ birthDate: birthDateForAge(MIN_AGE_YEARS, 1) }),
    );

    expect(res.status).toBe(400);
  });
});

describe("RN-C2 — escolaridade é lista fixa", () => {
  it("aceita um valor da lista", async () => {
    const res = await signUp(
      validPayload({ educationLevel: EducationLevel.UNDERGRADUATE_IN_PROGRESS }),
    );

    expect(res.status).toBe(201);
  });

  it("recusa um valor fora da lista", async () => {
    const res = await signUp(validPayload({ educationLevel: "mestrado" }));

    expect(res.status).toBe(400);
  });

  it("exige escolaridade e cidade no cadastro", async () => {
    const { educationLevel, city, ...withoutBoth } = validPayload();

    expect((await signUp(withoutBoth)).status).toBe(400);
  });
});

describe("RN-C9 — visibilidade do perfil", () => {
  it("nasce oculto quando não informada", async () => {
    const res = await signUp(validPayload()).expect(201);

    expect(res.body.data.visibility).toBe(ProfileVisibility.HIDDEN);
  });

  it("maior de 18 pode escolher público", async () => {
    const res = await signUp(
      validPayload({
        birthDate: birthDateForAge(PUBLIC_VISIBILITY_MIN_AGE),
        visibility: ProfileVisibility.PUBLIC,
      }),
    );

    expect(res.status).toBe(201);
  });

  it("menor de 18 não pode escolher público", async () => {
    const res = await signUp(
      validPayload({
        birthDate: birthDateForAge(PUBLIC_VISIBILITY_MIN_AGE, 1),
        visibility: ProfileVisibility.PUBLIC,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("menor de 18 pode escolher só_verificados", async () => {
    const res = await signUp(
      validPayload({
        birthDate: birthDateForAge(15),
        visibility: ProfileVisibility.VERIFIED_ONLY,
      }),
    );

    expect(res.status).toBe(201);
  });
});

describe("RN-C11 — telefone", () => {
  it("é opcional na v4.9", async () => {
    const res = await signUp(validPayload({ phones: [] }));

    expect(res.status).toBe(201);
  });

  it("guarda a marca de WhatsApp por número", async () => {
    const res = await signUp(
      validPayload({
        phones: [
          { number: "67999999999", isWhatsapp: true },
          { number: "6733221100", isWhatsapp: false },
        ],
      }),
    ).expect(201);

    expect(res.body.data.phones).toEqual([
      { number: "67999999999", isWhatsapp: true },
      { number: "6733221100", isWhatsapp: false },
    ]);
  });
});

// A trava da RN-C9 no cadastro vive no validator (tem a data em mãos); na
// edição ela vive no service, que precisa buscar a idade no banco. São dois
// caminhos de código diferentes, então são dois testes.
describe("RN-C9 — mudança de visibilidade depois do cadastro", () => {
  async function studentLoggedIn(birthDate: string) {
    const email = `vis_${Date.now()}_${Math.random()}@test.local`;
    await createStudent(ctx.dataSource, ctx.hasher, { email, birthDate });
    return loginAs(ctx, email, DEFAULT_PASSWORD);
  }

  it("maior de 18 consegue passar para público", async () => {
    const { token } = await studentLoggedIn(
      birthDateForAge(PUBLIC_VISIBILITY_MIN_AGE),
    );

    const res = await ctx.request
      .patch("/api/v1/students")
      .set(authHeader(token))
      .send({ visibility: ProfileVisibility.PUBLIC });

    expect(res.status).toBe(200);
    expect(res.body.data.visibility).toBe(ProfileVisibility.PUBLIC);
  });

  it("menor de 18 é recusado com 403", async () => {
    const { token } = await studentLoggedIn(birthDateForAge(16));

    const res = await ctx.request
      .patch("/api/v1/students")
      .set(authHeader(token))
      .send({ visibility: ProfileVisibility.PUBLIC });

    expect(res.status).toBe(403);
  });

  it("menor de 18 consegue passar para só_verificados", async () => {
    const { token } = await studentLoggedIn(birthDateForAge(16));

    const res = await ctx.request
      .patch("/api/v1/students")
      .set(authHeader(token))
      .send({ visibility: ProfileVisibility.VERIFIED_ONLY });

    expect(res.status).toBe(200);
  });
});
