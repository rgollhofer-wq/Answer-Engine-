import { FastifyInstance } from "fastify";

export function registerHealthRoute(app: FastifyInstance): void {
  app.get("/health", async () => {
    return { status: "ok", service: "answer-engine", version: "1.0.0" };
  });
}
