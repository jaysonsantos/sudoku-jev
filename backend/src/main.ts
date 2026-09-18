import { HEALTH_PATH } from "../../shared/src/index.ts";
import { COMMAND, ENV, loadConfig } from "./config.ts";
import { startServer } from "./server.ts";

const LOCALHOST = "127.0.0.1";
const EXIT_FAILURE = 1;

async function health(port: number): Promise<void> {
  const response = await fetch(`http://${LOCALHOST}:${port}${HEALTH_PATH}`);
  if (!response.ok) {
    throw new Error(`health route answered ${response.status}`);
  }
}

async function main(): Promise<void> {
  const config = loadConfig(process.argv.slice(2), process.env);
  if (config.command === COMMAND.health) {
    await health(config.port);
    return;
  }
  if (config.openrouterApiKey.length === 0) {
    throw new Error(`${ENV.openrouterApiKey} is empty; put it in .env or pass --openrouter-api-key`);
  }
  startServer(config);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(EXIT_FAILURE);
});
