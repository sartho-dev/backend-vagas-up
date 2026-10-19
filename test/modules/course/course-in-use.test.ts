// POR QUE EXISTE: a task 08 deixou a RF33 ("curso com vínculo não é
// excluído") sem teste de ponta a ponta, porque `formations` não existia e
// o `hasLinks` devolvia false. Agora existe — este é o teste que faltava.
//
// Sem ele, excluir um curso em uso deixaria formações apontando para um
// registro que sumiu.
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
  createStudent,
  DEFAULT_PASSWORD,
} from "../../utils/fixtures";
import { EducationLevel } from "@/modules/student/types/StudentEnums";
import { FormationStatus } from "@/modules/formation/types/FormationEnums";

let ctx: TestContext;
let adminToken: string;
let studentToken: string;
let courseId: string;

beforeAll(async () => {
  ctx = await createTestContext();
});

beforeEach(async () => {
  await truncateAll();

  await createAdmin(ctx.dataSource, ctx.hasher, { email: "adm@test.local" });
  adminToken = (await loginAs(ctx, "adm@test.local", DEFAULT_PASSWORD)).token;

  const course = await ctx.request
    .post("/api/v1/admin/courses")
    .set(authHeader(adminToken))
    .send({ name: "Administração" })
    .expect(201);
  courseId = course.body.data.id;

  await createStudent(ctx.dataSource, ctx.hasher, { email: "cand@test.local" });
  studentToken = (await loginAs(ctx, "cand@test.local", DEFAULT_PASSWORD)).token;
});

async function addFormation() {
  const res = await ctx.request
    .post("/api/v1/students/me/formations")
    .set(authHeader(studentToken))
    .send({
      level: EducationLevel.UNDERGRADUATE_IN_PROGRESS,
      courseId,
      institution: "UFMS",
      status: FormationStatus.IN_PROGRESS,
      startDate: "2024-02-01",
      endDate: null,
    })
    .expect(201);

  return res.body.data.id as string;
}

const deleteCourse = () =>
  ctx.request
    .delete(`/api/v1/admin/courses/${courseId}`)
    .set(authHeader(adminToken));

describe("RF33 — curso em uso não pode ser excluído", () => {
  it("com formação vinculada: 409", async () => {
    await addFormation();

    const res = await deleteCourse().expect(409);

    expect(res.body.message).toMatch(/não pode ser excluído/);
  });

  it("o curso continua na lista depois do 409", async () => {
    await addFormation();
    await deleteCourse().expect(409);

    const list = await ctx.request.get("/api/v1/courses").expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it("removida a formação, o curso sai", async () => {
    const formationId = await addFormation();
    await deleteCourse().expect(409);

    await ctx.request
      .delete(`/api/v1/students/me/formations/${formationId}`)
      .set(authHeader(studentToken))
      .expect(204);

    await deleteCourse().expect(204);
  });
});
