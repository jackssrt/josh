
import Client from "./client.js";
import installDependencies from "./dependencies.js";
import { IS_PROD } from "./env.js";

await installDependencies();
if (IS_PROD) import("./keepalive.js");
const client = new (Client as typeof Client<boolean, boolean>)();
await client.load();
await client.start();
