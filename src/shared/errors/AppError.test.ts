import { describe, it, expect } from "vitest";
import { AppError } from "./AppError";

describe("AppError", () => {
  it("deve criar um AppError com mensagem e status code padrão", () => {
    const error = new AppError("Erro teste");

    expect(error.message).toBe("Erro teste");
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe("AppError");
  });

  it("deve criar um AppError com status code customizado", () => {
    const error = new AppError("Não autorizado", 401);

    expect(error.message).toBe("Não autorizado");
    expect(error.statusCode).toBe(401);
  });

  it("deve ser uma instância de Error", () => {
    const error = new AppError("Erro");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });
});
