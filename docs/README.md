# Meadow Migration Manager

> Database schema migration management for the Meadow ecosystem

## Introduction

Meadow Migration Manager is a comprehensive tool for managing database schemas and migrations within the Retold ecosystem. It bridges the gap between MicroDDL schema definitions written in Stricture and the live database instances that applications depend on. Whether you need to compile a schema, compare two versions, generate migration SQL, or deploy changes to a running database, Meadow Migration Manager provides a unified pipeline for every step.

The module is built on the Fable/Pict service architecture. It extends Pict directly, which means it inherits full access to Fable's dependency injection, configuration management, logging, and service provider infrastructure. Ten registered service types handle the core logic -- from SchemaLibrary and ConnectionLibrary for managing artifacts, through StrictureAdapter and SchemaDiff for compilation and comparison, to MigrationGenerator, SchemaDeployer, and SchemaIntrospector for database interaction. A FlowDataBuilder service and SchemaVisualizer service produce interactive pict-section-flow diagrams with table nodes, column-level ports, and foreign key connection edges.

Three user interfaces expose this functionality. A CLI built on pict-service-commandlineutility covers every workflow from the terminal. A blessed-based Terminal UI launched via the `tui` command provides an interactive dashboard with schema overview, connection management, DDL editing, visualization, deployment, and migration panels. A browser UI -- started with the `serve` command -- scans a directory of model files, compiles them, and renders interactive flow diagrams over a REST API.

## Features

- **Schema Library Management** -- add, remove, import, export and persist DDL schemas with compilation tracking
- **Connection Library** -- manage database connection configurations across MySQL, PostgreSQL, MSSQL and SQLite
- **DDL Compilation** -- compile MicroDDL via Stricture to structured schema objects with table, column, index and foreign key metadata
- **Meadow Package Generation** -- convert compiled DDL schemas to Meadow-compatible package JSON for use with the Meadow ORM
- **Schema Diff** -- detect added, removed and modified tables, columns, indices and foreign keys between any two compiled schemas
- **Migration SQL Generation** -- produce database-specific DDL statements for MySQL, PostgreSQL, MSSQL and SQLite from diff results
- **Live Database Introspection** -- discover schema from a running database via pluggable provider architecture, saving results as named schemas
- **Schema Deployment** -- deploy a compiled schema to a live database, creating tables, columns and indices
- **Migration Execution** -- apply generated migration scripts to live databases with connection validation
- **Schema Visualization** -- produce text-based schema summaries and visual representations
- **Interactive Flow Diagrams** -- pict-section-flow diagrams with table nodes, column-level ports and FK connection edges via FlowDataBuilder
- **Full-Featured CLI** -- command-line interface built on pict-service-commandlineutility with aliases for every command (see the [CLI Reference](cli-reference.md))
- **Blessed Terminal UI** -- interactive dashboard with panels for schema overview, connection management, DDL editing, visualization, deployment, migration, introspection, Meadow config viewing and script viewing
- **Browser UI + REST API** -- the `serve` command scans a model directory, compiles schemas, and serves a single-page UI (schema library, DDL editor, visualizer, Meadow config, connections, diff, migration script) over a JSON API
- **Cascading Configuration** -- automatic config file discovery from defaults, home directory and working directory
- **Pict/Fable Service Architecture** -- all services registered as proper Fable service types with dependency injection and logging

## Installation

Install as a project dependency:

```bash
npm install meadow-migrationmanager
```

For global CLI access from any directory:

```bash
npm install -g meadow-migrationmanager
```

## Quick Start -- Programmatic

```javascript
const MeadowMigrationManager = require('meadow-migrationmanager');

let tmpManager = new MeadowMigrationManager({});
let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');

// Add a schema from MicroDDL text
tmpSchemaLib.addSchema('bookstore', '!Book\n@IDBook\n$Title 200\n$Genre 128\n');

// Compile the DDL
let tmpStricture = tmpManager.instantiateServiceProvider('StrictureAdapter');
tmpStricture.compileDDL(tmpSchemaLib.getSchema('bookstore').DDL,
	(pError, pSchema) =>
	{
		console.log('Compiled tables:', Object.keys(pSchema.Tables));
	});
```

## Quick Start -- CLI

Start with a MicroDDL file describing your database schema, then walk through the full pipeline:

**Step 1: Add a schema from a DDL file**

```bash
meadow-migration add-schema bookstore ./bookstore.ddl
```

This reads the MicroDDL from `./bookstore.ddl` and stores it in the schema library under the name `bookstore`.

**Step 2: Compile the schema**

```bash
meadow-migration compile bookstore
```

Compiles the MicroDDL through Stricture, producing a structured schema object with table definitions, column metadata, indices and foreign key relationships. The compiled result is stored alongside the DDL in the schema library.

**Step 3: Add a second version of the schema**

```bash
meadow-migration add-schema bookstore-v2 ./bookstore-v2.ddl
meadow-migration compile bookstore-v2
```

Add an updated version of the DDL (with new tables, columns, or modifications) and compile it as well.

**Step 4: Diff the two schemas**

```bash
meadow-migration diff bookstore bookstore-v2
```

Compares the two compiled schemas and reports added tables, removed tables, added columns, removed columns, modified columns, added indices, removed indices, and foreign key changes.

**Step 5: Generate a migration script**

```bash
meadow-migration generate-script bookstore bookstore-v2 -t MySQL
```

Produces database-specific DDL statements (ALTER TABLE, CREATE TABLE, DROP TABLE, etc.) that will transform the source schema into the target schema. Use `-t` to specify the database type (`MySQL`, `PostgreSQL`, `MSSQL`, or `SQLite`) and `-o` to write the output to a file.

## CLI Commands

| Command | Alias | Description |
|---|---|---|
| `list-schemas` | `ls` | List all schemas in the library with compilation status |
| `add-schema <name> <file>` | `as` | Add a DDL schema from a file |
| `list-connections` | `lc` | List all database connections |
| `add-connection <name> [options]` | `ac` | Add a connection with type, server, port, user, password, database |
| `compile <schema>` | `c` | Compile a DDL schema via Stricture |
| `diff <source> <target>` | `d` | Compare two compiled schemas |
| `generate-script <source> <target>` | `gs` | Generate migration SQL (`-t` type, `-o` output file) |
| `introspect <connection>` | `i` | Discover schema from a live database (`-o` save name) |
| `deploy <schema> <connection>` | `dep` | Deploy a compiled schema to a database (not yet wired in the CLI) |
| `migrate <schema> <connection>` | `m` | Generate migration SQL against a live database (`-t` type) |
| `serve [model-path]` | `s` | Start the web server for a model directory (`-p` port) |
| `tui` | `ui` | Launch the interactive Terminal UI |

The CLI also adds an `explain-config` command automatically, which prints the resolved configuration cascade. See the [CLI Reference](cli-reference.md) for every command, argument, and flag.

## Configuration

Meadow Migration Manager uses cascading configuration files. Settings are merged in order, with later sources overriding earlier ones:

1. **Default settings** -- built into the CLI program
2. **Home directory config** -- `~/.meadow-migration-config.json`
3. **Working directory config** -- `./.meadow-migration-config.json`

This cascade allows you to set global preferences in your home directory (such as a default database type) while overriding them on a per-project basis in the working directory.

### Settings

| Setting | Default | Description |
|---|---|---|
| `SchemaLibraryFile` | `.meadow-migration-schemas.json` | Path to the file where the schema library is persisted |
| `ConnectionLibraryFile` | `.meadow-migration-connections.json` | Path to the file where connection configurations are persisted |

### Example Configuration File

```json
{
	"SchemaLibraryFile": ".meadow-migration-schemas.json",
	"ConnectionLibraryFile": ".meadow-migration-connections.json"
}
```

### Viewing Active Configuration

Use the built-in `explain-config` command to inspect the resolved configuration cascade. This shows which files were found, the order in which they were merged, and the final resolved values:

```bash
meadow-migration explain-config
```

## Learn More

- [Quick Start](quickstart.md) -- install to a generated migration in minutes
- [Architecture](architecture.md) -- service architecture, data flow and module design
- [CLI Guide](cli-guide.md) -- guided, example-driven command walkthrough
- [CLI Reference](cli-reference.md) -- exhaustive reference for every command and flag
- [Migration Authoring](migration-authoring.md) -- writing MicroDDL and running a migration
- [User Guide](user-guide.md) -- workflows for the CLI, Terminal UI and Web UI
- [Web Server](web-server.md) -- the `serve` command UI and REST API
- [API Reference](api-reference.md) -- programmatic API for every service type

## Related Packages

- [stricture](https://github.com/fable-retold/stricture) -- MicroDDL compiler and schema toolchain
- [meadow](https://github.com/fable-retold/meadow) -- data access library and ORM
- [foxhound](https://github.com/fable-retold/foxhound) -- query DSL for SQL generation
- [fable](https://github.com/fable-retold/fable) -- application services and dependency injection
- [pict](https://github.com/fable-retold/pict) -- view and application framework
- [pict-section-flow](https://github.com/fable-retold/pict-section-flow) -- interactive flow diagram visualization
- [pict-service-commandlineutility](https://github.com/fable-retold/pict-service-commandlineutility) -- CLI framework
- [pict-terminalui](https://github.com/fable-retold/pict-terminalui) -- terminal UI bridge

## License

MIT
