/** Bindings the `/ws` router reads. Durable Object `Env` matches this shape. */
export interface SessionStub {
  fetch(request: Request): Promise<Response>;
}

export interface SessionBinding {
  getByName(name: string): SessionStub;
}

export interface WorkerEnv {
  GAME_SESSION?: SessionBinding;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_URL: string;
  JEV_MODEL: string;
}

/** Secrets that were never put on the Worker arrive as `undefined`, not `""`. */
export function readSecret(value: string | undefined): string {
  return typeof value === "string" ? value : "";
}
