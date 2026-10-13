import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchPolicy } from "../src/policies/match-policy.ts";

const policies = [
	{
		id: "listings-read",
		method: "GET",
		path: "/api/listings",
		identity: "user",
		algorithm: "sliding-window",
		limit: 5,
		windowSeconds: 60,
	},
	{
		id: "listings-create",
		method: "POST",
		path: "/api/listings",
		identity: "api-key",
		algorithm: "token-bucket",
		capacity: 2,
		refillRatePerSecond: 0.5,
	},
];

describe("policy matching", () => {
	it("matches both the method and exact path", () => {
		assert.equal(
			matchPolicy("GET", "/api/listings", policies)?.id,
			"listings-read",
		);
		assert.equal(
			matchPolicy("POST", "/api/listings", policies)?.id,
			"listings-create",
		);
	});

	it("normalizes the incoming HTTP method", () => {
		assert.equal(
			matchPolicy("get", "/api/listings", policies)?.id,
			"listings-read",
		);
	});

	it("does not partially match paths", () => {
		assert.equal(matchPolicy("GET", "/api/listings/123", policies), undefined);
	});

	it("returns undefined when no policy matches", () => {
		assert.equal(matchPolicy("DELETE", "/api/listings", policies), undefined);
	});
});
