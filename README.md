# ICYEREKEZO OMS

ICYEREKEZO OMS is a bilingual, multi-tenant factory Operations Management System. It combines internal factory operations with online customer ordering while keeping every factory's information strictly separated.

## Technology

- Laravel 13 modular monolith
- React 19 with TypeScript
- Tailwind CSS 4
- MySQL for production data
- Laravel queues, cache, events, and broadcasting for asynchronous and real-time work

The local development environment initially uses SQLite so the application runs before MySQL is installed. `.env.example` is prepared for MySQL.

## Architecture principles

1. Every operational record belongs to a factory tenant.
2. Inventory uses an immutable stock transaction ledger; balances are derived and transaction-safe.
3. Production flows are configurable templates, not hard-coded industry processes.
4. Sensitive state changes use permissions, approvals, audit logs, and reversals.
5. English and French are first-class languages from the beginning.
6. Modules communicate through application services and domain events, keeping the code maintainable while remaining a modular monolith.

## Delivery roadmap

### Phase 1 — Foundation

- Application shell and bilingual design system
- Authentication, factory registration, tenant context, roles and permissions
- Audit logging and security baseline

### Phase 2 — Factory setup and inventory

- Branches, departments, warehouses, units and conversions
- Items, categories, batches, locations and immutable stock ledger
- Suppliers and procurement

### Phase 3 — Manufacturing core

- Bills of materials and versions
- Configurable workflow templates and stages
- Production planning, orders, material issues, output, waste and rework
- Quality inspections and traceability

### Phase 4 — Commerce and fulfillment

- Customer catalogue and custom manufacturing requests
- Quotations, orders, invoices and payments
- Packing, shipments, delivery and proof of delivery

### Phase 5 — Intelligence and hardening

- Real-time dashboards and notifications
- PDF/Excel reporting and background jobs
- Performance, penetration, backup and recovery testing

## Current milestone

The Laravel/React/TypeScript foundation and first responsive operations dashboard are complete. The dashboard includes English/French switching, theme switching, responsive navigation, operational KPIs, production output, activity, and active production orders.

## Local development

```bash
composer install
npm install
composer run dev
```

Open `http://localhost:8000`.
