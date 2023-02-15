import * as dotenv from "dotenv";
import { Client } from "./client.js";
dotenv.config();
const client = new Client();
await client.load();
await client.start();
