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

	it("rejects requests after a client exhausts its bucket", async () => {
		const headers = { "x-api-key": "exhausted-client" };

		for (let requestNumber = 1; requestNumber <= 5; requestNumber += 1) {
			const response = await server.fetch("/api/protected", { headers });

			assert.equal(response.status, 200);
			assert.equal(response.headers.get("x-ratelimit-limit"), "5");
			assert.equal(
				response.headers.get("x-ratelimit-remaining"),
				(5 - requestNumber).toString(),
			);
		}

		const rejectedResponse = await server.fetch("/api/protected", {
			headers,
		});

		assert.equal(rejectedResponse.status, 429);
		assert.equal(rejectedResponse.headers.get("x-ratelimit-remaining"), "0");
		assert.equal(rejectedResponse.headers.get("retry-after"), "1");
		assert.deepEqual(await rejectedResponse.json(), {
			error: "Rate limit exceeded",
			retryAfterSeconds: 1,
		});
	});

	it("maintains independent buckets for different clients", async () => {
		const firstClientHeaders = { "x-api-key": "first-client" };

		for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
			const response = await server.fetch("/api/protected", {
				headers: firstClientHeaders,
			});
			assert.equal(response.status, 200);
		}

		const firstClientRejected = await server.fetch("/api/protected", {
			headers: firstClientHeaders,
		});
		const secondClientAllowed = await server.fetch("/api/protected", {
			headers: { "x-api-key": "second-client" },
		});

		assert.equal(firstClientRejected.status, 429);
		assert.equal(secondClientAllowed.status, 200);
		assert.equal(secondClientAllowed.headers.get("x-ratelimit-remaining"), "4");
	});
});
