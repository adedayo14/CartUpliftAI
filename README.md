# CartUpliftAI

AI-powered recommendations and personalization for Shopify. This repo contains a minimal Node/TypeScript service that exposes content-based recommendations, mirroring the logic used in your AOV app’s ML endpoints.

## Features

- Express API server (TypeScript, ESM) with hot-reload in dev
- Content-based recommendations endpoint with basic and personalized modes
- Mock product dataset to develop against without a database
- Easy to deploy (Node 18+, Dockerfile included)

## Prerequisites

- Node.js 18 or newer
- npm

## Setup

cd CartUpliftAI
npm install
```
# CartUpliftAI

AI-powered recommendations and personalization for Shopify. This repo contains a minimal Node/TypeScript service that exposes content-based recommendations, mirroring the logic used in your AOV app’s ML endpoints.

## Features

- Express API server (TypeScript, ESM) with hot-reload in dev
- Content-based recommendations endpoint with basic and personalized modes
- Mock product dataset to develop against without a database
- Easy to deploy (Node 18+, Dockerfile example below)

## Prerequisites

- Node.js 18 or newer
- npm

## Setup

1) Clone and install dependencies

```bash
git clone https://github.com/adedayo14/CartUpliftAI.git
cd CartUpliftAI
npm install
```

2) Configure environment (optional)

Create a `.env` file with:

```
PORT=5050
```

## Run

- Development (hot reload):

```bash
npm run dev
```

You should see: `CartUpliftAI server listening on http://localhost:5050`

- Production build and run:

```bash
npm run build
npm start
```

## API

Base URL: `http://localhost:5050`

### Health

- GET `/health`
- Response: `{ ok: true, service: "cart-uplift-ai", version: "0.1.0" }`

### Content Recommendations

- POST `/api/ml/content-recommendations`

Request body:

```json
{
	"product_ids": ["product_1"],
	"exclude_ids": ["product_3"],
	"customer_preferences": {
		"category_affinity": { "primary": "Electronics" },
		"monetary": { "price_tier": "mid_range" },
		"time_patterns": { "preferred_hours": ["9", "10", "11"] }
	},
	"privacy_level": "basic"
}
```

Notes:
- `privacy_level`: `basic` (no advanced semantic step) or `full_ml` (adds semantic similarity step on mock data).
- `product_ids`: seed items to base similarity on.
- `exclude_ids`: item IDs to filter out from results.

Example curl:

```bash
curl -X POST http://localhost:5050/api/ml/content-recommendations \
	-H "Content-Type: application/json" \
	-d '{
		"product_ids":["product_1"],
		"exclude_ids":[],
		"customer_preferences":{
			"category_affinity":{"primary":"Electronics"},
			"monetary":{"price_tier":"mid_range"}
		},
		"privacy_level":"basic"
	}'
```

Response shape:

```json
{
	"recommendations": [
		{
			"product_id": "product_2",
			"score": 0.87,
			"reason": "Similar to Wireless Headphones",
			"strategy": "content_category",
			"attributes_matched": ["category"],
			"personalization_factors": ["category_preference"]
		}
	]
}
```

## Docker (optional)

```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5050
CMD ["node", "dist/server.js"]
```

## License

MIT

## Project structure

```
CartUpliftAI/
├─ src/
│  ├─ server.ts              # Express server and routes
│  ├─ data.ts                # Mock product dataset and helpers
│  └─ recommendations.ts     # Content recommendation logic
├─ package.json              # Scripts and dependencies
├─ tsconfig.json             # TypeScript configuration (ESM)
├─ .env.example              # Example environment variables
└─ Dockerfile                # Optional container build
```

## Environment variables

- `PORT` (default: `5050`)

## Deploy

- Any Node 18+ host works. For Docker:

```bash
docker build -t cart-uplift-ai .
docker run -p 5050:5050 --env PORT=5050 cart-uplift-ai
```

## Integrating with your AOV app

- Call this service from your Remix route (server-side) or from the storefront (client-side) and map results to your UI. This mirrors the logic in `app/routes/api.ml.content-recommendations.tsx` in your AOV repo.

## License

MIT