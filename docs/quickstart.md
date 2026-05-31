# Quick Start

> From install to a generated migration script in a few minutes.

Meadow Migration Manager manages database schemas as [MicroDDL](https://fable-retold.github.io/stricture/) and turns the difference between two schema versions into SQL. This page gets you to a working migration fast. For depth, follow the links at the end.

## Install

```bash
# Global -- makes the meadow-migration command available everywhere
npm install -g meadow-migrationmanager

# Or per project
npm install meadow-migrationmanager
# then call it with: npx meadow-migration <command>
```

## 1. Write a schema

Create `bookstore.ddl`:

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

`!` declares a table, `@` an auto-increment primary key, `$` a string (with optional size), `#` an integer, and `~` a foreign key. See [Migration Authoring](migration-authoring.md) for the full symbol set.

## 2. Add and compile it

```bash
meadow-migration add-schema bookstore ./bookstore.ddl
meadow-migration compile bookstore
```

`add-schema` stores the DDL in the schema library (`.meadow-migration-schemas.json`); `compile` runs it through Stricture and saves the compiled result back into the library.

## 3. Make a second version

Create `bookstore-v2.ddl` -- widen `Title`, add two columns to `Book`, and add a `Publisher` table:

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

Add and compile it:

```bash
meadow-migration add-schema bookstore-v2 ./bookstore-v2.ddl
meadow-migration compile bookstore-v2
```

## 4. Diff and generate SQL

```bash
# See what changed
meadow-migration diff bookstore bookstore-v2

# Generate a MySQL migration script to stdout
meadow-migration generate-script bookstore bookstore-v2 -t MySQL

# Or write a PostgreSQL script to a file
meadow-migration generate-script bookstore bookstore-v2 -t PostgreSQL -o migration.sql
```

The generated script creates `Publisher` and alters `Book`. Supported dialects for `-t` are `MySQL`, `PostgreSQL`, `MSSQL`, and `SQLite`.

## 5. Or do it in the browser

Put your `.ddl` / `.mddl` files in a directory and serve it:

```bash
meadow-migration serve ./ -p 8080
```

Open `http://localhost:8080` to edit schemas with syntax highlighting, see an interactive table-relationship diagram, diff schemas (or live databases), and generate migration SQL -- all in the UI. See [Web Server](web-server.md).

## Working with live databases

Save a connection, then introspect or migrate against it:

```bash
meadow-migration add-connection local-mysql -t MySQL -s 127.0.0.1 -p 3306 -u root -w secret -d bookstore
meadow-migration introspect local-mysql -o bookstore-live
meadow-migration migrate bookstore-v2 local-mysql
```

`introspect` reads the live schema (optionally saving it as a library schema with `-o`); `migrate` introspects the database, diffs it against a target schema, and prints the SQL to bring the database in line. `migrate` prints the SQL -- it does not apply it. See the [CLI Reference](cli-reference.md) for details and the status of the `deploy` command.

## Next Steps

- [CLI Reference](cli-reference.md) -- every command, argument, and flag
- [Migration Authoring](migration-authoring.md) -- the MicroDDL language and multi-file schemas
- [Web Server](web-server.md) -- the `serve` UI and REST API
- [User Guide](user-guide.md) -- CLI, Terminal UI, and Web UI walkthroughs
- [Architecture](architecture.md) -- how the services fit together
- [API Reference](api-reference.md) -- the programmatic service API
