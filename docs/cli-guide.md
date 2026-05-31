# CLI Guide

> Guided, example-driven walkthrough of the `meadow-migration` command-line interface

> For an exhaustive, source-verified reference of every command, argument, and flag -- including the `serve` and `explain-config` commands -- see the [CLI Reference](cli-reference.md). This guide is the narrative companion to that page.

## Installation

Install globally to make the `meadow-migration` command available from any directory:

```bash
npm install -g meadow-migrationmanager
```

Alternatively, run it locally in a project without a global install:

```bash
npx meadow-migration <command>
```

Or install as a project dependency and invoke through npm scripts or npx:

```bash
npm install meadow-migrationmanager
npx meadow-migration list-schemas
```

## Configuration

### Cascading Configuration

The CLI loads settings from three sources. Later sources override earlier ones:

1. **Built-in defaults** -- hardcoded in the CLI program entry point
2. **Home directory config** -- `~/.meadow-migration-config.json`
3. **Working directory config** -- `./.meadow-migration-config.json`

This cascade allows you to set global preferences in your home directory while overriding them on a per-project basis. For example, you might set a default schema library path in your home config and override it with a project-specific path in the working directory config.

### Configuration Settings

| Setting | Default | Description |
|---|---|---|
| `SchemaLibraryFile` | `.meadow-migration-schemas.json` | Path to schema library persistence file |
| `ConnectionLibraryFile` | `.meadow-migration-connections.json` | Path to connection library persistence file |

### Example Configuration File

Create a `.meadow-migration-config.json` in your home directory or project root:

```json
{
	"SchemaLibraryFile": ".meadow-migration-schemas.json",
	"ConnectionLibraryFile": ".meadow-migration-connections.json"
}
```

### Viewing Active Configuration

Use the built-in `explain-config` command to inspect the resolved configuration cascade. This shows which config files were found, the order in which they were merged, and the final resolved values:

```bash
meadow-migration explain-config
```

This is useful for debugging when settings are not behaving as expected -- it will show you exactly which files contributed to the final configuration and what values were resolved.

## Commands

### list-schemas (ls)

Lists all schemas currently stored in the schema library, including their compilation status and last compiled timestamp.

**Usage:**

```bash
meadow-migration list-schemas
```

**Alias:** `ls`

**Example output:**

```
Schemas (3):
  bookstore  (compiled 2026-03-01T14:22:05.000Z)
  bookstore-v2  (compiled 2026-03-01T14:23:11.000Z)
  inventory  (not compiled)
```

If no schemas exist in the library, the command prints a message directing you to use `add-schema`.

---

### add-schema (as)

Imports a MicroDDL schema from a file on disk and adds it to the schema library under the given name.

**Usage:**

```bash
meadow-migration add-schema <name> <file>
```

**Alias:** `as`

**Arguments:**

| Argument | Description |
|---|---|
| `name` | A unique name for this schema in the library |
| `file` | Path to the MicroDDL (`.ddl`) file to import |

**Example:**

```bash
meadow-migration add-schema bookstore ./bookstore.ddl
```

```
Schema [bookstore] added to library and saved to [.meadow-migration-schemas.json].
```

The raw DDL text is read from the file and stored in the schema library. The schema is not compiled automatically -- use the `compile` command to compile it after adding.

---

### list-connections (lc)

Lists all saved database connections in the connection library with their type and server information.

**Usage:**

```bash
meadow-migration list-connections
```

**Alias:** `lc`

**Example output:**

```
Connections (2):
  local-mysql  (MySQL)
  staging-pg  (PostgreSQL)
```

If no connections exist in the library, the command prints a message directing you to use `add-connection`.

---

### add-connection (ac)

Adds a database connection configuration to the connection library. The connection is persisted for use with introspect, deploy, and migrate commands.

**Usage:**

```bash
meadow-migration add-connection <name> [options]
```

**Alias:** `ac`

**Arguments:**

| Argument | Description |
|---|---|
| `name` | A unique name for this connection in the library |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-t, --type <type>` | Database type (MySQL, PostgreSQL, MSSQL, SQLite) | `SQLite` |
| `-s, --server <host>` | Server hostname | `127.0.0.1` |
| `-p, --port <port>` | Server port | (none) |
| `-u, --user <user>` | Database user | (none) |
| `-w, --password <password>` | Database password | (none) |
| `-d, --database <database>` | Database name | (none) |

**Example:**

```bash
meadow-migration add-connection local-mysql -t MySQL -s 127.0.0.1 -p 3306 -u root -w secret -d bookstore
```

```
Connection [local-mysql] (MySQL) added and saved to [.meadow-migration-connections.json].
```

---

### compile (c)

Compiles the named schema's MicroDDL via Stricture. The compilation produces a structured schema object with table definitions, column metadata, indices, and foreign key relationships. The compiled output and a timestamp are stored back in the schema library entry.

**Usage:**

```bash
meadow-migration compile <schema>
```

**Alias:** `c`

**Arguments:**

| Argument | Description |
|---|---|
| `schema` | Schema name from the library (as added via `add-schema`) |

**Example:**

```bash
meadow-migration compile bookstore
```

```
Schema [bookstore] compiled successfully.
Compiled schema saved to library [.meadow-migration-schemas.json].
```

The schema must already exist in the library. If the schema is not found, an error is printed. Once compiled, subsequent commands like `diff` and `generate-script` will use the compiled output directly rather than recompiling.

---

### diff (d)

Compares two compiled schemas and prints a summary of differences. Both schemas are compiled automatically if they have not been compiled yet.

**Usage:**

```bash
meadow-migration diff <source-schema> <target-schema>
```

**Alias:** `d`

**Arguments:**

| Argument | Description |
|---|---|
| `source-schema` | The baseline schema name |
| `target-schema` | The target schema name to compare against |

The diff reports:

- Tables added (present in target but not source)
- Tables removed (present in source but not target)
- Tables modified (present in both but with differences), including:
	- Columns added
	- Columns removed
	- Columns modified (type, size, or constraint changes)

**Example:**

```bash
meadow-migration diff bookstore bookstore-v2
```

```
Schema Diff: [bookstore] -> [bookstore-v2]
  Tables added:    1
  Tables removed:  0
  Tables modified: 1

  Added tables:
    + Publisher

  Modified tables:
    ~ Book
        ~ column: Title
        + column: Edition
        + column: PageCount
```

If the two schemas are identical, the command reports no differences detected.

---

### generate-script (gs)

Generates a SQL migration script from the differences between two schemas. Both schemas are compiled automatically if needed. The diff is computed and then translated to database-specific DDL statements.

**Usage:**

```bash
meadow-migration generate-script <source-schema> <target-schema> [options]
```

**Alias:** `gs`

**Arguments:**

| Argument | Description |
|---|---|
| `source-schema` | The baseline schema name |
| `target-schema` | The target schema name |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-t, --type <type>` | Database type (MySQL, PostgreSQL, MSSQL, SQLite) | `MySQL` |
| `-o, --output <file>` | Output file path (omit to print to stdout) | (none) |
| `-c, --connection <name>` | Use a live database as the source (current state) instead of a schema | (none) |

When `--connection` is given, the named database is introspected and used as the source, and the single positional argument is treated as the target schema. See the [CLI Reference](cli-reference.md).

**Examples:**

Generate MySQL migration SQL and print to stdout:

```bash
meadow-migration generate-script bookstore bookstore-v2 -t MySQL
```

Generate PostgreSQL migration SQL and save to a file:

```bash
meadow-migration generate-script bookstore bookstore-v2 -t PostgreSQL -o migration.sql
```

```
Migration script written to [migration.sql]
```

Generate MySQL migration SQL to a file:

```bash
meadow-migration generate-script bookstore bookstore-v2 -t MySQL -o migrate-bookstore.sql
```

When writing to a file, the script content is saved and a confirmation message is printed. When no `-o` option is given, the raw SQL is printed directly to stdout so it can be piped or redirected.

---

### introspect (i)

Introspects a live database to discover its current schema. The connection must already exist in the connection library.

**Usage:**

```bash
meadow-migration introspect <connection> [options]
```

**Alias:** `i`

**Arguments:**

| Argument | Description |
|---|---|
| `connection` | Connection name from the library |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-o, --output <name>` | Save the introspected schema to the library with this name | (none) |

**Example:**

```bash
meadow-migration introspect local-mysql -o bookstore-live
```

The command prints the connection details, the number of tables discovered, and each table with its column count. With `-o`, the discovered schema is saved to the schema library under the given name (as the entry's compiled schema).

**Note:** Schema discovery uses the connector for the connection's database type via the [DatabaseProviderFactory](api-reference.md). The four connectors (MySQL, PostgreSQL, MSSQL, SQLite) ship as dependencies, so all four types work without extra installation.

---

### deploy (dep)

Intended to deploy a compiled schema to a live database, creating tables, columns, and indices.

**Usage:**

```bash
meadow-migration deploy <schema> <connection>
```

**Alias:** `dep`

**Arguments:**

| Argument | Description |
|---|---|
| `schema` | Schema name from the library |
| `connection` | Connection name from the library |

**Note:** This command is **not yet wired up in the CLI.** It validates its arguments, prints the schema and connection it would use, and reports that deploy is not yet available -- it does not contact the database. The underlying [SchemaDeployer](api-reference.md) service is implemented and can be driven programmatically. To create a database from a schema today, generate a migration script with `generate-script` and run it. See the [CLI Reference](cli-reference.md).

---

### migrate (m)

Generates the SQL to bring a live database in line with a target schema. It introspects the database (the current state), diffs it against the target schema (the desired state), and **prints** the resulting migration script to stdout. It does not apply the SQL.

**Usage:**

```bash
meadow-migration migrate <schema> <connection> [-t <type>]
```

**Alias:** `m`

**Arguments:**

| Argument | Description |
|---|---|
| `schema` | Target schema name (desired state) |
| `connection` | Connection name (current state) |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-t, --type <type>` | Database dialect override | the connection's type |

**Example:**

```bash
meadow-migration migrate bookstore-v2 local-mysql
```

The command prints a one-line diff summary followed by the migration script. Review the output and apply it through your own deployment process.

---

### serve (s)

Starts the web server for a directory of model files. See [Web Server](web-server.md) for the UI and REST API.

**Usage:**

```bash
meadow-migration serve [model-path] [-p <port>]
```

**Alias:** `s`

**Arguments:**

| Argument | Description | Default |
|---|---|---|
| `model-path` | Directory of `.mddl` / `.ddl` files | `ModelPath` config, then the current directory |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-p, --port <port>` | Port to listen on | random in 7000-7999 |

The command scans the model directory, imports and compiles each schema (resolving `[Include ...]` directives), starts an Orator server, and stays in the foreground until Ctrl+C.

```bash
meadow-migration serve ./model -p 8080
```

---

### tui (ui)

Launches the interactive Terminal User Interface. The TUI provides a dashboard with panels for schema overview, connection management, DDL editing, visualization, deployment, and migration.

**Usage:**

```bash
meadow-migration tui
```

**Alias:** `ui`

The TUI takes over the terminal screen using blessed. It inherits the current schema and connection libraries along with any active configuration.

---

## MicroDDL Quick Reference

MicroDDL is the compact schema definition language used by Stricture. Each line in a `.ddl` file uses a symbol prefix to declare a table or column type.

| Symbol | Type | Example | Description |
|---|---|---|---|
| `!` | Table | `!Book` | Begins a new table definition |
| `@` | ID (Primary Key) | `@IDBook` | Auto-increment primary key column |
| `$` | String | `$Title 200` | String column with optional max length |
| `#` | Numeric | `#Rating` | Integer column |
| `.` | Decimal | `.Price 8,2` | Decimal with precision,scale |
| `&` | DateTime | `&StartDate` | Date/time column |
| `^` | Boolean | `^Deleted` | Boolean flag column |
| `*` | Text | `*Description` | Long text column |
| `%` | GUID | `%GUIDBook` | GUID/UUID column |
| `~` | ForeignKey | `~IDBook -> IDBook` | Foreign key with join reference |

Columns are associated with the most recently declared table. The optional size parameter follows the column name, separated by a space.

---

## Complete Workflow Example

This walkthrough demonstrates the full schema management pipeline from DDL authoring through migration script generation.

### Step 1: Create Your Schema Files

Create the initial schema in `bookstore.ddl`:

```
!Book
@IDBook
$Title 200
$Genre 128
#PublicationYear

!Author
@IDAuthor
$Name 200

!BookAuthorJoin
@IDBookAuthorJoin
~IDBook -> IDBook
~IDAuthor -> IDAuthor
```

This defines three tables: `Book` with a primary key, two string columns, and an integer column; `Author` with a primary key and name; and `BookAuthorJoin` as a many-to-many join table with foreign keys to both.

Now create an updated schema in `bookstore-v2.ddl` with changes:

```
!Book
@IDBook
$Title 500
$Genre 128
#PublicationYear
$Edition 64
#PageCount

!Author
@IDAuthor
$Name 200

!BookAuthorJoin
@IDBookAuthorJoin
~IDBook -> IDBook
~IDAuthor -> IDAuthor

!Publisher
@IDPublisher
$Name 256
$Country 128
```

The changes from v1 to v2 are:
- `Book.Title` size increased from 200 to 500
- `Book.Edition` column added (string, size 64)
- `Book.PageCount` column added (integer)
- `Publisher` table added with `IDPublisher`, `Name`, and `Country` columns

### Step 2: Add Schemas to Library

```bash
meadow-migration add-schema bookstore ./bookstore.ddl
meadow-migration add-schema bookstore-v2 ./bookstore-v2.ddl
```

Both schemas are now stored in the schema library file (`.meadow-migration-schemas.json` by default).

### Step 3: Compile Both Schemas

```bash
meadow-migration compile bookstore
meadow-migration compile bookstore-v2
```

Each schema's MicroDDL is processed through Stricture, producing structured schema objects with full table, column, index, and foreign key metadata. The compiled output is stored back in the schema library alongside the raw DDL.

### Step 4: Diff the Schemas

```bash
meadow-migration diff bookstore bookstore-v2
```

The diff output shows what changed between the two versions:

- **Publisher** table added with its three columns (IDPublisher, Name, Country)
- **Book** table modified:
	- `Title` column modified (size changed from 200 to 500)
	- `Edition` column added
	- `PageCount` column added

The `Author` and `BookAuthorJoin` tables are unchanged and do not appear in the diff.

### Step 5: Generate Migration Script

Print the migration SQL to stdout:

```bash
meadow-migration generate-script bookstore bookstore-v2 -t MySQL
```

The generated script contains the DDL statements needed to transform the source schema into the target:

- A `CREATE TABLE` statement for the new `Publisher` table with its columns and primary key
- `ALTER TABLE` statements on `Book` to modify the `Title` column size and add the `Edition` and `PageCount` columns

Save the script to a file for review or execution:

```bash
meadow-migration generate-script bookstore bookstore-v2 -t MySQL -o migration.sql
```

You can also target different database types:

```bash
meadow-migration generate-script bookstore bookstore-v2 -t PostgreSQL -o migration-pg.sql
```

### Step 6: Review

Confirm the current state of your schema library:

```bash
meadow-migration list-schemas
```

```
Schemas (2):
  bookstore  (compiled 2026-03-01T14:22:05.000Z)
  bookstore-v2  (compiled 2026-03-01T14:23:11.000Z)
```

Both schemas are compiled and ready. The generated migration script can be reviewed, edited if needed, and applied to your database through your preferred deployment process. The `migrate` command will also generate (and print) a script that targets a live database directly; see the [CLI Reference](cli-reference.md) for `migrate` and the current status of `deploy`.
