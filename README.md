# Meadow Migration Manager

> **[Read the Meadow-Migrationmanager Documentation](https://fable-retold.github.io/meadow-migrationmanager/)** - interactive docs with the full API reference.

> Database schema migration management for the Meadow ecosystem

Meadow Migration Manager is a CLI, Web, and Console UI tool for managing database schemas and migrations. Built on the Fable/Pict service architecture, it provides a complete pipeline from MicroDDL schema definition through compilation, diffing, SQL migration generation, and live database deployment. Interactive visualization is powered by pict-section-flow with field-level foreign key relationship mapping.

## Features

- **Schema Library Management** -- add, remove, import, export and persist DDL schemas with compilation tracking
- **Connection Library** -- manage database connection configurations across MySQL, PostgreSQL, MSSQL and SQLite
- **DDL Compilation** -- compile MicroDDL via Stricture to structured schema objects with automatic Meadow package generation
- **Schema Diff** -- detect added, removed and modified tables, columns, indices and foreign keys between any two schemas
- **Migration SQL Generation** -- produce database-specific DDL for MySQL, PostgreSQL, MSSQL and SQLite from diff results
- **Live Database Introspection** -- discover schema from a running database via pluggable provider architecture
- **Interactive Flow Visualization** -- pict-section-flow diagrams with table nodes, column-level ports and FK connection edges
- **Three Interfaces** -- 11-command CLI, blessed-based Terminal UI, and Pict web views with flow diagrams

## Installation

```bash
npm install meadow-migrationmanager
```

For global CLI access:

```bash
npm install -g meadow-migrationmanager
```

## Quick Start

### Programmatic

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

### CLI

```bash
# Add a schema from a DDL file
meadow-migration add-schema bookstore ./bookstore.ddl

# Compile it
meadow-migration compile bookstore

# Add a second version and diff
meadow-migration add-schema bookstore-v2 ./bookstore-v2.ddl
meadow-migration compile bookstore-v2
meadow-migration diff bookstore bookstore-v2

# Generate a MySQL migration script
meadow-migration generate-script bookstore bookstore-v2 -t MySQL
```

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
| `deploy <schema> <connection>` | `dep` | Deploy a compiled schema to a database |
| `migrate <schema> <connection>` | `m` | Execute a migration on a database |
| `tui` | `ui` | Launch the interactive Terminal UI |

## Testing

```bash
npm test
```

## Documentation

Detailed documentation is available in the `docs/` folder.

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

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/stevenvelozo/retold/blob/main/docs/contributing.md).
