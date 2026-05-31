# CLI Reference

> Exhaustive reference for every `meadow-migration` command, argument, and option, verified against the command source.

This page documents the complete command surface. For a guided, example-driven walkthrough, see the [CLI Guide](cli-guide.md). For authoring schemas, see [Migration Authoring](migration-authoring.md).

## Invocation

The binary is named `meadow-migration` (mapped from `source/MeadowMigrationManager-Run.js`).

```bash
# Global install
npm install -g meadow-migrationmanager
meadow-migration <command> [arguments] [options]

# Without a global install
npx meadow-migration <command> [arguments] [options]
```

The CLI is built on [pict-service-commandlineutility](https://fable-retold.github.io/pict-service-commandlineutility/) and extends Pict, so every Fable service is available to each command. Running `meadow-migration` with no command, or with `--help`, prints the auto-generated command list and usage.

## Command Summary

The program registers twelve commands. A thirteenth, `explain-config`, is added automatically because the program sets `AutoAddConfigurationExplanationCommand: true`.

| Command | Alias | Arguments | Summary |
|---|---|---|---|
| `list-schemas` | `ls` | (none) | List all schemas in the library with compile status |
| `add-schema` | `as` | `<name> <file>` | Import a DDL file into the schema library |
| `list-connections` | `lc` | (none) | List all saved database connections |
| `add-connection` | `ac` | `<name>` | Save a database connection configuration |
| `compile` | `c` | `<schema>` | Compile a library schema via Stricture |
| `introspect` | `i` | `<connection>` | Read the live schema from a database |
| `diff` | `d` | `<source> <target>` | Compare two schemas |
| `generate-script` | `gs` | `<source> <target>` | Generate migration SQL from a diff |
| `migrate` | `m` | `<schema> <connection>` | Generate migration SQL against a live database |
| `deploy` | `dep` | `<schema> <connection>` | Deploy a schema to a database (see status note) |
| `serve` | `s` | `[model-path]` | Start the web server for a model directory |
| `tui` | `ui` | (none) | Launch the Terminal UI |
| `explain-config` | (none) | (none) | Print the resolved configuration cascade |

> **Argument notation.** Internally every argument is declared as optional (the program validates required arguments at runtime and prints an error such as `Both <name> and <file> arguments are required.` when one is missing). This page shows the arguments the command expects in normal use.

## Configuration

The CLI gathers configuration from three sources, merged in order so later sources win:

1. **Built-in defaults** -- declared in the CLI program (`SchemaLibraryFile`, `ConnectionLibraryFile`, `ModelPath`)
2. **Home directory** -- `~/.meadow-migration-config.json`
3. **Working directory** -- `./.meadow-migration-config.json`

The configuration file name is `.meadow-migration-config.json` and `AutoGatherProgramConfiguration` is enabled, so the cascade is assembled automatically before any command runs.

### Settings

| Setting | Default | Used by |
|---|---|---|
| `SchemaLibraryFile` | `.meadow-migration-schemas.json` | All schema commands |
| `ConnectionLibraryFile` | `.meadow-migration-connections.json` | All connection commands |
| `ModelPath` | `''` (empty) | `serve` (fallback model directory) |
| `Connections` | (none) | Connection library (see below) |

### Defining connections in configuration

The connection library also reads a `Connections` hash from the configuration cascade. Each key is a connection name; file-loaded connections take precedence, so config connections only fill in names that are not already present.

```json
{
	"Connections":
	{
		"my-db":
		{
			"Type": "MySQL",
			"Config":
			{
				"server": "localhost",
				"port": 3306,
				"user": "root",
				"password": "secret",
				"database": "mydb"
			}
		}
	}
}
```

---

## list-schemas

List every schema in the library with its compile status.

```bash
meadow-migration list-schemas
```

**Alias:** `ls`

Loads the schema library file and prints each schema name with `(compiled <timestamp>)` or `(not compiled)`. When the library file cannot be loaded, it warns and suggests `add-schema`. When the library is empty, it prints `No schemas in library.`.

```
Schemas (2):
  bookstore  (compiled 2026-03-01T14:22:05.000Z)
  bookstore-v2  (not compiled)
```

---

## add-schema

Read a MicroDDL file from disk and store it in the schema library under a name.

```bash
meadow-migration add-schema <name> <file>
```

**Alias:** `as`

| Argument | Description |
|---|---|
| `name` | Unique name for the schema in the library |
| `file` | Path to the MicroDDL (`.ddl` / `.mddl`) file |

The DDL text is read and stored verbatim. The schema is **not** compiled on add -- run `compile` afterward. Both arguments are required.

```bash
meadow-migration add-schema bookstore ./bookstore.ddl
```

```
Schema [bookstore] added to library and saved to [.meadow-migration-schemas.json].
```

---

## list-connections

List every saved connection with its database type.

```bash
meadow-migration list-connections
```

**Alias:** `lc`

```
Connections (2):
  local-mysql  (MySQL)
  dev-sqlite  (SQLite)
```

When no connections exist, prints `No connections in library.` and suggests `add-connection`.

---

## add-connection

Save a database connection configuration to the connection library.

```bash
meadow-migration add-connection <name> [options]
```

**Alias:** `ac`

| Argument | Description |
|---|---|
| `name` | Unique name for the connection |

| Option | Description | Default |
|---|---|---|
| `-t, --type <type>` | Database type: `MySQL`, `PostgreSQL`, `MSSQL`, `SQLite` | `SQLite` |
| `-s, --server <host>` | Server hostname | `127.0.0.1` |
| `-p, --port <port>` | Server port | (empty) |
| `-u, --user <user>` | Database user | (empty) |
| `-w, --password <password>` | Database password | (empty) |
| `-d, --database <database>` | Database name (for SQLite, the file path) | (empty) |

The six options are stored under the connection's `Config` object as `server`, `port`, `user`, `password`, and `database`. For SQLite, set the file path with `-d`.

```bash
meadow-migration add-connection local-mysql -t MySQL -s 127.0.0.1 -p 3306 -u root -w secret -d bookstore
meadow-migration add-connection dev-sqlite -t SQLite -d ./dev.db
```

```
Connection [local-mysql] (MySQL) added and saved to [.meadow-migration-connections.json].
```

> **Password storage.** Passwords are saved in plain text in the connection library file. Keep that file out of version control (add it to `.gitignore`), or omit `-w` and supply credentials another way.

---

## compile

Compile a library schema's MicroDDL through Stricture and store the result.

```bash
meadow-migration compile <schema>
```

**Alias:** `c`

| Argument | Description |
|---|---|
| `schema` | Schema name from the library |

The schema must already exist in the library. Compilation produces a structured schema object (a `Tables` hash with column, index, and foreign key metadata) which is written back into the library entry along with a `LastCompiled` timestamp. Subsequent `diff` and `generate-script` runs reuse the stored compiled output.

```bash
meadow-migration compile bookstore
```

```
Schema [bookstore] compiled successfully.
Compiled schema saved to library [.meadow-migration-schemas.json].
```

> The CLI's `compile` command uses text-based compilation (`compileDDL`). For schemas that pull in other files with `[Include ...]` directives, use the [web server](web-server.md), which compiles from the file path so includes resolve. See [Migration Authoring](migration-authoring.md).

---

## introspect

Connect to a live database and read its current schema.

```bash
meadow-migration introspect <connection> [-o <name>]
```

**Alias:** `i`

| Argument | Description |
|---|---|
| `connection` | Connection name from the library |

| Option | Description | Default |
|---|---|---|
| `-o, --output <name>` | Save the discovered schema to the library under this name | (empty) |

The command loads the connection, creates a connected provider through the [DatabaseProviderFactory](api-reference.md), and reads the database schema. It prints the connection details, the discovered table count, and each table with its column count. With `-o`, the discovered schema is stored in the schema library as the named entry's compiled schema (the entry's DDL is left empty).

```bash
meadow-migration introspect local-mysql -o bookstore-live
```

```
Introspecting database via connection [local-mysql]...
  Type:     MySQL
  Server:   127.0.0.1
  Port:     3306
  Database: bookstore

Introspection complete — 5 table(s) discovered.
  Book (9 columns)
  Author (2 columns)
  ...
Introspected schema saved to library as [bookstore-live].
```

> Introspection requires the connector package for the connection's type. The four connectors -- [meadow-connection-mysql](https://fable-retold.github.io/meadow-connection-mysql/), [meadow-connection-postgresql](https://fable-retold.github.io/meadow-connection-postgresql/), [meadow-connection-mssql](https://fable-retold.github.io/meadow-connection-mssql/), and [meadow-connection-sqlite](https://fable-retold.github.io/meadow-connection-sqlite/) -- ship as dependencies, so all four types work out of the box.

---

## diff

Compare two schemas and report the differences.

```bash
meadow-migration diff <source-schema> <target-schema>
```

**Alias:** `d`

| Argument | Description |
|---|---|
| `source-schema` | Baseline schema name |
| `target-schema` | Schema to compare against the baseline |

Both schemas are compiled automatically if they have not been compiled yet. The diff reports tables added, tables removed, and tables modified (with columns, indices, and foreign keys added, removed, or modified within each modified table).

```bash
meadow-migration diff bookstore bookstore-v2
```

For the structure of a diff result, see the [SchemaDiff API](api-reference.md).

---

## generate-script

Compute a diff between two schemas (or a live database and a schema) and emit a SQL migration script.

```bash
meadow-migration generate-script <source-schema> <target-schema> [options]
meadow-migration generate-script --connection <conn> <target-schema> [options]
```

**Alias:** `gs`

| Argument | Description |
|---|---|
| `source-schema` | Baseline schema name (omitted when `--connection` is used; the first argument is then the target) |
| `target-schema` | Target schema name |

| Option | Description | Default |
|---|---|---|
| `-t, --type <type>` | Database dialect: `MySQL`, `PostgreSQL`, `MSSQL`, `SQLite` | `MySQL` |
| `-o, --output <file>` | Write the script to this file instead of stdout | (empty) |
| `-c, --connection <name>` | Use a live database as the source (current state) instead of a schema | (empty) |

When `-c/--connection` is given, the named database is introspected and used as the **source**, and the single positional argument is treated as the **target** schema. This produces a script that migrates the live database toward the target schema. When `-o` is omitted, the script is printed to stdout so it can be redirected or piped.

```bash
# Schema-to-schema
meadow-migration generate-script bookstore bookstore-v2 -t MySQL

# Schema-to-schema, written to a file
meadow-migration generate-script bookstore bookstore-v2 -t PostgreSQL -o migration.sql

# Live database (source) to a target schema
meadow-migration generate-script --connection local-mysql bookstore-v2 -t MySQL -o migration.sql
```

```
Migration script written to [migration.sql]
```

---

## migrate

Generate the SQL that would bring a live database in line with a target schema.

```bash
meadow-migration migrate <schema> <connection> [-t <type>]
```

**Alias:** `m`

| Argument | Description |
|---|---|
| `schema` | Target schema name (desired state) |
| `connection` | Connection name (current state) |

| Option | Description | Default |
|---|---|---|
| `-t, --type <type>` | Database dialect override | the connection's `Type` |

The command compiles the target schema, introspects the database (treated as the source / current state), diffs the two, and **prints the generated migration script to stdout**. It reports a one-line diff summary (tables added / removed / modified) before the script.

> **`migrate` does not apply changes.** It generates and prints the SQL only. Review the output and run it against your database through your own deployment process. The script direction is database (source) toward schema (target).

```bash
meadow-migration migrate bookstore-v2 local-mysql
```

```
Migrate: [bookstore-v2] -> DB:[local-mysql] (MySQL)
Introspecting database...
Diff: 1 added, 0 removed, 1 modified

-- Migration Script -- Generated 2026-03-02T12:00:00.000Z
-- Database Type: MySQL
...
```

---

## deploy

Intended to create tables and indices on a live database from a compiled schema.

```bash
meadow-migration deploy <schema> <connection>
```

**Alias:** `dep`

| Argument | Description |
|---|---|
| `schema` | Schema name from the library |
| `connection` | Connection name from the library |

> **Status: not yet available via the CLI.** In the current release this command validates its arguments, prints the schema and connection it would use, and then reports `Deploy is not yet available via the CLI.` without contacting the database. The underlying [SchemaDeployer](api-reference.md) service is fully implemented and can be driven programmatically; the CLI wiring is pending. To create a database from a schema today, generate a migration script with `generate-script` and run it, or use the [SchemaDeployer API](api-reference.md) directly.

---

## serve

Start the web server for a directory of model files. See [Web Server](web-server.md) for the full UI and API reference.

```bash
meadow-migration serve [model-path] [-p <port>]
```

**Alias:** `s`

| Argument | Description | Default |
|---|---|---|
| `model-path` | Directory containing `.mddl` / `.ddl` files | the `ModelPath` config value, then the current directory |

| Option | Description | Default |
|---|---|---|
| `-p, --port <port>` | Port to listen on | a random port in the range 7000-7999 |

The command resolves the model directory (CLI argument, then `ModelPath` from configuration, then the current working directory), validates that it exists and is a directory, scans it non-recursively for `.mddl` and `.ddl` files, imports and compiles each one (resolving `[Include ...]` directives from the file path), then starts an Orator HTTP server. The process stays in the foreground until interrupted with Ctrl+C.

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

---

## tui

Launch the interactive Terminal UI. See the [User Guide](user-guide.md) for the panel-by-panel walkthrough.

```bash
meadow-migration tui
```

**Alias:** `ui`

The TUI takes over the terminal using `blessed`. It inherits the current schema and connection libraries (loading connections from the configuration cascade) and the active application state, then runs until you quit.

---

## explain-config

Print the resolved configuration cascade. This command is added automatically by the CLI framework.

```bash
meadow-migration explain-config
```

Shows which configuration files were found, the order in which they were merged, and the final resolved settings -- useful when a setting is not taking effect and you need to see which file won.

---

## Database dialects

The `-t/--type` option on `generate-script` and `migrate`, and the `-t` option on `add-connection`, accept these four values. The [MigrationGenerator](api-reference.md) emits dialect-appropriate SQL for each.

| Dialect | Identifier quoting | ID column | String type |
|---|---|---|---|
| `MySQL` | `` `backticks` `` | `INT UNSIGNED NOT NULL AUTO_INCREMENT` | `VARCHAR(n)` / `CHAR(n)` |
| `PostgreSQL` | `"double quotes"` | `SERIAL` | `VARCHAR(n)` |
| `MSSQL` | `[brackets]` | `INT IDENTITY(1,1)` | `NVARCHAR(n)` |
| `SQLite` | `"double quotes"` | `INTEGER PRIMARY KEY AUTOINCREMENT` | `TEXT` |

SQLite emits explanatory comments for operations it cannot perform inline (for example dropping a foreign key), and notes the minimum SQLite version for `DROP COLUMN`.

## See Also

- [CLI Guide](cli-guide.md) -- guided, example-driven command walkthrough
- [Migration Authoring](migration-authoring.md) -- writing MicroDDL and running a migration end to end
- [Web Server](web-server.md) -- the `serve` command's UI and REST API
- [API Reference](api-reference.md) -- the services the commands call
