import path from "node:path";

export const IS_PROD = !!process.env["REPL_ID"];
export const IS_DEV = !IS_PROD;
export const IS_BUILT = path.extname(import.meta.url) !== ".ts";
