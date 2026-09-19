/** Bindings the `/ws` router reads. Durable Object `Env` matches this shape. */
export interface SessionStub {
  fetch(request: Request): Promise<Response>;
}

export interface SessionBinding {
  getByName(name: string): SessionStub;
}

export interface WorkerEnv {
  GAME_SESSION: SessionBinding;
  OPENROUTER_API_KEY: string;
  OPENROUTER_URL: string;
  JEV_MODEL: string;
}
