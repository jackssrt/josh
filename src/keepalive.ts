import http from "http";
import logger from "./logger.js";

const host = "0.0.0.0";
const port = 8000;

const server = http.createServer((_, res) => {
	res.writeHead(200);
	res.end("ok");
});
server.listen(port, host, () => {
	logger.info(`Keep alive server is running on http://${host}:${port}`);
});
