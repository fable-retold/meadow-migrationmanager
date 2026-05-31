# API Reference

Complete API reference for the services in `meadow-migrationmanager`.

All services extend `fable.ServiceProviderBase` and are registered as service types
on the main `MeadowMigrationManager` instance. Instantiate them with
`pManager.instantiateServiceProvider('ServiceType')`.

The main class registers eleven service types: `SchemaLibrary`, `ConnectionLibrary`,
`StrictureAdapter`, `MeadowPackageGenerator`, `SchemaDiff`, `MigrationGenerator`,
`SchemaIntrospector`, `SchemaDeployer`, `SchemaVisualizer`, `FlowDataBuilder`, and
`DatabaseProviderFactory`. The CLI program registers the same set (it instantiates
`DatabaseProviderFactory` for its live-database commands).

---

## MeadowMigrationManager

The root class. Extends `Pict` (which extends `Fable`), registers all service
types on construction, and initializes shared application state.

### Constructor

```js
const MeadowMigrationManager = require('meadow-migrationmanager');

let tmpManager = new MeadowMigrationManager(pSettings);
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSettings` | `Object` | Settings hash passed through to Pict/Fable |

### Initialized State

On construction, `this.AppData.MigrationManager` is initialized to:

```js
{
	Schemas: {},
	Connections: {},
	ActiveSchemaName: null,
	ActiveConnectionName: null,
	DiffResult: null,
	MigrationScript: null,
	IntrospectionResult: null
}
```

### Registered Service Types

| Service Type | Description |
|---|---|
| `SchemaLibrary` | Manages DDL/JSON schema collection |
| `ConnectionLibrary` | Manages storage connection configurations |
| `StrictureAdapter` | Wraps Stricture compiler for DDL compilation |
| `MeadowPackageGenerator` | Converts DDL schemas to Meadow package JSON |
| `SchemaDiff` | Compares two DDL schemas |
| `MigrationGenerator` | Converts schema diffs to migration SQL |
| `SchemaIntrospector` | Wraps provider introspection methods |
| `SchemaDeployer` | Creates tables/indices on live databases |
| `SchemaVisualizer` | Produces text-based schema visualizations |
| `FlowDataBuilder` | Builds pict-section-flow graph data from schemas |
| `DatabaseProviderFactory` | Creates connected `meadow-connection-*` providers and runs test/introspect |

### Usage Example

```js
const MeadowMigrationManager = require('meadow-migrationmanager');

let tmpManager = new MeadowMigrationManager({});

let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');
tmpSchemaLib.addSchema('bookstore', '!Book\n@IDBook\n$Title 200\n');

let tmpAdapter = tmpManager.instantiateServiceProvider('StrictureAdapter');
tmpAdapter.compileDDL(tmpSchemaLib.getSchema('bookstore').DDL,
	(pError, pCompiledSchema) =>
	{
		// pCompiledSchema.Tables is a hash of table objects
	});
```

---

## SchemaLibrary

Manages a collection of DDL/JSON schema definitions with CRUD operations
and file-based persistence.

**Service type:** `'SchemaLibrary'`
**Extends:** `fable.ServiceProviderBase`
**State location:** `this.fable.AppData.MigrationManager.Schemas`

### Schema Entry Structure

```js
{
	Name: 'bookstore',
	DDL: '...MicroDDL text...',
	CompiledSchema: null,       // { Tables: {...} } after compilation
	MeadowPackages: null,       // Array of Meadow package JSONs
	LastCompiled: null           // ISO timestamp string
}
```

### Methods

#### `addSchema(pName, pDDLText)`

Add a DDL schema to the library. Overwrites any existing entry with the same name.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pName` | `string` | Unique name for the schema |
| `pDDLText` | `string` | MicroDDL text content |

**Returns:** `Object` -- the newly created schema entry.

```js
let tmpEntry = tmpSchemaLib.addSchema('bookstore', '!Book\n@IDBook\n$Title 200\n');
// tmpEntry.Name === 'bookstore'
// tmpEntry.DDL === '!Book\n@IDBook\n$Title 200\n'
// tmpEntry.CompiledSchema === null
```

#### `getSchema(pName)`

Retrieve a schema entry by name.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pName` | `string` | Name of the schema to retrieve |

**Returns:** `Object|null` -- the schema entry, or `null` if not found.

#### `removeSchema(pName)`

Remove a schema from the library by name.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pName` | `string` | Name of the schema to remove |

**Returns:** `boolean` -- `true` if the schema was found and removed, `false` otherwise.

#### `listSchemas()`

List all schema names in the library.

**Returns:** `Array<string>` -- array of schema names (keys of the Schemas hash).

#### `importSchemaFromFile(pFilePath, fCallback)`

Import a DDL schema from a file on disk. Uses the file's basename (without
extension) as the schema name.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pFilePath` | `string` | Path to the DDL file to import |
| `fCallback` | `function` | Callback: `(pError, pEntry)` |

```js
tmpSchemaLib.importSchemaFromFile('/path/to/bookstore.mddl',
	(pError, pEntry) =>
	{
		// pEntry.Name === 'bookstore'
	});
```

#### `exportSchemaToFile(pName, pFilePath, fCallback)`

Export a schema's DDL text to a file on disk.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pName` | `string` | Name of the schema to export |
| `pFilePath` | `string` | Path to the output file |
| `fCallback` | `function` | Callback: `(pError)` |

#### `saveLibrary(pFilePath, fCallback)`

Persist the entire schema library to a JSON file on disk.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pFilePath` | `string` | Path to the output JSON file |
| `fCallback` | `function` | Callback: `(pError)` |

#### `loadLibrary(pFilePath, fCallback)`

Load the schema library from a JSON file on disk. Replaces the current
Schemas hash with the contents of the file.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pFilePath` | `string` | Path to the input JSON file |
| `fCallback` | `function` | Callback: `(pError)` |

---

## ConnectionLibrary

Manages a collection of storage connection configurations with CRUD operations
and file-based persistence.

**Service type:** `'ConnectionLibrary'`
**Extends:** `fable.ServiceProviderBase`
**State location:** `this.fable.AppData.MigrationManager.Connections`

### Connection Entry Structure

```js
{
	Name: 'local-mysql',
	Type: 'MySQL',
	Config:
	{
		server: '127.0.0.1',
		port: 3306,
		user: 'root',
		password: '...',
		database: 'bookstore'
	}
}
```

### Methods

#### `addConnection(pName, pType, pConfig)`

Add a connection configuration to the library. Overwrites any existing entry
with the same name.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pName` | `string` | Unique name for the connection |
| `pType` | `string` | Database type: `'MySQL'`, `'PostgreSQL'`, `'MSSQL'`, or `'SQLite'` |
| `pConfig` | `Object` | Connection configuration hash |

**pConfig properties:**

| Property | Type | Description |
|---|---|---|
| `server` | `string` | Database host |
| `port` | `number` | Database port |
| `user` | `string` | Database user |
| `password` | `string` | Database password |
| `database` | `string` | Database name |

**Returns:** `Object` -- the newly created connection entry.

```js
let tmpConn = tmpConnLib.addConnection('local-mysql', 'MySQL',
	{
		server: '127.0.0.1',
		port: 3306,
		user: 'root',
		password: 'secret',
		database: 'bookstore'
	});
```

#### `getConnection(pName)`

Retrieve a connection entry by name.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pName` | `string` | Name of the connection to retrieve |

**Returns:** `Object|null` -- the connection entry, or `null` if not found.

#### `removeConnection(pName)`

Remove a connection from the library by name.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pName` | `string` | Name of the connection to remove |

**Returns:** `boolean` -- `true` if found and removed, `false` otherwise.

#### `listConnections()`

List all connection names in the library.

**Returns:** `Array<string>` -- array of connection names.

#### `saveLibrary(pFilePath, fCallback)`

Persist the entire connection library to a JSON file on disk.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pFilePath` | `string` | Path to the output JSON file |
| `fCallback` | `function` | Callback: `(pError)` |

#### `loadLibrary(pFilePath, fCallback)`

Load the connection library from a JSON file on disk. Replaces the current
Connections hash with the contents of the file.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pFilePath` | `string` | Path to the input JSON file |
| `fCallback` | `function` | Callback: `(pError)` |

---

## StrictureAdapter

Wraps the Stricture compiler to convert MicroDDL text into compiled schema
objects and Meadow package JSON definitions. Handles temporary file management
for the compilation pipeline.

**Service type:** `'StrictureAdapter'`
**Extends:** `fable.ServiceProviderBase`

### Compilation Flow

1. Write DDL text to a temporary file in `os.tmpdir()`
2. Instantiate the Stricture compiler service
3. Run `compileFile` to produce JSON output
4. Read and parse the Extended JSON output (`*-Extended.json`)
5. Optionally generate Meadow packages from the compiled schema

### Methods

#### `compileDDL(pDDLText, fCallback)`

Compile MicroDDL text into a Stricture schema object.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pDDLText` | `string` | MicroDDL text to compile |
| `fCallback` | `function` | Callback: `(pError, pCompiledSchema)` |

The compiled schema has `Tables` as a hash keyed by table name. Each table entry
contains `TableName`, `Columns`, `ForeignKeys`, `Indices`, and other Stricture
metadata.

```js
tmpAdapter.compileDDL('!Book\n@IDBook\n#GUIDBook\n$Title 200\n',
	(pError, pCompiledSchema) =>
	{
		// pCompiledSchema.Tables.Book.Columns is an array of column objects
	});
```

#### `generateMeadowPackages(pCompiledSchema)`

Generate Meadow package JSON objects from a compiled schema. Iterates each table
in the compiled schema's Tables hash, mapping column DataTypes to Meadow schema
types.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pCompiledSchema` | `Object` | A compiled Stricture schema with a `Tables` hash |

**Returns:** `Array<Object>` -- array of Meadow package JSON objects.

##### DataType to Meadow Schema Type Mapping

| DDL DataType | Meadow Schema Type | Default Value |
|---|---|---|
| `ID` | `AutoIdentity` | `0` |
| `GUID` | `AutoGUID` | `'0x0000000000000000'` |
| `ForeignKey` | `Integer` | `0` |
| `Numeric` | `Integer` | `0` |
| `Decimal` | `Decimal` | `0.0` |
| `String` | `String` | `''` |
| `Text` | `String` | `''` |
| `DateTime` | `DateTime` | `null` |
| `Boolean` | `Boolean` | `false` |

##### Magic Column Name Overrides

When a column name matches one of the following, the Meadow type is overridden
regardless of the DDL DataType:

| Column Name | Overridden Type |
|---|---|
| `CreateDate` | `CreateDate` |
| `CreatingIDUser` | `CreateIDUser` |
| `UpdateDate` | `UpdateDate` |
| `UpdatingIDUser` | `UpdateIDUser` |
| `DeleteDate` | `DeleteDate` |
| `DeletingIDUser` | `DeleteIDUser` |
| `Deleted` | `Deleted` |

The generated packages also include `Domain`, `JsonSchema`, and `Authorization`
properties when the compiled schema provides them.

#### `compileAndGenerate(pDDLText, fCallback)`

Compile DDL text and generate Meadow packages in a single operation.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pDDLText` | `string` | MicroDDL text to compile |
| `fCallback` | `function` | Callback: `(pError, pCompiledSchema, pMeadowPackages)` |

```js
tmpAdapter.compileAndGenerate('!Book\n@IDBook\n$Title 200\n',
	(pError, pCompiledSchema, pMeadowPackages) =>
	{
		// pCompiledSchema -- full Stricture output
		// pMeadowPackages -- array of Meadow package objects
	});
```

#### `compileDDLFile(pFilePath, fCallback)`

Compile a MicroDDL file directly from its path on disk. Unlike `compileDDL` (which
writes text to a temp file), this compiles the original file in place so that
`[Include ...]` directives resolve relative to the source directory. Only the
output is written to a temporary directory.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pFilePath` | `string` | Absolute path to the `.mddl` / `.ddl` file |
| `fCallback` | `function` | Callback: `(pError, pCompiledSchema)` |

#### `compileFileAndGenerate(pFilePath, fCallback)`

Compile a DDL file (via `compileDDLFile`, so includes resolve) and generate Meadow
packages in one operation. This is the path the [web server](web-server.md) uses
for every schema.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pFilePath` | `string` | Absolute path to the `.mddl` / `.ddl` file |
| `fCallback` | `function` | Callback: `(pError, pCompiledSchema, pMeadowPackages)` |

### Named index parsing

Both compile paths additionally parse `+`-prefixed named-index lines out of the
MicroDDL source text and attach them to each table's `Indices` array (Stricture's
grammar currently treats these lines as comments, so the adapter handles them).
`+!Name Col, Col` declares a unique index; `+Name Col, Col` declares a non-unique
index; column order is preserved for composite indexes. The parsed indices are
also carried into the generated Meadow packages. See
[Migration Authoring](migration-authoring.md).

---

## SchemaDiff

Compares two DDL-level schemas and produces a structured diff describing
tables, columns, indices, and foreign keys that have been added, removed,
or modified between a source schema and a target schema.

**Service type:** `'SchemaDiff'`
**Extends:** `fable.ServiceProviderBase`

### Methods

#### `diffSchemas(pSourceSchema, pTargetSchema)`

Compare two DDL-level schemas and return a structured diff.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSourceSchema` | `Object` | The source (existing) schema with a `Tables` array |
| `pTargetSchema` | `Object` | The target (desired) schema with a `Tables` array |

Both parameters must have a `Tables` property that is an array of table objects.
Each table object must have `TableName`, `Columns`, `Indices`, and `ForeignKeys`.

**Returns:** `Object` -- a diff result object.

##### Diff Result Structure

```js
{
	TablesAdded: [
		{
			TableName: 'Review',
			Columns: [{ Column: 'IDReview', DataType: 'ID' }],
			ForeignKeys: [{ Column: 'IDBook', ReferencesTable: 'Book', ReferencesColumn: 'IDBook' }],
			Indices: [{ Name: 'idx_review_book', Columns: ['IDBook'], Unique: false }]
		}
	],
	TablesRemoved: [
		{
			TableName: 'OldTable',
			Columns: [{ Column: 'IDOldTable', DataType: 'ID' }],
			ForeignKeys: [],
			Indices: []
		}
	],
	TablesModified: [
		{
			TableName: 'Book',
			ColumnsAdded: [
				{ Column: 'ISBN', DataType: 'String', Size: '13' }
			],
			ColumnsRemoved: [
				{ Column: 'OldField', DataType: 'String', Size: '64' }
			],
			ColumnsModified: [
				{
					Column: 'Title',
					Changes:
					{
						DataType: { From: 'String', To: 'Text' },
						Size: { From: '200', To: undefined }
					}
				}
			],
			IndicesAdded: [
				{ Name: 'idx_book_isbn', Columns: ['ISBN'], Unique: true }
			],
			IndicesRemoved: [
				{ Name: 'idx_old', Columns: ['OldField'], Unique: false }
			],
			ForeignKeysAdded: [
				{ Column: 'IDPublisher', ReferencesTable: 'Publisher', ReferencesColumn: 'IDPublisher' }
			],
			ForeignKeysRemoved: [
				{ Column: 'IDOldRef', ReferencesTable: 'OldTable', ReferencesColumn: 'IDOldTable' }
			]
		}
	]
}
```

Column modifications also detect changes to the `Indexed` and `IndexName`
properties, each reported as `{ From, To }` pairs within the `Changes` object.

#### `diffTables(pSourceTable, pTargetTable)`

Compare a single source table to a single target table.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSourceTable` | `Object` | Source table with `TableName`, `Columns`, `Indices`, `ForeignKeys` |
| `pTargetTable` | `Object` | Target table with `TableName`, `Columns`, `Indices`, `ForeignKeys` |

**Returns:** `Object` -- a table-level diff result with `TableName`, `ColumnsAdded`,
`ColumnsRemoved`, `ColumnsModified`, `IndicesAdded`, `IndicesRemoved`,
`ForeignKeysAdded`, and `ForeignKeysRemoved`.

#### `hasChanges(pTableDiff)`

Check whether a table diff object contains any changes.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pTableDiff` | `Object` | A table diff result from `diffTables()` |

**Returns:** `boolean` -- `true` if any of the diff arrays have entries.

---

## MigrationGenerator

Converts a schema diff (produced by the SchemaDiff service) into executable
SQL migration statements for MySQL, PostgreSQL, MSSQL, or SQLite.

**Service type:** `'MigrationGenerator'`
**Extends:** `fable.ServiceProviderBase`

### Methods

#### `generateMigrationStatements(pDiffResult, pDatabaseType)`

Generate an array of SQL migration statements from a schema diff result.
Handles table creation/removal, column addition/removal/modification, index
creation/removal, and foreign key addition/removal.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pDiffResult` | `Object` | Diff result from `SchemaDiff.diffSchemas()` |
| `pDatabaseType` | `string` | `'MySQL'`, `'PostgreSQL'`, `'MSSQL'`, or `'SQLite'` |

**Returns:** `Array<string>` -- array of individual SQL statements (without trailing semicolons).

Database-specific behaviors:
- **MySQL:** Uses backtick quoting, `MODIFY COLUMN` for alterations, `DROP FOREIGN KEY`
- **PostgreSQL:** Uses double-quote quoting, `ALTER COLUMN ... TYPE` for alterations, `DROP CONSTRAINT IF EXISTS`
- **MSSQL:** Uses bracket quoting, `ALTER COLUMN` for alterations, `DROP CONSTRAINT`
- **SQLite:** Uses double-quote quoting; emits comments for unsupported operations (ALTER COLUMN, DROP FOREIGN KEY)

```js
let tmpDiff = tmpSchemaDiff.diffSchemas(pSourceSchema, pTargetSchema);
let tmpStatements = tmpMigrationGen.generateMigrationStatements(tmpDiff, 'MySQL');

for (let i = 0; i < tmpStatements.length; i++)
{
	console.log(tmpStatements[i] + ';');
}
```

#### `generateMigrationScript(pDiffResult, pDatabaseType)`

Generate a complete migration script string from a schema diff. Joins all
generated statements with semicolons and newlines, prepending a header comment
with a generation timestamp and database type.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pDiffResult` | `Object` | Diff result from `SchemaDiff.diffSchemas()` |
| `pDatabaseType` | `string` | `'MySQL'`, `'PostgreSQL'`, `'MSSQL'`, or `'SQLite'` |

**Returns:** `string` -- the complete migration script.

Script format:

```sql
-- Migration Script -- Generated 2026-03-02T12:00:00.000Z
-- Database Type: MySQL

CREATE TABLE `Review` (
    `IDReview` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `Title` CHAR(200) NOT NULL DEFAULT ''
);

ALTER TABLE `Book` ADD COLUMN `ISBN` CHAR(13) NOT NULL DEFAULT '';
```

When no changes are detected, the script contains only the header comment
followed by `-- No changes detected.`.

#### `_quoteIdentifier(pName, pDatabaseType)`

Quote a database identifier using the appropriate quoting style for the target
database engine. Internal method, but useful to understand the quoting conventions.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pName` | `string` | Identifier to quote |
| `pDatabaseType` | `string` | Database engine |

**Returns:** `string` -- the quoted identifier.

| Database Type | Quoting Style | Example |
|---|---|---|
| `MySQL` | Backticks | `` `Book` `` |
| `PostgreSQL` | Double quotes | `"Book"` |
| `MSSQL` | Brackets | `[Book]` |
| `SQLite` | Double quotes | `"Book"` |

---

## SchemaIntrospector

Wraps introspection methods on Meadow schema providers, delegating calls
to the appropriate provider instance for database schema discovery. All methods
take an already-created schema provider as the first argument, allowing callers
to manage provider lifecycle and connection setup externally.

**Service type:** `'SchemaIntrospector'`
**Extends:** `fable.ServiceProviderBase`

**Note:** All methods require a database provider package (e.g., `meadow-connection-mysql`)
that implements the expected provider interface.

### Methods

#### `introspectDatabase(pSchemaProvider, fCallback)`

Introspect the full database schema via the given provider. Delegates to
`pSchemaProvider.introspectDatabaseSchema()`.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSchemaProvider` | `Object` | An initialized schema provider instance |
| `fCallback` | `function` | Callback: `(pError, pSchema)` |

```js
tmpIntrospector.introspectDatabase(pSchemaProvider,
	(pError, pSchema) =>
	{
		// pSchema contains the full database representation
	});
```

#### `introspectTable(pSchemaProvider, pTableName, fCallback)`

Introspect a single table's schema via the given provider. Delegates to
`pSchemaProvider.introspectTableSchema()`.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSchemaProvider` | `Object` | An initialized schema provider instance |
| `pTableName` | `string` | Name of the table to introspect |
| `fCallback` | `function` | Callback: `(pError, pTableSchema)` |

#### `listTables(pSchemaProvider, fCallback)`

List all tables in the database via the given provider. Delegates to
`pSchemaProvider.listTables()`.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSchemaProvider` | `Object` | An initialized schema provider instance |
| `fCallback` | `function` | Callback: `(pError, pTableNames)` where `pTableNames` is `Array<string>` |

#### `generateMeadowPackages(pSchemaProvider, fCallback)`

Generate Meadow package definitions for all tables in the database. Lists all
tables via the provider, then iterates each one using `async.mapSeries` to call
`pSchemaProvider.generateMeadowPackageFromTable` for each table.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSchemaProvider` | `Object` | An initialized schema provider instance |
| `fCallback` | `function` | Callback: `(pError, pPackages)` where `pPackages` is `Array<Object>` |

---

## SchemaDeployer

Creates tables and indices on a live database from a compiled DDL schema.
Delegates all database operations to the provided schema provider instance.

**Service type:** `'SchemaDeployer'`
**Extends:** `fable.ServiceProviderBase`

**Note:** All methods require a database provider package (e.g., `meadow-connection-mysql`)
that implements `createTables`, `createAllIndices`, `createTable`, and `createIndices`.

### Methods

#### `deploySchema(pSchemaProvider, pCompiledSchema, fCallback)`

Deploy a full compiled schema to the database. Creates all tables first (to
ensure foreign key references resolve), then creates all indices.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSchemaProvider` | `Object` | An initialized schema provider instance |
| `pCompiledSchema` | `Object` | The compiled DDL schema with `Tables` |
| `fCallback` | `function` | Callback: `(pError)` |

```js
tmpDeployer.deploySchema(pSchemaProvider, pCompiledSchema,
	(pError) =>
	{
		if (!pError)
		{
			console.log('Schema deployed successfully.');
		}
	});
```

#### `deployTable(pSchemaProvider, pTableSchema, fCallback)`

Deploy a single table and its indices to the database. Useful for incremental
deployments or adding individual tables to an existing database.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pSchemaProvider` | `Object` | An initialized schema provider instance |
| `pTableSchema` | `Object` | A single table schema object with `TableName` |
| `fCallback` | `function` | Callback: `(pError)` |

---

## SchemaVisualizer

Produces text-based schema visualizations from DDL-level compiled schemas.
All methods are synchronous and return formatted strings suitable for console
output or embedding in documentation.

**Service type:** `'SchemaVisualizer'`
**Extends:** `fable.ServiceProviderBase`

### Methods

#### `generateTableList(pCompiledSchema)`

Generate a formatted list of all tables with column counts.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pCompiledSchema` | `Object` | A compiled DDL schema with a `Tables` array |

**Returns:** `string` -- formatted table list.

Example output:

```
Tables (3):
  Book                (7 columns)
  Author              (4 columns)
  BookAuthorJoin      (5 columns)
```

#### `generateTableDetail(pTableSchema)`

Generate a detailed column listing for a single table.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pTableSchema` | `Object` | A single table schema with `TableName` and `Columns` |

**Returns:** `string` -- formatted table detail.

Example output:

```
Table: Book
  IDBook              ID
  GUIDBook            GUID
  Title               String(200)
  Genre               String(128)
  PublicationYear     Numeric
  CreateDate          DateTime
  UpdateDate          DateTime
```

#### `generateRelationshipMap(pCompiledSchema)`

Generate a foreign key relationship listing for all tables.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pCompiledSchema` | `Object` | A compiled DDL schema with a `Tables` array |

**Returns:** `string` -- formatted relationship map, or `'No foreign key relationships found.'`
if no FKs exist.

Example output:

```
Foreign Key Relationships:
  BookAuthorJoin.IDBook         -> Book.IDBook
  BookAuthorJoin.IDAuthor       -> Author.IDAuthor
```

#### `generateASCIIDiagram(pCompiledSchema)`

Generate an ASCII box diagram of all tables with type abbreviations.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pCompiledSchema` | `Object` | A compiled DDL schema with a `Tables` array |

**Returns:** `string` -- formatted ASCII diagram.

Example output:

```
+--------------------+
| Book               |
+--------------------+
| IDBook         [PK]|
| GUIDBook       GID |
| Title          STR |
| Genre          STR |
| Published       DT |
| Price          DEC |
| InPrint        BOL |
+--------------------+
```

##### Type Abbreviations

| DataType | Abbreviation |
|---|---|
| `ID` | `[PK]` |
| `ForeignKey` | `FK` |
| `String` | `STR` |
| `Numeric` | `NUM` |
| `Decimal` | `DEC` |
| `DateTime` | `DT` |
| `Text` | `TXT` |
| `Boolean` | `BOL` |
| `GUID` | `GID` |

---

## FlowDataBuilder

Converts compiled DDL schemas into `pict-section-flow` data structures for
interactive graph visualization. Each database table becomes a flow node with
ports for columns involved in foreign key relationships. FK connections are
rendered as edges between specific field-level ports.

**Service type:** `'FlowDataBuilder'`
**Extends:** `fable.ServiceProviderBase`

### Conversion Algorithm

1. Normalize the `Tables` input (accepts both hash and array formats)
2. Scan all FKs to build a set of "referenced" columns
3. For each table, create a flow Node with column-level ports
4. For each FK relationship, create a Connection between ports
5. Auto-layout tables in a grid pattern

### Methods

#### `buildFlowData(pCompiledSchema)`

Build a complete pict-section-flow data structure from a compiled schema.
Accepts compiled schemas where `Tables` is either a hash (Stricture Extended
JSON output) or an array (normalized format used by other services).

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pCompiledSchema` | `Object` | A compiled DDL schema with `Tables` |

**Returns:** `Object` -- pict-section-flow compatible data structure.

##### Return Structure

```js
{
	Nodes: [
		{
			Hash: 'table-Book',
			Type: 'TABLE',
			X: 50,
			Y: 50,
			Width: 260,
			Height: 126,
			Title: 'Book',
			Ports: [
				{
					Hash: 'port-Book-IDBook-in',
					Direction: 'input',
					Side: 'left',
					Label: 'IDBook'
				}
			],
			Data:
			{
				TableName: 'Book',
				Columns: [
					{
						Column: 'IDBook',
						DataType: 'ID',
						Size: undefined,
						TypeDisplay: 'PK',
						IsFK: false,
						IsReferenced: true
					}
				]
			}
		}
	],
	Connections: [
		{
			Hash: 'fk-conn-0',
			SourceNodeHash: 'table-BookAuthorJoin',
			SourcePortHash: 'port-BookAuthorJoin-IDBook-out',
			TargetNodeHash: 'table-Book',
			TargetPortHash: 'port-Book-IDBook-in',
			Data:
			{
				Type: 'ForeignKey',
				SourceTable: 'BookAuthorJoin',
				SourceColumn: 'IDBook',
				TargetTable: 'Book',
				TargetColumn: 'IDBook'
			}
		}
	],
	ViewState:
	{
		PanX: 0,
		PanY: 0,
		Zoom: 1,
		SelectedNodeHash: null,
		SelectedConnectionHash: null
	}
}
```

Port conventions:
- FK columns get **output** ports on the **right** side, with hash pattern `port-{TableName}-{Column}-out`
- Referenced PK columns get **input** ports on the **left** side, with hash pattern `port-{TableName}-{Column}-in`

When the `ForeignKeys` array is absent from a table, the builder falls back to
scanning columns with `DataType === 'ForeignKey'` and a `Join` property to
discover FK relationships.

##### Type Display Abbreviations

| DataType | TypeDisplay |
|---|---|
| `ID` | `PK` |
| `ForeignKey` | `FK` |
| `String` | `STR` or `STR(size)` |
| `Numeric` | `INT` |
| `Decimal` | `DEC` or `DEC(size)` |
| `DateTime` | `DT` |
| `Text` | `TXT` |
| `Boolean` | `BOOL` |
| `GUID` | `GUID` |

#### `buildDiffFlowData(pCompiledSchema, pDiffResult)`

Build flow data with color-coded nodes based on a schema diff result. Same as
`buildFlowData` but sets the node `Type` property based on diff status.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pCompiledSchema` | `Object` | The target compiled schema |
| `pDiffResult` | `Object` | A diff result from `SchemaDiff.diffSchemas()` |

**Returns:** `Object` -- pict-section-flow data object with diff-colored nodes.

Diff status mapping:

| Diff Status | Node Type | Data.DiffStatus |
|---|---|---|
| Added table | `TABLE_ADDED` | `'Added'` |
| Removed table | `TABLE_REMOVED` | `'Removed'` |
| Modified table | `TABLE_MODIFIED` | `'Modified'` |
| Unchanged table | `TABLE` (default) | `'Unchanged'` |

### Layout Constants

| Constant | Value | Description |
|---|---|---|
| `COLUMN_ROW_HEIGHT` | `22` | Pixels per column row inside a node |
| `TITLE_BAR_HEIGHT` | `28` | Title bar height in pixels |
| `DEFAULT_NODE_WIDTH` | `260` | Default node width in pixels |
| `LAYOUT_HORIZONTAL_GAP` | `320` | Horizontal spacing between nodes |
| `LAYOUT_VERTICAL_GAP` | `40` | Vertical spacing between node rows |
| `LAYOUT_MAX_COLUMNS` | `4` | Maximum columns in the auto-layout grid |
| `LAYOUT_START_X` | `50` | Grid start X offset in pixels |
| `LAYOUT_START_Y` | `50` | Grid start Y offset in pixels |

Node height is calculated dynamically:
`height = TITLE_BAR_HEIGHT + (columnCount * COLUMN_ROW_HEIGHT) + 10`, with a
minimum of 60 pixels.

---

## MeadowPackageGenerator

Converts DDL-level schemas (with a `Tables` array) into Meadow package JSON
format, mapping column data types and magic column names to the Meadow schema
conventions used by Stricture and the Meadow ORM.

**Service type:** `'MeadowPackageGenerator'`
**Extends:** `fable.ServiceProviderBase`

### Methods

#### `generateFromDDLSchema(pCompiledSchema)`

Generate Meadow package objects from a full DDL-level compiled schema.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pCompiledSchema` | `Object` | Compiled DDL schema with a `Tables` array |

**Returns:** `Array<Object>` -- array of Meadow package objects, one per table.

```js
let tmpPackages = tmpPkgGen.generateFromDDLSchema(pCompiledSchema);
// tmpPackages.length === number of tables
```

#### `generateFromTable(pTableSchema)`

Generate a single Meadow package object from a table DDL schema.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pTableSchema` | `Object` | A single table schema with `TableName` and `Columns` |

**Returns:** `Object` -- a Meadow package definition.

> The full `DatabaseProviderFactory` service -- which the live-database CLI commands
> and the web API use to create connected providers and run test/introspect -- is
> documented in its own section below.

##### Meadow Package Shape

```js
{
	Scope: 'Book',
	DefaultIdentifier: 'IDBook',
	Schema: [
		{ Column: 'IDBook', Type: 'AutoIdentity', Size: '' },
		{ Column: 'GUIDBook', Type: 'AutoGUID', Size: '' },
		{ Column: 'Title', Type: 'String', Size: '200' }
	],
	DefaultObject:
	{
		IDBook: 0,
		GUIDBook: '0x0000000000000000',
		Title: ''
	}
}
```

The `DefaultIdentifier` is set to the first column with `DataType === 'ID'`,
falling back to `'ID' + TableName` if no ID column is found.

##### DataType to Meadow Schema Type Mapping

| DDL DataType | Meadow Schema Type | Default Value |
|---|---|---|
| `ID` | `AutoIdentity` | `0` |
| `GUID` | `AutoGUID` | `'0x0000000000000000'` |
| `ForeignKey` | `Integer` | `0` |
| `Numeric` | `Integer` | `0` |
| `Decimal` | `Decimal` | `0.0` |
| `String` | `String` | `''` |
| `Text` | `String` | `''` |
| `DateTime` | `DateTime` | `null` |
| `Boolean` | `Boolean` | `false` |

Any unrecognized DataType defaults to `String` with a default value of `''`.

##### Magic Column Name Overrides

| Column Name | Overridden Type |
|---|---|
| `CreateDate` | `CreateDate` |
| `CreatingIDUser` | `CreateIDUser` |
| `UpdateDate` | `UpdateDate` |
| `UpdatingIDUser` | `UpdateIDUser` |
| `DeleteDate` | `DeleteDate` |
| `DeletingIDUser` | `DeleteIDUser` |
| `Deleted` | `Deleted` |

---

## DatabaseProviderFactory

Bridges generic `ConnectionLibrary` configurations and the `meadow-connection-*`
provider modules. It creates connected database providers from a type and config,
and offers convenience methods for testing and introspecting connections. All three
interfaces (CLI, Terminal UI, Web) use this service to talk to live databases.

**Service type:** `'DatabaseProviderFactory'`
**Extends:** `fable.ServiceProviderBase`

On construction it attempts to `require` each of the four connector modules
(`meadow-connection-mysql`, `meadow-connection-postgresql`, `meadow-connection-mssql`,
`meadow-connection-sqlite`). Each is optional -- a module that is not installed is
simply absent from the available-providers list. All four are declared as
dependencies of this package, so by default every type is available.

### Config Mapping

A generic connection config -- `{ server, port, user, password, database }` -- is
mapped to each provider's expected shape. SQLite uses the `database` value as the
file path (defaulting to `:memory:`); the other engines map `server`/`host`,
`port`, `user`, `password`, and `database` into their nested option blocks with
per-engine port defaults (MySQL 3306, PostgreSQL 5432, MSSQL 1433).

### Methods

#### `listAvailableProviders()`

**Returns:** `Array<string>` -- the provider type names that are installed (e.g.
`['MySQL', 'PostgreSQL', 'MSSQL', 'SQLite']`).

#### `isProviderAvailable(pType)`

**Returns:** `boolean` -- whether the given provider type is installed.

#### `createProvider(pType, pConfig, fCallback)`

Instantiate the appropriate connector, map the config, connect, and return the
ready-to-use provider.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pType` | `string` | `'MySQL'`, `'PostgreSQL'`, `'MSSQL'`, or `'SQLite'` |
| `pConfig` | `Object` | Generic connection config |
| `fCallback` | `function` | Callback: `(pError, pProvider)` |

Returns an error when the provider type is not available, listing the installed
types.

#### `createProviderFromConnection(pConnectionName, fCallback)`

Look up a named connection in `ConnectionLibrary` and create a connected provider
from it.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pConnectionName` | `string` | Name of a connection in the library |
| `fCallback` | `function` | Callback: `(pError, pProvider, pConnectionEntry)` |

#### `testConnection(pConnectionName, fCallback)`

Connect a named connection and list its tables. Callback: `(pError, pTableList)`
where `pTableList` is `Array`.

#### `testConnectionConfig(pType, pConfig, fCallback)`

Test a type + config without requiring a saved entry. Callback: `(pError, pTableList)`.

#### `introspectConnection(pConnectionName, fCallback)`

Create a provider for a named connection, introspect the full database schema, store
the result in `fable.AppData.MigrationManager.IntrospectionResult`, and return it.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pConnectionName` | `string` | Name of a connection in the library |
| `fCallback` | `function` | Callback: `(pError, pSchema)` where `pSchema` is `{ Tables: [...] }` |

#### `introspectConnectionConfig(pType, pConfig, fCallback)`

Introspect by type + config without a saved entry. Callback: `(pError, pSchema)`.

```js
let tmpFactory = tmpManager.instantiateServiceProvider('DatabaseProviderFactory');

tmpFactory.introspectConnection('local-mysql',
	(pError, pSchema) =>
	{
		// pSchema.Tables is an array of { TableName, Columns, ... }
	});
```
