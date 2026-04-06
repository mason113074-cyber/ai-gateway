import "dotenv/config";
import { startGatewayServer } from "./server-bootstrap.js";

startGatewayServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
