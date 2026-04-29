import type { InArgs } from "@libsql/client";
import type { FastifyInstance } from "fastify";
import { listTables, runReadOnlyQuery } from "../providers/turso.js";

interface QueryBody {
  sql?: string;
  args?: InArgs;
}

export async function registerTursoRoutes(app: FastifyInstance) {
  app.get("/v1/turso/tables", async () => ({
    tables: await listTables(),
  }));

  app.post<{ Body: QueryBody }>("/v1/turso/query", async (request) => {
    const sql = request.body?.sql ?? "";
    const args = request.body?.args ?? [];
    return runReadOnlyQuery(sql, args);
  });
}
