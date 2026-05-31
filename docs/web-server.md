# Web Server

> Running the browser UI with `meadow-migration serve`, and the REST API behind it.

The web interface is launched by the `serve` command. It scans a directory of MicroDDL model files, imports and compiles them, and starts an [Orator](https://fable-retold.github.io/orator/) HTTP server that exposes a JSON API and a single-page browser UI. The UI is a self-contained static HTML page that talks to the API; it loads Pict and [pict-section-flow](https://fable-retold.github.io/pict-section-flow/) from the server for the interactive schema diagram.

## Starting the Server

```bash
meadow-migration serve [model-path] [-p <port>]
```

**Alias:** `s`

| Argument / Option | Description | Default |
|---|---|---|
| `model-path` | Directory of `.mddl` / `.ddl` files to serve | the `ModelPath` config value, then the current directory |
| `-p, --port <port>` | Port to listen on | a random port in the range 7000-7999 |

The command resolves the model directory (CLI argument > `ModelPath` configuration > current directory), confirms it exists and is a directory, and then:

1. Scans the directory **non-recursively** for files ending in `.mddl` or `.ddl`.
2. Imports each file into the schema library.
3. Compiles each imported schema, compiling from the file path so `[Include ...]` directives resolve. Schemas that fail to compile are logged and skipped; the server still starts.
4. Loads any connections from the configuration cascade.
5. Starts the Orator server and serves the UI at `/`.

The process runs in the foreground (the Orator listener keeps the event loop alive) until you press Ctrl+C.

```bash
meadow-migration serve ./model -p 8080
```

```
==========================================================
  Meadow Migration Manager on http://localhost:8080
==========================================================
  Model Path: /abs/path/to/model
  Schemas:    3
==========================================================

  Press Ctrl+C to stop.
```

## Prerequisites

- Node.js with `meadow-migrationmanager` and its dependencies installed.
- A directory containing at least one `.mddl` or `.ddl` file (an empty directory is allowed -- the UI will report that no schemas are loaded).
- For live-database features (connection test, introspect, database-to-schema diff), the connector package for the database type. All four connectors ship as dependencies, so MySQL, PostgreSQL, MSSQL, and SQLite all work.

## The Browser UI

The UI is a single page (`source/web/index.html`) with a fixed sidebar and a content area. The sidebar has seven navigation items, each rendered client-side by fetching from the API.

| Nav item | Purpose |
|---|---|
| **Schema Library** | Table of all schemas with compile status, table count, and last-compiled time. Per-row actions: Compile, Edit DDL, Visualize. Clicking a name opens a detail view with the DDL and compiled JSON. |
| **DDL Editor** | A [CodeJar](https://fable-retold.github.io/) editor with MicroDDL syntax highlighting and line numbers. For multi-file schemas a hierarchical file dropdown shows the include chain; dirty files are marked. Save writes back to the source file; Save & Compile saves all dirty files then recompiles. |
| **Schema Visualizer** | Tabbed view of the compiled schema: an interactive flow diagram plus ASCII diagram, table list, relationship map, and per-table details. |
| **Meadow Config** | The generated Meadow package JSON for the selected schema, one block per table. Requires the schema to be compiled. |
| **Connections** | List, add, test, introspect, and delete database connections. Connections are stored in the browser's `localStorage` (so passwords persist locally) and mirrored to the server so test/introspect work. |
| **Schema Diff** | Pick a source and a target -- each independently a DDL schema or a live database -- run the diff, and view the result as JSON. A button generates a migration script from the diff. |
| **Migration Script** | Pick source and target (schema or database) plus a dialect, and generate a migration script in one step (diff then generate). |

### Schema Visualizer tabs

The Visualizer renders the compiled schema five ways:

- **Flow Diagram** -- an interactive pict-section-flow graph. Each table is a node; foreign key columns get output ports on the right, referenced primary keys get input ports on the left, and connections are drawn between them. The toolbar supports pan, zoom, and node dragging. Two checkboxes filter visual noise: **Hide audit trail connections** (the `CreatingIDUser` / `UpdatingIDUser` / `DeletingIDUser` columns) and **Hide customer joins** (the `IDCustomer` column). Double-clicking a node opens a properties panel listing all columns with `PK` / `FK` badges.
- **ASCII Diagram** -- a text box diagram of all tables.
- **Table List** -- tables with column counts.
- **Relationships** -- foreign key relationships in text form.
- **Table Details** -- a per-table column listing.

### Connections in the browser

The Connections view keeps connections in `localStorage` under the key `meadow-migration-connections` as the primary store (this preserves passwords, which the server's connection list deliberately omits). On load it also fetches `/api/connections` and merges in any connections added via the CLI or configuration file. Saving a connection writes it to `localStorage` and POSTs it to the server; deleting removes it from both.

## REST API

The server registers the routes below. When a `RoutePrefix` is configured (used when the manager is embedded behind a path), every route is prefixed and the served HTML is rewritten to use the prefix. Successful responses are JSON objects with `Success: true`; errors return an appropriate HTTP status with `{ Success: false, Error: '...' }`.

### Static assets

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | The web UI HTML page |
| `GET` | `/lib/codejar.js` | CodeJar editor (served as a global) |
| `GET` | `/lib/pict.min.js` | Pict browser bundle |
| `GET` | `/lib/pict-section-flow.min.js` | pict-section-flow browser bundle |

### Schema routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/schemas` | List schemas with compile status, table count, and whether each has a source file |
| `GET` | `/api/schemas/:name` | Full schema detail: DDL, compiled schema, Meadow packages |
| `GET` | `/api/schemas/:name/ddl` | Raw DDL text |
| `PUT` | `/api/schemas/:name/ddl` | Replace the DDL text (clears compiled state; creates the entry if missing; writes back to the source file when one exists) |
| `GET` | `/api/schemas/:name/files` | List the main file and all `[Include ...]` files with byte/line/table counts and include ancestry |
| `GET` | `/api/schemas/:name/file/:filepath` | Read one child file by relative path (constrained to the model directory) |
| `PUT` | `/api/schemas/:name/file/:filepath` | Write one child file (clears compiled state) |
| `POST` | `/api/schemas/:name/compile` | Compile the schema (from the source file when known, re-reading it first) |
| `GET` | `/api/schemas/:name/visualize` | Table list, ASCII diagram, relationship map, per-table details, and flow data |
| `GET` | `/api/schemas/:name/meadow-packages` | Generated Meadow package JSON |

### Connection and provider routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/providers` | List the installed database provider types |
| `GET` | `/api/connections` | List saved connections (password omitted) |
| `POST` | `/api/connections` | Add a connection (`{ Name, Type, Config }`) |
| `DELETE` | `/api/connections/:name` | Remove a saved connection |
| `POST` | `/api/connections/:name/test` | Test a saved connection by listing its tables |
| `POST` | `/api/connections/test` | Test an unsaved connection (`{ Type, Config }`) |
| `POST` | `/api/connections/:name/introspect` | Introspect a saved connection; with `{ saveAs }` in the body, save the result to the schema library |

### Diff and migration routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/schemas/diff` | Diff two sides; each side is `source`/`target` (a schema name) **or** `sourceConnection`/`targetConnection` (a connection to introspect). Supports schema↔schema, schema↔database, and database↔database. |
| `POST` | `/api/schemas/generate-migration` | Generate a migration script from a diff: `{ diff, databaseType }` (databaseType defaults to `MySQL`) |

### Example requests

```bash
# List schemas
curl http://localhost:8080/api/schemas

# Compile a schema
curl -X POST http://localhost:8080/api/schemas/bookstore/compile

# Diff two schemas
curl -X POST http://localhost:8080/api/schemas/diff \
	-H 'Content-Type: application/json' \
	-d '{ "source": "bookstore", "target": "bookstore-v2" }'

# Diff a live database against a schema, then generate the SQL
curl -X POST http://localhost:8080/api/schemas/diff \
	-H 'Content-Type: application/json' \
	-d '{ "sourceConnection": "local-mysql", "target": "bookstore-v2" }'
```

## Security Notes

- The server binds to `localhost` and is intended for local development and review, not as a public service. There is no authentication.
- File read/write routes confine resolved paths to the model directory to prevent traversal.
- The server's connection list omits passwords; the browser stores them in `localStorage`. Treat a running instance as a local tool with access to whatever databases its connections point at.

## See Also

- [CLI Reference](cli-reference.md) -- the `serve` command among all others
- [Migration Authoring](migration-authoring.md) -- authoring the model files the server serves
- [Architecture](architecture.md) -- services, flow data, and FlowCard node types
- [API Reference](api-reference.md) -- the services the API routes call
