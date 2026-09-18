import { parseArgs } from "node:util";

// region: names
export const ENV = {
  openrouterApiKey: "OPENROUTER_API_KEY",
  openrouterUrl: "OPENROUTER_URL",
  jevModel: "JEV_MODEL",
  port: "PORT",
  host: "HOST",
  staticDir: "STATIC_DIR",
} as const;

export const FLAG = {
  openrouterApiKey: "openrouter-api-key",
  openrouterUrl: "openrouter-url",
  jevModel: "jev-model",
  port: "port",
  host: "host",
  staticDir: "static-dir",
} as const;

export const DEFAULTS = {
  openrouterUrl: "https://openrouter.ai/api/alpha/decisions",
  jevModel: "typesafe/jev-1.13",
  port: 8080,
  host: "0.0.0.0",
  staticDir: "frontend/dist",
} as const;

export const COMMAND = {
  serve: "serve",
  health: "health",
} as const;
export type Command = (typeof COMMAND)[keyof typeof COMMAND];
// endregion: names

export interface Config {
  command: Command;
  openrouterApiKey: string;
  openrouterUrl: string;
  jevModel: string;
  port: number;
  host: string;
  staticDir: string;
}

export function defaultConfig(): Config {
  return {
    command: COMMAND.serve,
    openrouterApiKey: "",
    openrouterUrl: DEFAULTS.openrouterUrl,
    jevModel: DEFAULTS.jevModel,
    port: DEFAULTS.port,
    host: DEFAULTS.host,
    staticDir: DEFAULTS.staticDir,
  };
}

/** Every setting is a long flag, an environment variable, and a default. The flag wins. */
export function loadConfig(argv: string[], env: NodeJS.ProcessEnv): Config {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      [FLAG.openrouterApiKey]: { type: "string" },
      [FLAG.openrouterUrl]: { type: "string" },
      [FLAG.jevModel]: { type: "string" },
      [FLAG.port]: { type: "string" },
      [FLAG.host]: { type: "string" },
      [FLAG.staticDir]: { type: "string" },
    },
  });
  const pick = (flag: string, envName: string): string | undefined => {
    const fromFlag = values[flag as keyof typeof values];
    return typeof fromFlag === "string" ? fromFlag : env[envName];
  };
  const command = positionals[0] ?? COMMAND.serve;
  if (command !== COMMAND.serve && command !== COMMAND.health) {
    throw new Error(`unknown command "${command}", expected "${COMMAND.serve}" or "${COMMAND.health}"`);
  }
  const base = defaultConfig();
  const portText = pick(FLAG.port, ENV.port);
  const port = portText === undefined ? base.port : Number.parseInt(portText, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`invalid port "${portText}"`);
  }
  return {
    command,
    openrouterApiKey: pick(FLAG.openrouterApiKey, ENV.openrouterApiKey) ?? base.openrouterApiKey,
    openrouterUrl: pick(FLAG.openrouterUrl, ENV.openrouterUrl) ?? base.openrouterUrl,
    jevModel: pick(FLAG.jevModel, ENV.jevModel) ?? base.jevModel,
    port,
    host: pick(FLAG.host, ENV.host) ?? base.host,
    staticDir: pick(FLAG.staticDir, ENV.staticDir) ?? base.staticDir,
  };
}
