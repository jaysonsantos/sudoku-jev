import type { WorkerEnv } from "./env.ts";
import { handleRequest } from "./route.ts";

export { GameSession } from "./session.ts";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
