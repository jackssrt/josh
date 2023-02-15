import * as dotenv from "dotenv";
import { Client } from "./client.js";
if (process.env["REPL_ID"]) import("./keepalive.js");
dotenv.config();
const client = new Client();
await client.load();
await client.start();
