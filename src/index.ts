import * as dotenv from "dotenv";
import { Client } from "./client.js";
import { IS_REPLIT } from "./env.js";
if (IS_REPLIT) import("./keepalive.js");
dotenv.config();
const client = new Client();
await client.load();
await client.start();
