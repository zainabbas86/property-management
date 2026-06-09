# Transitional Architecture — Strangler-Fig in Progress

This document captures the system mid-migration: Auth and User domains have been
extracted into their own services, while Properties and Contracts still live in
the Laravel monolith. An API Gateway sits in front of everything.

## Deployment view (Docker Compose)

```mermaid
flowchart LR
    Browser["Browser"]

    subgraph Docker["Docker Compose network"]
        Frontend["frontend\nReact + Vite\n:5173"]
        Gateway["api-gateway\nNode.js · Express\n:80"]

        subgraph Extracted["Extracted microservices"]
            AuthSvc["auth-service\nNode.js · TS\n:3001"]
            UserSvc["user-service\nNode.js · TS\n:3002"]
            PG[("postgres\nPostgreSQL 16\n:5432")]
        end

        subgraph Monolith["Monolith (shrinking)"]
            Backend["backend\nLaravel · PHP 8.4\n:8000"]
            DB[("db\nMySQL 8.0\n:3306")]
            PMA["phpmyadmin\n:8080"]
        end

        MQ["rabbitmq\nRabbitMQ 3\n:5672"]
    end

    Browser -- "HTTP :5173" --> Frontend
    Browser -- "HTTP :80" --> Gateway
    Frontend -- "all API calls" --> Gateway
    Gateway -- "/auth/**" --> AuthSvc
    Gateway -- "/users/**" --> UserSvc
    Gateway -- "/api/**" --> Backend
    AuthSvc -- "HTTP (internal)" --> UserSvc
    UserSvc -- "pg / SQL" --> PG
    UserSvc -- "publish user.created" --> MQ
    Backend -- "Eloquent / SQL" --> DB
    Backend -- "consume user.created" --> MQ
    PMA --> DB
```

## Inside the extracted services

```mermaid
flowchart TB
    subgraph AuthSvc["Auth Service · :3001"]
        direction TB
        AR["POST /auth/register"]
        AL["POST /auth/login"]
        AM["GET /auth/me"]
        JWT["jwt.sign() · HS256 · 7d expiry"]
        AR --> JWT
        AL --> JWT
    end

    subgraph UserSvc["User Service · :3002"]
        direction TB
        UC["POST /users"]
        UE["GET /users/email/:email"]
        UID["GET /users/:id"]
        PUB["publishEvent(user.created)"]
        MC["migration consumer\nusers.migration queue"]
        UC --> PUB
    end

    AuthSvc -- "fetch() user by email\nor create user" --> UserSvc
    UserSvc -- "app.events exchange" --> RMQ["RabbitMQ"]
```

## Inside the monolith (unchanged domains)

```mermaid
flowchart TB
    subgraph Laravel["Laravel monolith — still owns Properties & Contracts"]
        direction TB

        subgraph PropMod["Property"]
            PC["PropertyController\nCRUD, scoped to owner"]
        end

        subgraph ConMod["Contract"]
            CC["ContractController\nnested under /properties/{id}/contract"]
        end

        VJ["VerifyJwt middleware\ndecodes HS256 token, finds user in MySQL"]
        Consumer["ConsumeUserEvents\nArtisan command\nsyncs user.created → MySQL"]
    end

    MySQL[("MySQL\nusers (shadow copy), properties, contracts")]
    RMQ2["RabbitMQ\nlaravel.user-events queue"]

    PC --> VJ
    CC --> VJ
    VJ --> MySQL
    PC --> MySQL
    CC --> MySQL
    Consumer -- "ACK + updateOrCreate" --> MySQL
    RMQ2 --> Consumer
```

## Event flow: new user registration

```mermaid
sequenceDiagram
    participant C  as Browser (React)
    participant GW as API Gateway :80
    participant AS as Auth Service :3001
    participant US as User Service :3002
    participant PG as PostgreSQL
    participant MQ as RabbitMQ
    participant LV as Laravel (consumer)
    participant MY as MySQL

    C->>GW: POST /auth/register {name, email, password}
    GW->>AS: POST /auth/register (proxied)
    AS->>US: POST /users {name, email, password}
    US->>PG: INSERT INTO users
    PG-->>US: {id, name, email}
    US->>MQ: publish user.created → app.events
    US-->>AS: {id, name, email}
    AS-->>C: { token: "eyJ…" }

    Note over MQ,MY: Async — happens in background
    MQ->>LV: deliver user.created event
    LV->>MY: INSERT/UPDATE users (password='*')
```

## Event flow: bulk migration (one-off)

```mermaid
sequenceDiagram
    participant DEV as Developer
    participant LV  as Laravel (artisan)
    participant MQ  as RabbitMQ
    participant US  as User Service
    participant PG  as PostgreSQL

    DEV->>LV: php artisan users:migrate-to-queue
    LV->>MQ: publish N messages → users.migration queue
    Note over LV: No user.created events — direct queue only
    MQ->>US: deliver each user row
    US->>PG: INSERT … ON CONFLICT DO NOTHING
    US->>PG: setval(sequence, max(id))
```

## Authentication: before vs. after

| Concern | Monolith (before) | Transitional (now) |
|---|---|---|
| Token type | Sanctum opaque Bearer token (DB-backed) | HS256 JWT (stateless) |
| User store | MySQL `users` table | PostgreSQL `users` table (canonical) |
| Login flow | Laravel reads MySQL directly | Auth Svc → User Svc → PostgreSQL |
| JWT verification | N/A — Sanctum middleware | `VerifyJwt` Artisan middleware decodes JWT |
| MySQL `users` | Canonical source of truth | Shadow copy (synced via `user.created` events, password `*`) |

## What has and hasn't changed for the frontend

The React app now points at `http://localhost` (port 80) instead of `:8000`.
All routes it previously called still work — the gateway proxies them
transparently. No changes to the React source were needed beyond the base URL.

## Key architectural decisions

- **No separate event-manager service** — RabbitMQ topic exchange `app.events`
  with routing key `entity.action` IS the event bus. Any service binds its own
  queue with a pattern filter.
- **Auth Service is stateless** — it has no database of its own. All persistence
  goes through User Service via synchronous HTTP.
- **Bulk migration fires no events** — the `users.migration` direct queue
  bypasses the `POST /users` route (which publishes events) so migrated users
  don't spam the event bus.
- **User IDs preserved** — MySQL IDs are kept intact in PostgreSQL so existing
  JWTs (`sub` claim) survive the migration without token invalidation.
- **http-proxy-middleware v2 quirk** — Express does NOT strip the mount prefix
  before the proxy sees `req.url`. Full path arrives at upstream intact — no
  `pathRewrite` needed.

## What's next (planned extractions)

| Service | Status |
|---|---|
| Auth Service | ✅ Extracted |
| User Service | ✅ Extracted |
| Properties Service | ⬜ Planned |
| Contracts Service | ⬜ Planned |
