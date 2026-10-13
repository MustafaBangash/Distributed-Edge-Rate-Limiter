# Distributed Edge Rate Limiter

A configurable rate-limiting service built with TypeScript, Cloudflare Workers,
and Durable Objects. It currently supports token-bucket and sliding-window
algorithms, applies policies by HTTP method and path, and keeps each client's
rate-limit state isolated.

This project is under active development. The rate-limiting core and local demo
routes work; forwarding approved requests to an external backend is planned.

## What it demonstrates

- Rate limiting at Cloudflare's edge
- Strongly consistent, per-client state stored in Durable Objects
- Token-bucket and sliding-window algorithms
- Typed, route-specific rate-limit policies
- Client isolation using hashed identities
- Standard `429 Too Many Requests` and `Retry-After` responses
- Unit and Worker integration tests

## How it works

```text
Client request
      |
      v
Cloudflare Worker ---- no matching policy ----> 404 response
      |
      | matching policy
      v
Read client identity from the request
      |
      v
Hash policy ID + client identity
      |
      v
Client-specific Durable Object
      |
      +---- allowed ----> 200 demo response
      |
      +---- denied -----> 429 + Retry-After
```

The Worker matches an incoming method and path against the policy registry. It
then selects a Durable Object using the policy ID and a SHA-256 hash of the
client identity. Requests using different API keys therefore receive separate
rate-limit state, even when they access the same route.

## Requirements

- Node.js and npm
- `curl` for the command-line examples

Wrangler is installed as a development dependency by `npm install`; a global
Wrangler installation is not required.

## Run locally

Install dependencies:

```bash
npm install
```

Start the local Cloudflare development server:

```bash
npm run dev
```

The equivalent direct command is:

```bash
npx wrangler dev
```

Wrangler normally prints a local URL such as `http://localhost:8787`. Leave
that terminal running and use a second terminal for the following examples.

### 1. Check the service

```bash
curl -i http://localhost:8787/health
```

Expected status: `200 OK`.

### 2. See identity validation

```bash
curl -i http://localhost:8787/api/protected
```

Expected status: `401 Unauthorized`, because this policy requires an
`x-api-key` header.

### 3. Test the token bucket

The `/api/protected` policy has a capacity of one token and refills at 0.5
tokens per second. Run two requests immediately:

```bash
for request in {1..2}; do
  curl -i -H "x-api-key: token-demo" http://localhost:8787/api/protected
done
```

The first request should return `200 OK`. The second should return `429 Too
Many Requests` with a `Retry-After` header. Wait approximately two seconds for
one token to refill, then try again:

```bash
curl -i -H "x-api-key: token-demo" http://localhost:8787/api/protected
```

### 4. Test the sliding window

The `/api/sliding-window` policy permits three requests during any moving
10-second window:

```bash
for request in {1..4}; do
  curl -i -H "x-api-key: sliding-demo" http://localhost:8787/api/sliding-window
done
```

The first three requests should return `200 OK`; the fourth should return `429
Too Many Requests`. After the oldest request leaves the 10-second window,
another request will be allowed.

### 5. Confirm client isolation

Try the sliding-window route with a different API key:

```bash
curl -i -H "x-api-key: another-client" http://localhost:8787/api/sliding-window
```

It should return `200 OK` because `another-client` has its own Durable Object
state.

Tip: change the API-key value when you want a fresh client during a demo.

## Run the automated checks

Run the type checker:

```bash
npm run typecheck
```

Run the unit and Worker integration tests:

```bash
npm test
```

## Configure policies

Policies are currently defined in `src/policies/registry.ts`. For example:

```ts
{
  id: "sliding-window-api",
  method: "GET",
  path: "/api/sliding-window",
  identity: "api-key",
  algorithm: "sliding-window",
  limit: 3,
  windowSeconds: 10,
}
```

Every policy defines where it applies, how the client is identified, which
algorithm to use, and that algorithm's settings.

## Project structure

```text
src/
  index.ts                         Worker and Durable Object entry point
  policies/
    match-policy.ts                Method and path matching
    registry.ts                    Configured rate-limit policies
    types.ts                       Policy types
  rate-limiter/
    token-bucket.ts                Token-bucket algorithm
    sliding-window.ts              Sliding-window algorithm
test/
  *.test.mjs                       Unit and Worker integration tests
wrangler.jsonc                     Cloudflare Worker configuration
```

## Current limitations and planned work

- Allowed requests currently receive a demo response instead of being
  forwarded to an origin application.
- API-key and Cloudflare-provided IP identities are modeled; authenticated user
  identity is not implemented yet.
- Policies are source-controlled rather than loaded dynamically.
- Production deployment automation and operational dashboards are planned.

## Built with

- TypeScript
- Cloudflare Workers
- Cloudflare Durable Objects
- Wrangler
- Node.js test runner

## Documentation

- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Durable Objects documentation](https://developers.cloudflare.com/durable-objects/)
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/)
