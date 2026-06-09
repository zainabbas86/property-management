# Property Management — Monolith → Microservices Demo

A demo project walking through the strangler-fig pattern: progressively extracting
services from a Laravel monolith into independent Node.js microservices, all behind
an API Gateway, with RabbitMQ as the event bus.

## Current migration state

| Service | Stack | Port | Status |
|---|---|---|---|
| API Gateway | Node.js · Express | 80 | ✅ Running |
| Auth Service | Node.js · TypeScript | 3001 | ✅ Extracted |
| User Service | Node.js · TypeScript · PostgreSQL | 3002 | ✅ Extracted |
| Laravel Backend | PHP 8.4 · MySQL | 8000 | ⬜ Shrinking (Properties + Contracts remain) |
| Property Service | Node.js · TypeScript | 3003 | ⬜ Planned |
| Contract Service | Node.js · TypeScript | 3004 | ⬜ Planned |

## Project layout

```
property-management/
├── docker-compose.yml
├── api-gateway/                          # Node.js · Express proxy · port 80
├── auth-service/                         # Node.js · TS · JWT (HS256) · port 3001
├── user-service/                         # Node.js · TS · PostgreSQL · RabbitMQ · port 3002
├── laravel-backend/                      # PHP 8.4 · MySQL · Properties + Contracts
├── property-management-frontend/         # React + Vite · port 5173
└── Docs/
    ├── monolith-architecture.md          # Baseline: full monolith
    ├── monolith-architecture.svg
    ├── transitional-monolith-to-microservice.md   # Current state (this doc's moment in time)
    ├── current-architecture.svg          # Current running architecture
    ├── complete-microservice.svg         # Target: all services extracted
    └── auth-comparison.svg
```

## Architecture diagrams

| Diagram | Description |
|---|---|
| [Monolith baseline](Docs/monolith-architecture.svg) | Before any extraction — single Laravel app |
| [Current state](Docs/current-architecture.svg) | Auth + User extracted, Laravel still owns Properties/Contracts |
| [Target state](Docs/complete-microservice.svg) | All four domains as independent services |

## Running locally

No local PHP, Composer, Node, or npm required — everything runs in containers.

```bash
docker compose up -d --build
```

First run builds all images (a few minutes). Subsequent runs are fast.

## Services and ports

| Service | URL | Notes |
|---|---|---|
| `frontend` | http://localhost:5173 | React + Vite (hot reload) |
| `api-gateway` | http://localhost | Single entry point for all API calls |
| `auth-service` | http://localhost/auth | login · register · me |
| `user-service` | http://localhost/users | User CRUD (internal: :3002 directly) |
| `backend` | http://localhost/api | Properties + Contracts (via gateway) |
| `phpmyadmin` | http://localhost:8080 | MySQL admin (user: `laravel` / `secret`) |
| `rabbitmq` | http://localhost:15672 | RabbitMQ management UI (`guest` / `guest`) |
| `postgres` | localhost:5432 | PostgreSQL — `user_service` DB |
| `db` | localhost:3306 | MySQL — `property_management` DB |

## Running commands in containers

```bash
# Artisan
docker compose exec backend php artisan migrate
docker compose exec backend php artisan make:model Property -mcr

# Bulk-migrate existing MySQL users into User Service (PostgreSQL)
docker compose exec backend php artisan users:migrate-to-queue

# Start the RabbitMQ event consumer (syncs user.created → MySQL)
docker compose exec backend php artisan users:consume-events

# Composer
docker compose exec backend composer require some/package

# npm (frontend)
docker compose exec frontend npm install axios
```

## Request routing

All browser traffic goes through the API Gateway on port 80:

```
/auth/**        →  Auth Service   :3001
/users/**       →  User Service   :3002
/api/**         →  Laravel        :8000
```

Auth Service calls User Service directly via HTTP (internal network, bypasses gateway).

## Event flow

New user registration fires a `user.created` event on the `app.events` RabbitMQ
topic exchange. Laravel's `users:consume-events` command subscribes via the
`laravel.user-events` queue and syncs the user into MySQL so foreign key
integrity is maintained for Properties and Contracts.

Bulk migration (artisan command above) uses a separate `users.migration` direct
queue — no `user.created` events are fired during migration.

## Logs

```bash
docker compose logs -f api-gateway
docker compose logs -f auth-service
docker compose logs -f user-service
docker compose logs -f backend
```

## Stop everything

```bash
docker compose down
# add -v to also wipe all database volumes
```
