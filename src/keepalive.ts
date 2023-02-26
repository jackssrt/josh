import consola from "consola";
import http from "http";

const host = "0.0.0.0";
const port = 8000;

const server = http.createServer((_, res) => {
	res.writeHead(200);
	res.end("ok");
});
server.listen(port, host, () => {
	consola.success(`Keep alive server is running on http://${host}:${port}`);
});
