# Property Management — Monolith → Microservices Demo

A demo project showing the evolution from a Laravel monolith to a microservices architecture, with a React frontend.

## Project layout

```
property-management/
├── docker-compose.yml
├── laravel-backend/                  # Laravel REST API (PHP 8.4, MySQL)
└── property-management-frontend/     # React app (Vite)
```

## Running locally with Docker

No local PHP, Composer, Node, or npm is required — everything runs in containers.

### Start everything

```
docker compose up -d
```

First run will build the images (this can take a few minutes). Subsequent runs are fast.

### Services

| Service      | URL                          | Notes                                            |
|--------------|------------------------------|--------------------------------------------------|
| `backend`    | http://localhost:8000        | Laravel API (`php artisan serve`)                |
| `frontend`   | http://localhost:5173        | React + Vite dev server (hot reload)             |
| `db`         | localhost:3306               | MySQL 8.0 — database `property_management`       |
| `phpmyadmin` | http://localhost:8080        | DB admin UI (login with `laravel` / `secret`)    |

### Stop everything

```
docker compose down
```

Add `-v` to also remove the database volume (wipes all data).

## Running commands inside the containers

Since there's no local PHP/Composer/Node, run all tooling through `docker compose exec`:

```
# Laravel artisan commands
docker compose exec backend php artisan migrate
docker compose exec backend php artisan make:model Property -mcr

# Composer
docker compose exec backend composer require laravel/sanctum

# npm
docker compose exec frontend npm install axios
docker compose exec frontend npm run build
```

## Logs

```
docker compose logs -f backend
docker compose logs -f frontend
```
