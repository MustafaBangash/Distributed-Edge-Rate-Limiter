import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";

import { createTestHarness } from "wrangler";

const server = createTestHarness({
	workers: [{ configPath: "./wrangler.jsonc" }],
});

describe("rate-limit Worker", () => {
	before(async () => {
		await server.listen();
	});

	afterEach(async () => {
		await server.reset();
	});

	after(async () => {
		await server.close();
	});

	it("reports its health without rate limiting", async () => {
		const response = await server.fetch("/health");

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			status: "ok",
			service: "distributed-edge-rate-limiter",
		});
		assert.equal(response.headers.get("x-ratelimit-limit"), null);
	});

	it("returns 404 for an unknown route", async () => {
		const response = await server.fetch("/missing");

		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), { error: "Not found" });
	});

	it("requires the identity configured by the matching policy", async () => {
		const response = await server.fetch("/api/protected");

		assert.equal(response.status, 401);
		assert.deepEqual(await response.json(), {
			error: "Client identity is required",
		});
	});

	it("rejects requests after a client exhausts its bucket", async () => {
		const headers = { "x-api-key": "exhausted-client" };

		const allowedResponse = await server.fetch("/api/protected", { headers });

		assert.equal(allowedResponse.status, 200);
		assert.equal(allowedResponse.headers.get("x-ratelimit-limit"), "1");
		assert.equal(allowedResponse.headers.get("x-ratelimit-remaining"), "0");

		const rejectedResponse = await server.fetch("/api/protected", {
			headers,
		});

		assert.equal(rejectedResponse.status, 429);
		assert.equal(rejectedResponse.headers.get("x-ratelimit-remaining"), "0");
		assert.equal(rejectedResponse.headers.get("retry-after"), "2");
		assert.deepEqual(await rejectedResponse.json(), {
			error: "Rate limit exceeded",
			retryAfterSeconds: 2,
		});
	});

	it("maintains independent buckets for different clients", async () => {
		const firstClientHeaders = { "x-api-key": "first-client" };

		const firstClientAllowed = await server.fetch("/api/protected", {
			headers: firstClientHeaders,
		});

		const firstClientRejected = await server.fetch("/api/protected", {
			headers: firstClientHeaders,
		});
		const secondClientAllowed = await server.fetch("/api/protected", {
			headers: { "x-api-key": "second-client" },
		});

		assert.equal(firstClientAllowed.status, 200);
		assert.equal(firstClientRejected.status, 429);
		assert.equal(secondClientAllowed.status, 200);
		assert.equal(secondClientAllowed.headers.get("x-ratelimit-remaining"), "0");
	});

	it("enforces a sliding-window policy", async () => {
		const headers = { "x-api-key": "sliding-window-client" };

		for (const expectedRemaining of ["2", "1", "0"]) {
			const response = await server.fetch("/api/sliding-window", { headers });

			assert.equal(response.status, 200);
			assert.equal(response.headers.get("x-ratelimit-limit"), "3");
			assert.equal(
				response.headers.get("x-ratelimit-remaining"),
				expectedRemaining,
			);
		}

		const rejectedResponse = await server.fetch("/api/sliding-window", {
			headers,
		});

		assert.equal(rejectedResponse.status, 429);
		assert.equal(rejectedResponse.headers.get("x-ratelimit-limit"), "3");
		assert.equal(rejectedResponse.headers.get("x-ratelimit-remaining"), "0");
		assert.equal(rejectedResponse.headers.get("retry-after"), "10");
	});
});
