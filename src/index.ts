import Client from "./client.js";
import installDependencies from "./dependencies.js";

await installDependencies();
const client = (await Client.new()) as Client<boolean, boolean>;
await (client as Client).load();
await (client as Client<true>).start();
