# Architecture

## Overview

Meadow Migration Manager extends Pict (which extends Fable) and registers all service types on construction. This gives every service access to the Fable dependency injection container, logging, configuration and shared application state through `this.fable.AppData.MigrationManager`.

The module follows the Fable service provider pattern: each capability is implemented as a standalone service that extends `fable-serviceproviderbase`, is registered via `addServiceType()`, and is instantiated on demand via `instantiateServiceProvider()`.

## Service Architecture

```mermaid
graph TB
    subgraph MeadowMigrationManager["MeadowMigrationManager (extends Pict)"]
        direction TB
        subgraph core["Core Data"]
            SL["SchemaLibrary"]
            CL["ConnectionLibrary"]
        end
        subgraph compile["Compilation"]
            SA["StrictureAdapter"]
            MPG["MeadowPackageGenerator"]
        end
        subgraph diffmig["Diff & Migration"]
            SD["SchemaDiff"]
            MG["MigrationGenerator"]
        end
        subgraph dbops["Database Operations"]
            SI["SchemaIntrospector"]
            SDep["SchemaDeployer"]
        end
        subgraph viz["Visualization"]
            SV["SchemaVisualizer"]
            FDB["FlowDataBuilder"]
        end
    end

    DDL["MicroDDL Files"] --> SL
    SL --> SA
    SA --> SD
    SA --> MPG
    SA --> SV
    SA --> FDB
    SD --> MG
    SD --> FDB
    SI --> SD
    CL --> SI
    CL --> SDep
    SDep --> DB[("Database")]
    SI --> DB
```

## Data Flow Pipeline

```mermaid
flowchart LR
    A["DDL Text\n(MicroDDL)"] --> B["compileDDL()"]
    B --> C["Compiled Schema\n{Tables: {...}}"]
    C --> D["diffSchemas()"]
    E["Introspected\nSchema"] --> D
    D --> F["Diff Result"]
    F --> G["generateMigrationScript()"]
    G --> H["SQL Migration\nScript"]
    C --> I["buildFlowData()"]
    I --> J["Flow Diagram\n(Nodes + Connections)"]
    F --> K["buildDiffFlowData()"]
    K --> L["Color-coded\nFlow Diagram"]
    C --> M["generateMeadowPackages()"]
    M --> N["Meadow Package\nJSON"]
    C --> O["deploySchema()"]
    O --> P[("Live Database")]
```

## Service Categories

| Category | Services | Purpose |
|---|---|---|
| **Core Data** | SchemaLibrary, ConnectionLibrary | CRUD and persistence for schemas and database connections |
| **Compilation** | StrictureAdapter, MeadowPackageGenerator | DDL compilation and Meadow ORM package generation |
| **Diff & Migration** | SchemaDiff, MigrationGenerator | Schema comparison and database-specific SQL generation |
| **Database Operations** | SchemaIntrospector, SchemaDeployer, DatabaseProviderFactory | Live database discovery, deployment, and connected `meadow-connection-*` provider creation |
| **Visualization** | SchemaVisualizer, FlowDataBuilder | ASCII diagrams and interactive pict-section-flow graphs |

`DatabaseProviderFactory` is the bridge between generic connection configs and the four `meadow-connection-*` connector packages; the CLI live-database commands and the web API both go through it. See the [API Reference](api-reference.md).

## Application State

All services share state through `AppData.MigrationManager`:

```javascript
{
	Schemas: {},                    // Hash of schema entries by name
	Connections: {},                // Hash of connection entries by name
	ActiveSchemaName: null,         // Currently selected schema
	ActiveConnectionName: null,     // Currently selected connection
	DiffResult: null,               // Latest schema comparison result
	MigrationScript: null,          // Latest generated SQL script
	IntrospectionResult: null       // Latest introspection result
}
```

### Schema Entry

```javascript
{
	Name: 'bookstore',
	DDL: '!Book\n@IDBook\n$Title 200\n...',
	CompiledSchema: null,           // Populated by StrictureAdapter.compileDDL()
	MeadowPackages: null,           // Populated by compileAndGenerate()
	LastCompiled: null              // ISO 8601 timestamp
}
```

### Connection Entry

```javascript
{
	Name: 'local-mysql',
	Type: 'MySQL',                  // MySQL | PostgreSQL | MSSQL | SQLite
	Config: {
		server: '127.0.0.1',
		port: 3306,
		user: 'root',
		password: '...',
		database: 'bookstore'
	}
}
```

## Supported Database Engines

| Engine | Identifier Quoting | ID Column Type | String Type |
|---|---|---|---|
| MySQL | `` `backticks` `` | `INT UNSIGNED NOT NULL AUTO_INCREMENT` | `VARCHAR(n)` |
| PostgreSQL | `"double quotes"` | `SERIAL` | `VARCHAR(n)` |
| MSSQL | `[brackets]` | `INT IDENTITY(1,1)` | `NVARCHAR(n)` |
| SQLite | `"double quotes"` | `INTEGER PRIMARY KEY AUTOINCREMENT` | `TEXT` |

## UI Architecture

### CLI Layer

The CLI is built on `pict-service-commandlineutility` (Commander.js wrapper). Each command is a self-contained service class. The CLI supports cascading configuration from default settings, home folder, and current working directory.

### Terminal UI Layer

The TUI uses `pict-application` with `pict-terminalui` and `blessed` for terminal rendering. Layout has four regions: header bar, sidebar list (20% width), content area (80% width), and status bar. Nine sidebar items navigate between views.

### Web UI Layer

The `serve` command starts an [Orator](https://fable-retold.github.io/orator/) HTTP server (`MigrationManager-Server-Setup.js`) that scans a model directory, imports and compiles the `.mddl` / `.ddl` files, and exposes a JSON REST API plus a single self-contained HTML page (`source/web/index.html`). The page is a vanilla-JS client that calls the API and loads Pict and `pict-section-flow` from the server to render the interactive schema diagram with FlowCard node types. See the [Web Server](web-server.md) page for the routes and UI.

> The repository also contains a set of `pict-view` classes under `source/views/` (Layout, SchemaLibrary, SchemaVisualizer, SchemaMigrator, and so on). These are an alternate, embeddable view layer; the shipped `serve` command renders the static HTML client described above rather than these view classes.

## FlowCard Types

| Type Code | Color | Hex | Usage |
|---|---|---|---|
| `TABLE` | Dark blue-gray | `#2c3e50` | Default table node |
| `TABLE_ADDED` | Green | `#27ae60` | Table added in diff |
| `TABLE_REMOVED` | Red | `#c0392b` | Table removed in diff |
| `TABLE_MODIFIED` | Orange | `#e67e22` | Table modified in diff |

Each table node has:
- **Output ports** (right side) for FK columns pointing to other tables
- **Input ports** (left side) for PK columns referenced by other tables' FKs
- **Connections** drawn from FK output ports to referenced PK input ports
