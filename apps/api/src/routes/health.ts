import type { FastifyReply } from "fastify/types/reply";
import type { FastifyRequest } from "fastify/types/request";
import { renderMetrics } from "../metrics.js";
import type { RouteApp } from "./route-app.js";

export function registerHealthRoutes(app: RouteApp): void {
  app.get("/health", async () => ({ ok: true, service: "ai-gateway-api" }));

  app.get("/metrics", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .send(renderMetrics());
  });
}
