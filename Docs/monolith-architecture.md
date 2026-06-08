# Current Architecture — Laravel Monolith

This is a snapshot of the system as it exists today: a single Laravel application
that owns all three domains (User, Property, Contract), backed by one MySQL
database, with a separate React SPA talking to it over a REST API.

## Deployment view (Docker Compose)

```mermaid
flowchart LR
    Browser["Browser"]

    subgraph Docker["Docker Compose network"]
        Frontend["frontend\nReact + Vite\n:5173"]
        Backend["backend\nLaravel API (PHP 8.4)\n:8000"]
        DB[("db\nMySQL 8.0\n:3306")]
        PMA["phpmyadmin\n:8080"]
    end

    Browser -- "HTTP :5173" --> Frontend
    Browser -- "HTTP :8000 (REST + Bearer token)" --> Backend
    Frontend -- "Axios / REST (Bearer token)" --> Backend
    Backend -- "Eloquent / SQL" --> DB
    PMA -- "DB admin UI" --> DB
```

## Inside the monolith

Everything — auth, properties, and contracts — lives in one Laravel codebase
and shares one database. There are no service boundaries yet; modules are
just folders/namespaces within the same app.

```mermaid
flowchart TB
    subgraph Laravel["Laravel monolith (single codebase, single DB)"]
        direction TB

        subgraph AuthMod["Auth"]
            AuthController["AuthController\nregister / login / logout / me"]
            Sanctum["Laravel Sanctum\n(opaque Bearer tokens)"]
        end

        subgraph PropertyMod["Property"]
            PropertyController["PropertyController\nCRUD, scoped to owner"]
        end

        subgraph ContractMod["Contract"]
            ContractController["ContractController\nnested under /properties/{id}/contract"]
        end

        AuthController --> Sanctum
    end

    MySQL[("MySQL\nusers, properties, contracts,\npersonal_access_tokens")]

    AuthController --> MySQL
    PropertyController --> MySQL
    ContractController --> MySQL
```

## Domain model (entity relationships)

```mermaid
erDiagram
    USER ||--o{ PROPERTY : owns
    PROPERTY ||--o| CONTRACT : "has at most one"

    USER {
        bigint id PK
        string name
        string email
        string password
    }
    PROPERTY {
        bigint id PK
        bigint user_id FK
        string name
        string address
        string type
        text description
    }
    CONTRACT {
        bigint id PK
        bigint property_id FK "unique — enforces 1:1"
        string tenant_name
        date start_date
        date end_date
        decimal rent_amount
        string status
    }
```

## Request flow: authenticated property fetch

```mermaid
sequenceDiagram
    participant U as Browser (React)
    participant A as Laravel API
    participant D as MySQL

    U->>A: POST /api/login {email, password}
    A->>D: SELECT user WHERE email = ?
    D-->>A: user row
    A->>D: INSERT personal_access_tokens
    A-->>U: { user, token }

    U->>A: GET /api/properties (Authorization: Bearer <token>)
    A->>D: lookup token in personal_access_tokens
    A->>D: SELECT properties WHERE user_id = ? (with contract)
    D-->>A: rows
    A-->>U: JSON list of properties + nested contracts
```

## Notes on this stage

- **Single deployable unit** — frontend is separate, but Auth, Property, and
  Contract are one Laravel app sharing one database and one auth mechanism
  (Sanctum's DB-backed Bearer tokens).
- **Authorization is enforced in controllers** — every Property/Contract
  endpoint checks `property.user_id === authenticated user.id`; no cross-user
  access is possible via the API.
- **This is the baseline for the migration** — the planned first extraction is
  the User/Auth module into its own Node service (see migration notes for how
  JWT, event-driven sync, and service-to-service auth come into play once that
  split begins).
