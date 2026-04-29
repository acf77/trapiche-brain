import cors from "@fastify/cors";
import Fastify from "fastify";
import { config, integrationStatus } from "./config.js";
import { ProviderError } from "./lib/http.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerRevenueRoutes } from "./routes/revenue.js";
import { registerTursoRoutes } from "./routes/turso.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.corsOrigin === "*" ? true : config.corsOrigin,
});

app.addHook("preHandler", async (request, reply) => {
  if (!config.apiKey) return;

  const auth = request.headers.authorization;
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;
  const apiKey = request.headers["x-api-key"];
  const provided = bearer ?? (Array.isArray(apiKey) ? apiKey[0] : apiKey);

  if (provided !== config.apiKey) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
});

app.setErrorHandler((err, _request, reply) => {
  if (err instanceof ProviderError) {
    return reply.status(err.statusCode).send({
      error: err.message,
      details: err.details,
    });
  }

  app.log.error(err);
  return reply.status(500).send({ error: "Internal server error" });
});

app.get("/health", async () => ({
  ok: true,
  service: "trapiche-brain",
  integrations: integrationStatus(),
}));

app.get("/v1/sources", async () => ({
  sources: [
    { id: "stripe", kind: "payments", configured: integrationStatus().stripe },
    { id: "abacatepay", kind: "payments", configured: integrationStatus().abacatepay },
    { id: "turso", kind: "database", configured: integrationStatus().turso },
    {
      id: "simple-analytics",
      kind: "web_analytics",
      configured: integrationStatus().simpleAnalytics,
      authenticated: integrationStatus().simpleAnalyticsPrivateAuth,
    },
    { id: "posthog", kind: "product_analytics", configured: integrationStatus().posthog },
  ],
}));

await registerRevenueRoutes(app);
await registerTursoRoutes(app);
await registerAnalyticsRoutes(app);

await app.listen({ port: config.port, host: config.host });
