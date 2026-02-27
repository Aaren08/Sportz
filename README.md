# Sportz

Real-time sports match and commentary backend built with Express, WebSockets, Drizzle ORM, PostgreSQL, Arcjet security, and Site24x7 APM Insight.

## What This Project Does

- Exposes REST APIs to create and list matches.
- Exposes REST APIs to create and list commentary for a specific match.
- Broadcasts real-time updates over WebSocket:
  - New match created -> `match_update` event to all clients
  - New commentary created -> `commentary_update` event to subscribers of that match
- Applies Arcjet protection to both HTTP requests and WebSocket connections.
- Initializes APM instrumentation using Site24x7 APM Insight (`apminsight` package).

## Tech Stack

- Runtime: Node.js (ESM)
- HTTP framework: Express 5
- Realtime: `ws`
- Validation: Zod
- Database: PostgreSQL + Drizzle ORM
- Security: Arcjet (`@arcjet/node`)
- Monitoring/APM: Site24x7 APM Insight (`apminsight`)

## Project Structure

```text
.
|- src/
|  |- index.js                  # app bootstrap (HTTP + WS server)
|  |- arcjet.js                 # Arcjet config + HTTP middleware + WS policy object
|  |- routes/
|  |  |- matches.js             # /matches endpoints
|  |  |- commentary.js          # /matches/:id/commentary endpoints
|  |- ws/
|  |  |- server.js              # WebSocket server, subscribe/unsubscribe, broadcasts
|  |- db/
|  |  |- db.js                  # Drizzle + pg Pool initialization
|  |  |- schema.js              # matches/commentary schema
|  |- validation/
|  |  |- matches.js             # match request/query schemas
|  |  |- commentary.js          # commentary request/query schemas
|  |- utils/
|     |- match-status.js        # scheduled/live/finished utility
|- drizzle/
|  |- 0000_massive_dazzler.sql  # initial migration SQL
|  |- meta/                      # drizzle migration metadata
|- apminsightnode.json           # Site24x7 APM Insight agent config
|- apminsightdata/               # local APM Insight runtime data
|- drizzle.config.js             # drizzle-kit config
|- package.json
```

## Architecture Overview

1. HTTP and WebSocket share the same Node `http` server (`src/index.js`).
2. Arcjet middleware is attached globally for HTTP.
3. Arcjet policy is also applied on each WS connection.
4. Route handlers write to PostgreSQL via Drizzle.
5. After DB writes, route handlers call broadcast functions attached in `app.locals`.
6. WebSocket server sends JSON events to all clients or per-match subscribers.

## Prerequisites

- Node.js 20+ recommended
- PostgreSQL database
- Arcjet key
- Site24x7 APM Insight account/license key (if using APM)

## Environment Variables

Create `.env` with values similar to:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?sslmode=require
ARCJET_KEY=your_arcjet_key
ARCJET_ENV=LIVE
PORT=8000
HOST=0.0.0.0
```

Optional variables currently present in local setup:

- `API_URL`
- `BROADCAST`
- `DELAY_MS`
- `MATCH_COUNT`

Notes:

- `DATABASE_URL` is required by both app runtime and Drizzle CLI.
- `ARCJET_KEY` is required; app throws on startup if missing.
- `ARCJET_ENV` maps to Arcjet mode:
  - `DRY_RUN` -> DRY_RUN
  - any other value -> LIVE

## Installation & Run

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Production start:

```bash
npm start
```

On startup:

- HTTP base URL: `http://localhost:<PORT>` (when HOST is `0.0.0.0`)
- WebSocket endpoint: `ws://localhost:<PORT>/ws`

## REST API

Base URL: `http://localhost:8000` (default)

### Health/Root

`GET /`

Response:

```json
{ "message": "Welcome to Sportz Server!" }
```

### Matches

#### List matches

`GET /matches?limit=50`

- `limit` optional, integer, max 100 (default 50)
- Ordered by `createdAt` descending

Response:

```json
{
  "data": [
    {
      "id": 1,
      "sport": "football",
      "homeTeam": "Team A",
      "awayTeam": "Team B",
      "status": "scheduled",
      "startTime": "2026-02-27T14:00:00.000Z",
      "endTime": "2026-02-27T16:00:00.000Z",
      "homeScore": 0,
      "awayScore": 0,
      "createdAt": "2026-02-27T13:50:00.000Z"
    }
  ]
}
```

#### Create match

`POST /matches`

Body:

```json
{
  "sport": "football",
  "homeTeam": "Team A",
  "awayTeam": "Team B",
  "startTime": "2026-02-27T14:00:00+00:00",
  "endTime": "2026-02-27T16:00:00+00:00",
  "homeScore": 0,
  "awayScore": 0
}
```

Validation:

- `sport`, `homeTeam`, `awayTeam` non-empty
- `startTime`/`endTime` ISO datetime with offset
- `endTime` must be after `startTime`
- scores are optional, non-negative integers

Behavior:

- `status` is derived automatically using current time:
  - before start -> `scheduled`
  - during match -> `live`
  - after end -> `finished`
- Emits WS `match_update` event to all connected clients.

### Commentary

All commentary routes are nested under a match:

`/matches/:id/commentary`

#### List commentary

`GET /matches/:id/commentary?limit=100`

- `id` must be positive integer
- `limit` optional, max 100 (default 100)
- Ordered by `createdAt` descending

Response:

```json
{
  "data": [
    {
      "id": 1,
      "matchId": 1,
      "minute": 23,
      "sequence": 12,
      "period": "1H",
      "eventType": "goal",
      "actor": "Player X",
      "team": "Team A",
      "message": "Goal from inside the box",
      "metadata": { "assist": "Player Y" },
      "tags": ["goal", "open_play"],
      "createdAt": "2026-02-27T14:23:10.000Z"
    }
  ]
}
```

#### Create commentary

`POST /matches/:id/commentary`

Body:

```json
{
  "minute": 23,
  "sequence": 12,
  "period": "1H",
  "eventType": "goal",
  "actor": "Player X",
  "team": "Team A",
  "message": "Goal from inside the box",
  "metadata": { "assist": "Player Y" },
  "tags": ["goal", "open_play"]
}
```

Validation:

- All fields except `metadata` and `tags` are required.
- `minute` non-negative integer
- `sequence` integer
- text fields non-empty
- `metadata` is a string-keyed object
- `tags` is an array of strings

Behavior:

- Creates commentary row for provided match ID.
- Emits WS `commentary_update` event only to subscribers of that match ID.

## WebSocket API

Endpoint:

`ws://localhost:8000/ws`

### Connection Lifecycle

- On successful connection, server sends:

```json
{ "type": "welcome" }
```

### Client -> Server messages

Subscribe to match commentary:

```json
{ "type": "subscribe", "matchId": 1 }
```

Unsubscribe:

```json
{ "type": "unsubscribe", "matchId": 1 }
```

### Server -> Client messages

Subscribe ack:

```json
{ "type": "subscribed", "matchId": "1" }
```

Unsubscribe ack:

```json
{ "type": "unsubscribed", "matchId": "1" }
```

Match broadcast (all clients):

```json
{ "type": "match_update", "data": { "...": "matchRow" } }
```

Commentary broadcast (match subscribers only):

```json
{ "type": "commentary_update", "data": { "...": "commentaryRow" } }
```

Error examples:

```json
{ "type": "error", "message": "Invalid JSON" }
```

```json
{ "type": "error", "message": "Invalid matchId" }
```

```json
{ "type": "error", "message": "Unknown message type" }
```

### WS Rate Limiting / Security

On denied WS connection:

- `1013` close code when rate limited
- `1008` close code for policy violation
- `1011` close code on internal Arcjet protection error

## Arcjet Security

Configured in `src/arcjet.js`.

HTTP and WS both use:

- `shield(...)`
- `detectBot(...)` with allowed bot categories:
  - `CATEGORY:SEARCH_ENGINE`
  - `CATEGORY:PREVIEW`

Rate limiting:

- HTTP: sliding window 50 requests / 10 seconds
- WS: sliding window 5 connections / 2 seconds

HTTP denial behavior:

- 429 when rate-limited
- 403 when forbidden
- 500 on Arcjet middleware error

## Database Schema (PostgreSQL)

### Enum: `match_status`

- `scheduled`
- `live`
- `finished`

### Table: `matches`

- `id` (serial, PK)
- `sport` (varchar 100, not null)
- `home_team` (varchar 255, not null)
- `away_team` (varchar 255, not null)
- `status` (`match_status`, default `scheduled`)
- `start_time` (timestamp)
- `end_time` (timestamp)
- `home_score` (int, default 0)
- `away_score` (int, default 0)
- `created_at` (timestamp, default `now()`)

### Table: `commentary`

- `id` (serial, PK)
- `match_id` (int, FK -> `matches.id`, not null)
- `minute` (int)
- `sequence` (int)
- `period` (varchar 50)
- `event_type` (varchar 100)
- `actor` (varchar 255)
- `team` (varchar 100)
- `message` (text)
- `metadata` (jsonb)
- `tags` (jsonb)
- `created_at` (timestamp, default `now()`)

## Drizzle Commands

- Generate migration: `npm run db:generate`
- Apply migration: `npm run db:migrate`
- Open studio: `npm run db:studio`

Drizzle config is in `drizzle.config.js`, and migration SQL is under `drizzle/`.

## Site24x7 / APM Insight

This project initializes APM Insight at startup:

```js
import AgentAPI from "apminsight";
AgentAPI.config();
```

Relevant files:

- `apminsightnode.json` - APM Insight agent configuration
- `apminsightdata/` - generated runtime data/status by the agent

Important:

- Treat `apminsightnode.json` credentials as secrets.
- Do not commit real license keys in public repositories.
- Rotate exposed credentials immediately if leaked.

## Error Handling Summary

- Validation errors -> `400`
- Arcjet blocked request -> `403` or `429`
- Internal failures (DB/middleware/etc.) -> `500`

## Example cURL

Create match:

```bash
curl -X POST http://localhost:8000/matches \
  -H "Content-Type: application/json" \
  -d '{
    "sport":"football",
    "homeTeam":"Team A",
    "awayTeam":"Team B",
    "startTime":"2026-02-27T14:00:00+00:00",
    "endTime":"2026-02-27T16:00:00+00:00"
  }'
```

Create commentary:

```bash
curl -X POST http://localhost:8000/matches/1/commentary \
  -H "Content-Type: application/json" \
  -d '{
    "minute":10,
    "sequence":1,
    "period":"1H",
    "eventType":"kickoff",
    "actor":"Referee",
    "team":"N/A",
    "message":"Match has started"
  }'
```

## Known Gaps / Future Improvements

- Add auth and role-based access controls.
- Add endpoint(s) to update scores and match status post-creation.
- Add pagination/cursor-based APIs for large commentary streams.
- Add test coverage (unit + integration + WS behavior tests).
- Add OpenAPI/Swagger docs and contract testing.

## License

ISC
