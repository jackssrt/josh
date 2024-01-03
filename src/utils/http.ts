import { Err } from "ts-results-es";
import { request as undiciRequest } from "undici";
import { pawait } from "./result";

/**
 * Sends an http request and json-decode the response
 */
export async function request(...params: Parameters<typeof undiciRequest>) {
	const res = await undiciRequest(...params);
	if (!res.statusCode.toString().startsWith("2")) return Err(res);
	return (await pawait(res.body.json())).mapErr(() => res);
}
