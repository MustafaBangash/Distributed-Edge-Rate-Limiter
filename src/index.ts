import { DurableObject } from "cloudflare:workers";

/**
 * The generated Durable Object remains registered while we build the HTTP
 * request flow. We will turn this into the rate-limit bucket in a later step.
 */
export class MyDurableObject extends DurableObject<Env> {
	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}
}

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

export default {
	async fetch(request): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return jsonResponse({
				status: "ok",
				service: "distributed-edge-rate-limiter",
			});
		}

		if (request.method === "GET" && url.pathname === "/api/protected") {
			return jsonResponse({
				message: "Request reached the protected API",
				rateLimitApplied: false,
			});
		}

		return jsonResponse({ error: "Not found" }, 404);
	},
} satisfies ExportedHandler<Env>;
