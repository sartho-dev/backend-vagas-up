// POR QUE EXISTE: a RF33 diz que curso COM vínculo não pode ser excluído,
// mas `formations` (task 09) e `vacancies` (task 13) ainda não existem —
// então `hasLinks` devolve false e o caminho do 409 nunca roda pela API.
//
// Este teste trava o contrato agora, com um repositório falso. Quando a
// task 09 ligar o `hasLinks` de verdade, o comportamento já está garantido
// e o risco vira só o da consulta nova — não o de alguém ter esquecido de
// tratar o caso.
import { describe, it, expect } from "vitest";
import { CourseService } from "@/modules/course/service/CourseService";
import { ICourseRepository } from "@/modules/course/interfaces/ICourseRepository";
import { Course } from "@/modules/course/schema/Course.schema";
import { DeleteCourseOutcome } from "@/modules/course/types/CourseTypes";
import { AppError } from "@/shared/errors/AppError";

function repositoryReturning(outcome: DeleteCourseOutcome): ICourseRepository {
  return {
    create: async () => ({}) as Course,
    list: async () => [],
    findById: async () => null,
    rename: async () => null,
    delete: async () => outcome,
    hasLinks: async () => outcome === "has_links",
  };
}

describe("RF33 — o service traduz o resultado do repositório", () => {
  it("has_links vira 409 com mensagem explicativa", async () => {
    const service = new CourseService(repositoryReturning("has_links"));

    await expect(service.deleteService("qualquer-id")).rejects.toMatchObject({
      statusCode: 409,
    });

    await expect(service.deleteService("qualquer-id")).rejects.toThrow(
      /não pode ser excluído/,
    );
  });

  it("not_found vira 404", async () => {
    const service = new CourseService(repositoryReturning("not_found"));

    await expect(service.deleteService("qualquer-id")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("deleted não lança", async () => {
    const service = new CourseService(repositoryReturning("deleted"));

    await expect(service.deleteService("qualquer-id")).resolves.toBeUndefined();
  });

  it("404 e 409 são distinguíveis — não dá para confundir os dois casos", async () => {
    const missing = await service404();
    const linked = await service409();

    expect(missing).not.toBe(linked);
  });
});

async function service404(): Promise<number> {
  try {
    await new CourseService(repositoryReturning("not_found")).deleteService("x");
    return 0;
  } catch (error) {
    return (error as AppError).statusCode;
  }
}

async function service409(): Promise<number> {
  try {
    await new CourseService(repositoryReturning("has_links")).deleteService("x");
    return 0;
  } catch (error) {
    return (error as AppError).statusCode;
  }
}
