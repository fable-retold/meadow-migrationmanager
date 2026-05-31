# Migration Authoring

> How to write a MicroDDL schema, evolve it, and turn the changes into a migration script.

A migration in Meadow Migration Manager is the difference between two compiled schemas, translated into SQL. You author schemas in **MicroDDL** (the compact schema language compiled by [Stricture](https://fable-retold.github.io/stricture/)), keep successive versions in the schema library, and let the tool diff them and generate the SQL. This page covers the authoring language and the end-to-end workflow.

## The Authoring Model

There is no separate "migration file" format. Instead:

1. You write a schema as one or more MicroDDL files.
2. You add and compile each version in the schema library.
3. The tool **diffs** a source version against a target version.
4. The tool **generates** dialect-specific SQL from that diff.

Because a migration is derived from a diff, you never hand-write `ALTER TABLE` statements -- you edit the schema and let the diff describe what changed. The same diff drives the CLI's `generate-script`/`migrate` commands and the web server's diff and migration views.

## MicroDDL Syntax

Each line begins with a symbol that declares a table or a column type. Columns attach to the most recently declared table. The symbol set below is verified against the module's fixtures and its built-in MicroDDL syntax highlighter.

| Symbol | Meaning | Example |
|---|---|---|
| `!` | Table | `!Book` |
| `@` | Auto-increment primary key (ID) | `@IDBook` |
| `$` | String column (optional size) | `$Title 200` |
| `#` | Numeric / integer column | `#PublicationYear` |
| `.` | Decimal column (precision,scale) | `.Price 8,2` |
| `&` | Date/time column | `&StartDate` |
| `^` | Boolean column | `^Active` |
| `*` | Long text column | `*Body` |
| `%` | GUID column | `%Discountable` |
| `~` | Foreign key (with join) | `~IDBook -> IDBook` |
| `>` | Table description (documentation) | `>The catalog of books` |
| `"` | Column description (documentation) | `"The display title` |

A column's optional size follows the name, separated by a space: `$Title 200`, `.Price 8,2`, `$Language 12`.

### Foreign keys

A foreign key column uses `~` and a join reference written as `~Column -> TargetColumn`:

```
!BookPrice
@IDBookPrice
.Price 8,2
&StartDate
&EndDate
~IDBook -> IDBook
```

The diff engine also understands foreign keys expressed as a `ForeignKey`-typed column with a `Join` property (the form Stricture produces from `->` syntax), so both compiled foreign keys and join-derived relationships are detected when diffing.

### Named indexes

Index lines start with `+` and attach to the current table. A leading `!` after the `+` marks the index unique (an alternate key); without it the index is non-unique (a lookup index). Columns are comma-separated and their order is preserved for composite indexes.

```
!User
@IDUser
$UserName 128
$Email 256
^Active
+!AK_User_Username UserName
+IX_User_Email Email

!UserSession
@IDUserSession
~IDUser -> IDUser
$SessionToken 256
&LoginDate
+!AK_UserSession_Token SessionToken
+IX_UserSession_UserDate IDUser, LoginDate
```

- `+!AK_User_Username UserName` -- a **unique** index named `AK_User_Username` on `UserName`.
- `+IX_User_Email Email` -- a **non-unique** index named `IX_User_Email` on `Email`.
- `+IX_UserSession_UserDate IDUser, LoginDate` -- a **composite** index across two columns in order.

These index declarations are parsed out of the MicroDDL text by the StrictureAdapter, attached to each table's `Indices`, and carried through into the generated Meadow packages so the connectors and the migration generator pick them up.

### Comments and documentation

Lines beginning with `//` are comments. The `>` and `"` prefixes attach human-readable descriptions to the preceding table and column respectively.

### A complete single-file schema

```
!Book
@IDBook
$Title 200
$Type 32
$Genre 128
$ISBN 64
$Language 12
$ImageURL 254
#PublicationYear

!Author
@IDAuthor
$Name 200

!BookAuthorJoin
@IDBookAuthorJoin
~IDBook -> IDBook
~IDAuthor -> IDAuthor

!BookPrice
@IDBookPrice
.Price 8,2
&StartDate
&EndDate
%Discountable
$CouponCode 16
~IDBook -> IDBook

!Review
@IDReview
*Text
#Rating
~IDBook -> IDBook
```

## Splitting a Schema Across Files

Large schemas can be split into multiple files with `[Include ...]` directives. The include path is resolved relative to the directory of the file that contains it, and includes may nest.

`model/main.mddl`:

```
// Main schema file with includes
!User
@IDUser
$Username 128
$Email 254
$PasswordHash 512

[Include tables/posts.mddl]
[Include tables/comments.mddl]
```

`model/tables/posts.mddl`:

```
!Post
@IDPost
$Title 256
*Body
&PublishDate
~IDUser -> IDUser
```

Includes are resolved during file-based compilation, which the [web server](web-server.md) uses for every schema (the server scans a model directory, imports each top-level file, and compiles from the file path so includes resolve). Cyclic includes are guarded against, and resolved paths are constrained to the model directory.

> **CLI compile and includes.** The CLI's `compile` command compiles the stored DDL text in place (`compileDDL`), which does not resolve `[Include ...]` directives. For multi-file schemas that depend on includes, run them through the web server (`meadow-migration serve <model-dir>`), which compiles from the file path. The text path is fine for single-file schemas.

## End-to-End: Authoring a Migration

This walkthrough evolves a schema and produces a migration script entirely from the CLI. It mirrors the [CLI Reference](cli-reference.md) command behaviors.

### 1. Write the baseline schema

Create `bookstore.ddl` using the single-file example above.

### 2. Add and compile it

```bash
meadow-migration add-schema bookstore ./bookstore.ddl
meadow-migration compile bookstore
```

### 3. Write the next version

Create `bookstore-v2.ddl`. Here we widen `Book.Title`, add two columns to `Book`, and add a `Publisher` table:

```
!Book
@IDBook
$Title 500
$Type 32
$Genre 128
$ISBN 64
$Language 12
$ImageURL 254
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

!BookPrice
@IDBookPrice
.Price 8,2
&StartDate
&EndDate
%Discountable
$CouponCode 16
~IDBook -> IDBook

!Review
@IDReview
*Text
#Rating
~IDBook -> IDBook

!Publisher
@IDPublisher
$Name 256
$Country 128
```

### 4. Add and compile the new version

```bash
meadow-migration add-schema bookstore-v2 ./bookstore-v2.ddl
meadow-migration compile bookstore-v2
```

### 5. Review the diff

```bash
meadow-migration diff bookstore bookstore-v2
```

The diff reports `Publisher` as an added table and `Book` as modified (Title size change plus the new `Edition` and `PageCount` columns). Unchanged tables do not appear.

### 6. Generate the migration script

Print MySQL SQL to stdout:

```bash
meadow-migration generate-script bookstore bookstore-v2 -t MySQL
```

Or write a PostgreSQL script to a file:

```bash
meadow-migration generate-script bookstore bookstore-v2 -t PostgreSQL -o migration.sql
```

The script contains a `CREATE TABLE` for `Publisher` and `ALTER TABLE` statements on `Book`. It opens with a header comment recording the generation timestamp and the target dialect.

## Migrating Against a Live Database

When the "source" is a running database rather than a stored schema, you have two equivalent entry points:

```bash
# Use a live connection as the source for generate-script
meadow-migration generate-script --connection local-mysql bookstore-v2 -o migration.sql

# Or use the migrate command (introspect DB, diff against schema, print SQL)
meadow-migration migrate bookstore-v2 local-mysql
```

Both introspect the connection, diff it against the target schema, and produce the SQL to move the database toward that schema. Neither applies the SQL -- review and run it through your own deployment process. (See the note on `deploy` in the [CLI Reference](cli-reference.md).)

## What the Generator Produces

The [MigrationGenerator](api-reference.md) translates each part of a diff into SQL:

| Diff element | SQL produced |
|---|---|
| Table added | `CREATE TABLE` with columns and primary key |
| Table removed | (no statement -- removals are intentionally not auto-dropped) |
| Column added | `ALTER TABLE ... ADD [COLUMN]` |
| Column removed | `ALTER TABLE ... DROP COLUMN` |
| Column modified | dialect-specific `MODIFY` / `ALTER COLUMN [... TYPE]` |
| Index added | `CREATE INDEX` or `CREATE UNIQUE INDEX` |
| Index removed | `DROP INDEX` / `DROP CONSTRAINT` (dialect-specific) |
| Foreign key added/removed | dialect-specific `ADD` / `DROP` constraint |

Columns are nullable by default; `NOT NULL` is emitted only when a column explicitly opts in. Removed tables never generate a `DROP TABLE` automatically, so a migration cannot silently destroy a table. Review generated SQL before running it in production.

## See Also

- [CLI Reference](cli-reference.md) -- every command and flag
- [Web Server](web-server.md) -- author and compile multi-file schemas in the browser
- [API Reference](api-reference.md) -- StrictureAdapter, SchemaDiff, and MigrationGenerator
- [Stricture](https://fable-retold.github.io/stricture/) -- the MicroDDL compiler and full language reference
