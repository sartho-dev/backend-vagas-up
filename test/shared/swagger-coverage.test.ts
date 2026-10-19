// POR QUE EXISTE: a definição de pronto no TASKS.md exige "rotas novas no
// Swagger", e isso foi ignorado em nove tasks seguidas — porque nada cobrava.
// Este teste cobra.
//
// Ele conta as rotas registradas no Express e compara com as operações
// documentadas. Não aponta QUAL rota ficou de fora (o Express 5 não expõe o
// prefixo de montagem de forma estável), mas falha alto e o diff do commit
// mostra na hora o que entrou sem documentação.
import { describe, it, expect } from "vitest";
import swaggerSpec from "@/shared/docs/swagger";
import { createTestContext } from "../utils/app";

type Spec = {
  paths?: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, { bearerFormat?: string }>;
  };
};

const spec = swaggerSpec as Spec;

const HTTP_METHODS = ["get", "post", "patch", "put", "delete"];

// Percorre a árvore de routers do Express somando pares caminho+método.
function countExpressRoutes(layer: {
  route?: { methods: Record<string, boolean> };
  handle?: { stack?: unknown[] };
}): number {
  if (layer.route) {
    return Object.keys(layer.route.methods).filter((m) =>
      HTTP_METHODS.includes(m),
    ).length;
  }

  const stack = layer.handle?.stack;
  if (!Array.isArray(stack)) return 0;

  return stack.reduce<number>(
    (total, child) => total + countExpressRoutes(child as never),
    0,
  );
}

function documentedOperations(): number {
  return Object.values(spec.paths ?? {}).reduce(
    (total, operations) =>
      total +
      Object.keys(operations).filter((m) => HTTP_METHODS.includes(m)).length,
    0,
  );
}

describe("Cobertura do Swagger", () => {
  it("toda rota registrada tem operação documentada", async () => {
    const ctx = await createTestContext();
    const router = (ctx.app as unknown as { router: { stack: unknown[] } })
      .router;

    const registered = router.stack.reduce<number>(
      (total, layer) => total + countExpressRoutes(layer as never),
      0,
    );

    expect(documentedOperations()).toBe(registered);
  });

  it("documenta ao menos uma operação (o spec não está vazio)", () => {
    expect(documentedOperations()).toBeGreaterThan(0);
  });
});

describe("Contrato do spec", () => {
  it("o token é declarado como opaco, nunca como JWT", () => {
    // Declarar bearerFormat: JWT faria ferramentas tentarem decodificar um
    // token que não carrega nada dentro.
    const scheme = spec.components?.securitySchemes?.bearerAuth;

    expect(scheme?.bearerFormat).toBe("opaque");
    expect(scheme?.bearerFormat).not.toMatch(/jwt/i);
  });

  it("os corpos vêm dos schemas Zod, com os limites reais", () => {
    // Se isto quebrar porque o validator mudou, a documentação mudou junto —
    // que é exatamente o objetivo de gerar em vez de escrever à mão.
    const course = spec.components?.schemas?.CreateCourse as {
      properties: { name: { minLength: number; maxLength: number } };
      additionalProperties: boolean;
    };

    expect(course.properties.name.minLength).toBe(2);
    expect(course.properties.name.maxLength).toBe(120);
    // Vem do `.strict()` do Zod.
    expect(course.additionalProperties).toBe(false);
  });

  it("todo $ref aponta para um componente que existe", () => {
    const refs = [...JSON.stringify(spec).matchAll(/"#\/components\/(\w+)\/(\w+)"/g)];
    const missing = refs.filter(([, kind, name]) => {
      const bag = (spec.components as Record<string, Record<string, unknown>>)?.[
        kind
      ];
      return !bag || !(name in bag);
    });

    expect(missing.map((m) => m[0])).toEqual([]);
  });
});
