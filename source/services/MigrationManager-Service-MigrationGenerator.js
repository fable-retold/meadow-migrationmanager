/**
 * Meadow Migration Manager - Migration Generator Service
 *
 * Converts a schema diff (produced by the SchemaDiff service) into executable
 * SQL migration statements for MySQL, PostgreSQL, MSSQL, or SQLite.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libFableServiceBase = require('fable').ServiceProviderBase;

/**
 * Service that generates SQL migration statements from schema diffs.
 */
class MigrationManagerServiceMigrationGenerator extends libFableServiceBase
{
	/**
	 * @param {Object} pFable - The Fable Framework instance
	 * @param {Object} pOptions - The options for the service
	 * @param {String} pServiceHash - The hash of the service
	 */
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		/** @type {any} */
		this.log;

		this.serviceType = 'MigrationGenerator';
	}

	/**
	 * Quote a database identifier using the appropriate quoting style for the
	 * target database engine.
	 *
	 * @param {string} pName - The identifier to quote
	 * @param {string} pDatabaseType - The database engine ('MySQL'|'PostgreSQL'|'MSSQL'|'SQLite')
	 *
	 * @return {string} The quoted identifier
	 */
	_quoteIdentifier(pName, pDatabaseType)
	{
		switch (pDatabaseType)
		{
			case 'MySQL':
				return '`' + pName + '`';
			case 'PostgreSQL':
				return '"' + pName + '"';
			case 'MSSQL':
				return '[' + pName + ']';
			case 'SQLite':
				return '"' + pName + '"';
			default:
				return '`' + pName + '`';
		}
	}

	/**
	 * Map a Meadow DataType and Size to a native SQL column type for the
	 * specified database engine.
	 *
	 * @param {string} pDataType - The Meadow DataType (ID, GUID, String, Text, Numeric, Decimal, DateTime, Boolean, ForeignKey)
	 * @param {string} pSize - The column size specification
	 * @param {string} pDatabaseType - The database engine ('MySQL'|'PostgreSQL'|'MSSQL'|'SQLite')
	 *
	 * @return {string} The native SQL type string
	 */
	_mapDataTypeToNative(pDataType, pSize, pDatabaseType)
	{
		switch (pDatabaseType)
		{
			case 'MySQL':
				return this._mapDataTypeMySQL(pDataType, pSize);
			case 'PostgreSQL':
				return this._mapDataTypePostgreSQL(pDataType, pSize);
			case 'MSSQL':
				return this._mapDataTypeMSSQL(pDataType, pSize);
			case 'SQLite':
				return this._mapDataTypeSQLite(pDataType, pSize);
			default:
				return this._mapDataTypeMySQL(pDataType, pSize);
		}
	}

	/**
	 * Map a Meadow DataType to a MySQL native type.
	 *
	 * @param {string} pDataType - The Meadow DataType
	 * @param {string} pSize - The column size specification
	 *
	 * @return {string} The MySQL type string
	 */
	_mapDataTypeMySQL(pDataType, pSize)
	{
		switch (pDataType)
		{
			case 'ID':
				return 'INT UNSIGNED NOT NULL AUTO_INCREMENT';
			case 'GUID':
				return 'CHAR(' + (pSize || '36') + ') NOT NULL';
			case 'ForeignKey':
				return 'INT UNSIGNED NOT NULL DEFAULT 0';
			case 'Numeric':
				return 'INT NOT NULL DEFAULT 0';
			case 'Decimal':
				return 'DECIMAL(' + (pSize || '10,2') + ')';
			case 'String':
				return 'CHAR(' + (pSize || '64') + ') NOT NULL DEFAULT \'\'';
			case 'Text':
				return 'TEXT';
			case 'DateTime':
				return 'DATETIME';
			case 'Boolean':
				return 'TINYINT NOT NULL DEFAULT 0';
			default:
				return 'TEXT';
		}
	}

	/**
	 * Map a Meadow DataType to a PostgreSQL native type.
	 *
	 * @param {string} pDataType - The Meadow DataType
	 * @param {string} pSize - The column size specification
	 *
	 * @return {string} The PostgreSQL type string
	 */
	_mapDataTypePostgreSQL(pDataType, pSize)
	{
		switch (pDataType)
		{
			case 'ID':
				return 'SERIAL PRIMARY KEY';
			case 'GUID':
				return 'CHAR(' + (pSize || '36') + ') NOT NULL';
			case 'ForeignKey':
				return 'INTEGER NOT NULL DEFAULT 0';
			case 'Numeric':
				return 'INTEGER NOT NULL DEFAULT 0';
			case 'Decimal':
				return 'NUMERIC(' + (pSize || '10,2') + ')';
			case 'String':
				return 'VARCHAR(' + (pSize || '64') + ') NOT NULL DEFAULT \'\'';
			case 'Text':
				return 'TEXT';
			case 'DateTime':
				return 'TIMESTAMP';
			case 'Boolean':
				return 'BOOLEAN NOT NULL DEFAULT FALSE';
			default:
				return 'TEXT';
		}
	}

	/**
	 * Strip the DEFAULT clause from a native SQL type string.
	 *
	 * MSSQL does not allow DEFAULT in ALTER COLUMN statements — defaults must
	 * be managed as separate constraints.  This helper removes ' DEFAULT ...'
	 * from the end of a native type so it can be used in ALTER COLUMN.
	 *
	 * @param {string} pNativeType - The full native type string (may contain DEFAULT)
	 *
	 * @return {string} The type string without the DEFAULT clause
	 */
	_stripDefault(pNativeType)
	{
		let tmpDefaultIndex = pNativeType.indexOf(' DEFAULT ');
		if (tmpDefaultIndex > -1)
		{
			return pNativeType.substring(0, tmpDefaultIndex);
		}
		return pNativeType;
	}

	/**
	 * Extract the DEFAULT value from a native SQL type string.
	 *
	 * @param {string} pNativeType - The full native type string (may contain DEFAULT)
	 *
	 * @return {string|null} The default value expression, or null if none
	 */
	_extractDefault(pNativeType)
	{
		let tmpDefaultIndex = pNativeType.indexOf(' DEFAULT ');
		if (tmpDefaultIndex > -1)
		{
			return pNativeType.substring(tmpDefaultIndex + 9);
		}
		return null;
	}

	/**
	 * Generate a self-contained T-SQL batch for ALTER COLUMN that safely drops
	 * dependent objects (default constraints, check constraints, and indexes),
	 * alters the column, then recreates them.
	 *
	 * MSSQL raises "one or more objects access this column" when ALTER COLUMN
	 * is attempted on a column with dependent constraints or indexes.  This
	 * batch handles that by querying sys catalog views for dependents, dropping
	 * them, performing the ALTER, then recreating them.
	 *
	 * @param {string} pRawTableName - Unquoted table name
	 * @param {string} pRawColName   - Unquoted column name
	 * @param {string} pNativeType   - Full native type string (may include DEFAULT)
	 *
	 * @return {string} A complete T-SQL batch
	 */
	_generateMSSQLAlterColumnBatch(pRawTableName, pRawColName, pNativeType)
	{
		let tmpAlterType = this._stripDefault(pNativeType);
		let tmpDefaultValue = this._extractDefault(pNativeType);

		// Use a sanitized suffix for temp table and variable names to avoid collisions
		let tmpSuffix = pRawTableName + '_' + pRawColName;

		let tmpBatch = '';

		// -- Step 1: Drop default constraints --
		tmpBatch += 'DECLARE @dc_' + tmpSuffix + ' NVARCHAR(MAX) = N\'\';\n';
		tmpBatch += 'SELECT @dc_' + tmpSuffix + ' = @dc_' + tmpSuffix + ' + N\'ALTER TABLE ' + this._quoteIdentifier(pRawTableName, 'MSSQL') + ' DROP CONSTRAINT \' + QUOTENAME(dc.name) + N\'; \'\n';
		tmpBatch += 'FROM sys.default_constraints dc\n';
		tmpBatch += 'INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id\n';
		tmpBatch += 'WHERE dc.parent_object_id = OBJECT_ID(N\'' + pRawTableName + '\') AND c.name = N\'' + pRawColName + '\';\n';
		tmpBatch += 'IF LEN(@dc_' + tmpSuffix + ') > 0 EXEC sp_executesql @dc_' + tmpSuffix + ';\n\n';

		// -- Step 2: Drop check constraints --
		tmpBatch += 'DECLARE @cc_' + tmpSuffix + ' NVARCHAR(MAX) = N\'\';\n';
		tmpBatch += 'SELECT @cc_' + tmpSuffix + ' = @cc_' + tmpSuffix + ' + N\'ALTER TABLE ' + this._quoteIdentifier(pRawTableName, 'MSSQL') + ' DROP CONSTRAINT \' + QUOTENAME(cc.name) + N\'; \'\n';
		tmpBatch += 'FROM sys.check_constraints cc\n';
		tmpBatch += 'INNER JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id\n';
		tmpBatch += 'WHERE cc.parent_object_id = OBJECT_ID(N\'' + pRawTableName + '\') AND c.name = N\'' + pRawColName + '\';\n';
		tmpBatch += 'IF LEN(@cc_' + tmpSuffix + ') > 0 EXEC sp_executesql @cc_' + tmpSuffix + ';\n\n';

		// -- Step 3: Save index definitions and drop indexes --
		tmpBatch += 'IF OBJECT_ID(\'tempdb..#_ix_' + tmpSuffix + '\') IS NOT NULL DROP TABLE #_ix_' + tmpSuffix + ';\n';
		tmpBatch += 'CREATE TABLE #_ix_' + tmpSuffix + ' (IxName NVARCHAR(256), IsUnique BIT, KeyCols NVARCHAR(MAX), InclCols NVARCHAR(MAX));\n\n';

		tmpBatch += 'DECLARE @ixn_' + tmpSuffix + ' NVARCHAR(256), @ixu_' + tmpSuffix + ' BIT;\n';
		tmpBatch += 'DECLARE @ixk_' + tmpSuffix + ' NVARCHAR(MAX), @ixi_' + tmpSuffix + ' NVARCHAR(MAX);\n';
		tmpBatch += 'DECLARE _ix_cur_' + tmpSuffix + ' CURSOR LOCAL FAST_FORWARD FOR\n';
		tmpBatch += '    SELECT DISTINCT i.name, i.is_unique\n';
		tmpBatch += '    FROM sys.indexes i\n';
		tmpBatch += '    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id\n';
		tmpBatch += '    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id\n';
		tmpBatch += '    WHERE i.object_id = OBJECT_ID(N\'' + pRawTableName + '\') AND c.name = N\'' + pRawColName + '\'\n';
		tmpBatch += '      AND i.is_primary_key = 0 AND i.type IN (1, 2);\n';
		tmpBatch += 'OPEN _ix_cur_' + tmpSuffix + ';\n';
		tmpBatch += 'FETCH NEXT FROM _ix_cur_' + tmpSuffix + ' INTO @ixn_' + tmpSuffix + ', @ixu_' + tmpSuffix + ';\n';
		tmpBatch += 'WHILE @@FETCH_STATUS = 0\n';
		tmpBatch += 'BEGIN\n';
		tmpBatch += '    SET @ixk_' + tmpSuffix + ' = N\'\'; SET @ixi_' + tmpSuffix + ' = N\'\';\n';
		tmpBatch += '    SELECT @ixk_' + tmpSuffix + ' = @ixk_' + tmpSuffix + ' + CASE WHEN LEN(@ixk_' + tmpSuffix + ') > 0 THEN N\', \' ELSE N\'\' END + QUOTENAME(c.name)\n';
		tmpBatch += '    FROM sys.index_columns ic\n';
		tmpBatch += '    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id\n';
		tmpBatch += '    WHERE ic.object_id = OBJECT_ID(N\'' + pRawTableName + '\') AND ic.index_id = (\n';
		tmpBatch += '        SELECT index_id FROM sys.indexes WHERE object_id = OBJECT_ID(N\'' + pRawTableName + '\') AND name = @ixn_' + tmpSuffix + '\n';
		tmpBatch += '    ) AND ic.is_included_column = 0 ORDER BY ic.key_ordinal;\n';
		tmpBatch += '    SELECT @ixi_' + tmpSuffix + ' = @ixi_' + tmpSuffix + ' + CASE WHEN LEN(@ixi_' + tmpSuffix + ') > 0 THEN N\', \' ELSE N\'\' END + QUOTENAME(c.name)\n';
		tmpBatch += '    FROM sys.index_columns ic\n';
		tmpBatch += '    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id\n';
		tmpBatch += '    WHERE ic.object_id = OBJECT_ID(N\'' + pRawTableName + '\') AND ic.index_id = (\n';
		tmpBatch += '        SELECT index_id FROM sys.indexes WHERE object_id = OBJECT_ID(N\'' + pRawTableName + '\') AND name = @ixn_' + tmpSuffix + '\n';
		tmpBatch += '    ) AND ic.is_included_column = 1 ORDER BY ic.index_column_id;\n';
		tmpBatch += '    INSERT INTO #_ix_' + tmpSuffix + ' (IxName, IsUnique, KeyCols, InclCols)\n';
		tmpBatch += '    VALUES (@ixn_' + tmpSuffix + ', @ixu_' + tmpSuffix + ', @ixk_' + tmpSuffix + ', @ixi_' + tmpSuffix + ');\n';
		tmpBatch += '    EXEC(N\'DROP INDEX \' + QUOTENAME(@ixn_' + tmpSuffix + ') + N\' ON ' + this._quoteIdentifier(pRawTableName, 'MSSQL') + '\');\n';
		tmpBatch += '    FETCH NEXT FROM _ix_cur_' + tmpSuffix + ' INTO @ixn_' + tmpSuffix + ', @ixu_' + tmpSuffix + ';\n';
		tmpBatch += 'END;\n';
		tmpBatch += 'CLOSE _ix_cur_' + tmpSuffix + '; DEALLOCATE _ix_cur_' + tmpSuffix + ';\n\n';

		// -- Step 4: ALTER COLUMN --
		tmpBatch += 'ALTER TABLE ' + this._quoteIdentifier(pRawTableName, 'MSSQL') + ' ALTER COLUMN ' + this._quoteIdentifier(pRawColName, 'MSSQL') + ' ' + tmpAlterType + ';\n\n';

		// -- Step 5: Recreate indexes --
		tmpBatch += 'DECLARE _ix_re_' + tmpSuffix + ' CURSOR LOCAL FAST_FORWARD FOR\n';
		tmpBatch += '    SELECT IxName, IsUnique, KeyCols, InclCols FROM #_ix_' + tmpSuffix + ';\n';
		tmpBatch += 'OPEN _ix_re_' + tmpSuffix + ';\n';
		tmpBatch += 'FETCH NEXT FROM _ix_re_' + tmpSuffix + ' INTO @ixn_' + tmpSuffix + ', @ixu_' + tmpSuffix + ', @ixk_' + tmpSuffix + ', @ixi_' + tmpSuffix + ';\n';
		tmpBatch += 'WHILE @@FETCH_STATUS = 0\n';
		tmpBatch += 'BEGIN\n';
		tmpBatch += '    DECLARE @ixsql_' + tmpSuffix + ' NVARCHAR(MAX) = CASE WHEN @ixu_' + tmpSuffix + ' = 1 THEN N\'CREATE UNIQUE\' ELSE N\'CREATE\' END\n';
		tmpBatch += '        + N\' INDEX \' + QUOTENAME(@ixn_' + tmpSuffix + ') + N\' ON ' + this._quoteIdentifier(pRawTableName, 'MSSQL') + ' (\' + @ixk_' + tmpSuffix + ' + N\')\'\n';
		tmpBatch += '        + CASE WHEN LEN(@ixi_' + tmpSuffix + ') > 0 THEN N\' INCLUDE (\' + @ixi_' + tmpSuffix + ' + N\')\' ELSE N\'\' END;\n';
		tmpBatch += '    EXEC sp_executesql @ixsql_' + tmpSuffix + ';\n';
		tmpBatch += '    FETCH NEXT FROM _ix_re_' + tmpSuffix + ' INTO @ixn_' + tmpSuffix + ', @ixu_' + tmpSuffix + ', @ixk_' + tmpSuffix + ', @ixi_' + tmpSuffix + ';\n';
		tmpBatch += 'END;\n';
		tmpBatch += 'CLOSE _ix_re_' + tmpSuffix + '; DEALLOCATE _ix_re_' + tmpSuffix + ';\n';
		tmpBatch += 'DROP TABLE #_ix_' + tmpSuffix + ';\n\n';

		// -- Step 6: Re-add default constraint if applicable --
		if (tmpDefaultValue)
		{
			tmpBatch += 'ALTER TABLE ' + this._quoteIdentifier(pRawTableName, 'MSSQL') + ' ADD DEFAULT ' + tmpDefaultValue + ' FOR ' + this._quoteIdentifier(pRawColName, 'MSSQL') + ';\n';
		}

		return tmpBatch;
	}

	/**
	 * Map a Meadow DataType to an MSSQL native type.
	 *
	 * @param {string} pDataType - The Meadow DataType
	 * @param {string} pSize - The column size specification
	 *
	 * @return {string} The MSSQL type string
	 */
	_mapDataTypeMSSQL(pDataType, pSize)
	{
		switch (pDataType)
		{
			case 'ID':
				return 'INT IDENTITY(1,1) NOT NULL';
			case 'GUID':
				return 'NCHAR(' + (pSize || '36') + ') NOT NULL';
			case 'ForeignKey':
				return 'INT NOT NULL DEFAULT 0';
			case 'Numeric':
				return 'INT NOT NULL DEFAULT 0';
			case 'Decimal':
				return 'DECIMAL(' + (pSize || '10,2') + ')';
			case 'String':
				return 'NVARCHAR(' + (pSize || '64') + ') NOT NULL DEFAULT \'\'';
			case 'Text':
				return 'NVARCHAR(MAX)';
			case 'DateTime':
				return 'DATETIME2';
			case 'Boolean':
				return 'BIT NOT NULL DEFAULT 0';
			default:
				return 'NVARCHAR(MAX)';
		}
	}

	/**
	 * Map a Meadow DataType to a SQLite native type.
	 *
	 * @param {string} pDataType - The Meadow DataType
	 * @param {string} pSize - The column size specification
	 *
	 * @return {string} The SQLite type string
	 */
	_mapDataTypeSQLite(pDataType, pSize)
	{
		switch (pDataType)
		{
			case 'ID':
				return 'INTEGER PRIMARY KEY AUTOINCREMENT';
			case 'GUID':
				return 'TEXT NOT NULL';
			case 'ForeignKey':
				return 'INTEGER NOT NULL DEFAULT 0';
			case 'Numeric':
				return 'INTEGER NOT NULL DEFAULT 0';
			case 'Decimal':
				return 'REAL';
			case 'String':
				return 'TEXT NOT NULL DEFAULT \'\'';
			case 'Text':
				return 'TEXT';
			case 'DateTime':
				return 'TEXT';
			case 'Boolean':
				return 'INTEGER NOT NULL DEFAULT 0';
			default:
				return 'TEXT';
		}
	}

	/**
	 * Generate an array of SQL migration statements from a schema diff result.
	 *
	 * Handles table creation/removal, column addition/removal/modification,
	 * index creation/removal, and foreign key addition/removal across all
	 * supported database engines.
	 *
	 * @param {Object} pDiffResult - The diff result from SchemaDiff.diffSchemas()
	 * @param {Array}  pDiffResult.TablesAdded - Tables to create
	 * @param {Array}  pDiffResult.TablesRemoved - Tables to drop
	 * @param {Array}  pDiffResult.TablesModified - Tables with column/index/FK changes
	 * @param {string} pDatabaseType - The database engine ('MySQL'|'PostgreSQL'|'MSSQL'|'SQLite')
	 *
	 * @return {Array<string>} Array of SQL statements
	 */
	generateMigrationStatements(pDiffResult, pDatabaseType)
	{
		let tmpStatements = [];
		let tmpTablesAdded = Array.isArray(pDiffResult.TablesAdded) ? pDiffResult.TablesAdded : [];
		let tmpTablesRemoved = Array.isArray(pDiffResult.TablesRemoved) ? pDiffResult.TablesRemoved : [];
		let tmpTablesModified = Array.isArray(pDiffResult.TablesModified) ? pDiffResult.TablesModified : [];

		// -- CREATE TABLE statements for added tables --
		for (let i = 0; i < tmpTablesAdded.length; i++)
		{
			let tmpTable = tmpTablesAdded[i];
			let tmpTableName = this._quoteIdentifier(tmpTable.TableName, pDatabaseType);
			let tmpColumns = Array.isArray(tmpTable.Columns) ? tmpTable.Columns : [];
			let tmpColumnDefs = [];

			for (let j = 0; j < tmpColumns.length; j++)
			{
				let tmpColName = this._quoteIdentifier(tmpColumns[j].Column, pDatabaseType);
				let tmpColType = this._mapDataTypeToNative(tmpColumns[j].DataType, tmpColumns[j].Size, pDatabaseType);
				tmpColumnDefs.push('    ' + tmpColName + ' ' + tmpColType);
			}

			let tmpCreateStatement = 'CREATE TABLE ' + tmpTableName + ' (\n' + tmpColumnDefs.join(',\n') + '\n)';
			tmpStatements.push(tmpCreateStatement);
		}

		// Tables that exist in the source (live database) but not in the target
		// (DDL schema) are intentionally ignored — the migration should only
		// operate on tables that are part of the schema, not drop unrelated ones.

		// -- ALTER TABLE statements for modified tables --
		for (let i = 0; i < tmpTablesModified.length; i++)
		{
			let tmpTableMod = tmpTablesModified[i];
			let tmpTableName = this._quoteIdentifier(tmpTableMod.TableName, pDatabaseType);

			// Columns added
			let tmpColumnsAdded = Array.isArray(tmpTableMod.ColumnsAdded) ? tmpTableMod.ColumnsAdded : [];
			for (let j = 0; j < tmpColumnsAdded.length; j++)
			{
				let tmpColName = this._quoteIdentifier(tmpColumnsAdded[j].Column, pDatabaseType);
				let tmpColType = this._mapDataTypeToNative(tmpColumnsAdded[j].DataType, tmpColumnsAdded[j].Size, pDatabaseType);
				// MSSQL uses ADD without COLUMN keyword; other engines use ADD COLUMN
				let tmpAddKeyword = (pDatabaseType === 'MSSQL') ? 'ADD' : 'ADD COLUMN';
				tmpStatements.push('ALTER TABLE ' + tmpTableName + ' ' + tmpAddKeyword + ' ' + tmpColName + ' ' + tmpColType);
			}

			// Columns removed
			let tmpColumnsRemoved = Array.isArray(tmpTableMod.ColumnsRemoved) ? tmpTableMod.ColumnsRemoved : [];
			for (let j = 0; j < tmpColumnsRemoved.length; j++)
			{
				let tmpColName = this._quoteIdentifier(tmpColumnsRemoved[j].Column, pDatabaseType);
				let tmpStatement = 'ALTER TABLE ' + tmpTableName + ' DROP COLUMN ' + tmpColName;

				if (pDatabaseType === 'SQLite')
				{
					tmpStatement += ' -- NOTE: DROP COLUMN requires SQLite 3.35.0 or later';
				}

				tmpStatements.push(tmpStatement);
			}

			// Columns modified
			let tmpColumnsModified = Array.isArray(tmpTableMod.ColumnsModified) ? tmpTableMod.ColumnsModified : [];
			for (let j = 0; j < tmpColumnsModified.length; j++)
			{
				let tmpColMod = tmpColumnsModified[j];
				let tmpColName = this._quoteIdentifier(tmpColMod.Column, pDatabaseType);

				// Determine the target data type and size for the modified column.
				// If DataType changed, use the new value; otherwise fall back to the
				// target column's DataType carried on the diff entry by SchemaDiff.
				let tmpDataType = tmpColMod.Changes.DataType ? tmpColMod.Changes.DataType.To : (tmpColMod.DataType || null);
				let tmpSize = tmpColMod.Changes.Size ? tmpColMod.Changes.Size.To : (tmpColMod.hasOwnProperty('Size') ? tmpColMod.Size : null);

				// We need at least a DataType to generate valid ALTER syntax
				if (tmpDataType)
				{
					let tmpNativeType = this._mapDataTypeToNative(tmpDataType, tmpSize, pDatabaseType);

					switch (pDatabaseType)
					{
						case 'MySQL':
							tmpStatements.push('ALTER TABLE ' + tmpTableName + ' MODIFY COLUMN ' + tmpColName + ' ' + tmpNativeType);
							break;
						case 'PostgreSQL':
							tmpStatements.push('ALTER TABLE ' + tmpTableName + ' ALTER COLUMN ' + tmpColName + ' TYPE ' + tmpNativeType);
							break;
						case 'MSSQL':
							// MSSQL does not allow DEFAULT in ALTER COLUMN and raises
							// "one or more objects access this column" when dependent
							// constraints or indexes exist.  Generate a self-contained
							// batch that drops dependents, alters, and recreates them.
							tmpStatements.push(this._generateMSSQLAlterColumnBatch(tmpTableMod.TableName, tmpColMod.Column, tmpNativeType));
							break;
						case 'SQLite':
							tmpStatements.push('-- SQLite does not support ALTER COLUMN; manual migration required for column ' + tmpColMod.Column + ' in table ' + tmpTableMod.TableName);
							break;
						default:
							tmpStatements.push('ALTER TABLE ' + tmpTableName + ' MODIFY COLUMN ' + tmpColName + ' ' + tmpNativeType);
							break;
					}
				}
			}

			// Indices added
			let tmpIndicesAdded = Array.isArray(tmpTableMod.IndicesAdded) ? tmpTableMod.IndicesAdded : [];
			for (let j = 0; j < tmpIndicesAdded.length; j++)
			{
				let tmpIndex = tmpIndicesAdded[j];
				let tmpIndexName = this._quoteIdentifier(tmpIndex.Name, pDatabaseType);
				let tmpIndexColumns = Array.isArray(tmpIndex.Columns) ? tmpIndex.Columns.join(', ') : tmpIndex.Columns;
				tmpStatements.push('CREATE INDEX ' + tmpIndexName + ' ON ' + tmpTableName + ' (' + tmpIndexColumns + ')');
			}

			// Indices removed
			let tmpIndicesRemoved = Array.isArray(tmpTableMod.IndicesRemoved) ? tmpTableMod.IndicesRemoved : [];
			for (let j = 0; j < tmpIndicesRemoved.length; j++)
			{
				let tmpIndex = tmpIndicesRemoved[j];
				let tmpIndexName = this._quoteIdentifier(tmpIndex.Name, pDatabaseType);

				switch (pDatabaseType)
				{
					case 'MySQL':
						tmpStatements.push('DROP INDEX ' + tmpIndexName + ' ON ' + tmpTableName);
						break;
					case 'PostgreSQL':
						tmpStatements.push('DROP INDEX IF EXISTS ' + tmpIndexName);
						break;
					case 'MSSQL':
						tmpStatements.push('DROP INDEX ' + tmpIndexName + ' ON ' + tmpTableName);
						break;
					case 'SQLite':
						tmpStatements.push('DROP INDEX IF EXISTS ' + tmpIndexName);
						break;
					default:
						tmpStatements.push('DROP INDEX ' + tmpIndexName + ' ON ' + tmpTableName);
						break;
				}
			}

			// Foreign keys added
			let tmpForeignKeysAdded = Array.isArray(tmpTableMod.ForeignKeysAdded) ? tmpTableMod.ForeignKeysAdded : [];
			for (let j = 0; j < tmpForeignKeysAdded.length; j++)
			{
				let tmpFK = tmpForeignKeysAdded[j];
				let tmpFKName = this._quoteIdentifier('FK_' + tmpTableMod.TableName + '_' + tmpFK.Column, pDatabaseType);
				let tmpFKColumn = this._quoteIdentifier(tmpFK.Column, pDatabaseType);
				let tmpRefTable = this._quoteIdentifier(tmpFK.ReferencesTable, pDatabaseType);
				let tmpRefColumn = this._quoteIdentifier(tmpFK.ReferencesColumn, pDatabaseType);
				tmpStatements.push('ALTER TABLE ' + tmpTableName + ' ADD CONSTRAINT ' + tmpFKName + ' FOREIGN KEY (' + tmpFKColumn + ') REFERENCES ' + tmpRefTable + '(' + tmpRefColumn + ')');
			}

			// Foreign keys removed
			let tmpForeignKeysRemoved = Array.isArray(tmpTableMod.ForeignKeysRemoved) ? tmpTableMod.ForeignKeysRemoved : [];
			for (let j = 0; j < tmpForeignKeysRemoved.length; j++)
			{
				let tmpFK = tmpForeignKeysRemoved[j];
				let tmpFKName = this._quoteIdentifier('FK_' + tmpTableMod.TableName + '_' + tmpFK.Column, pDatabaseType);

				switch (pDatabaseType)
				{
					case 'MySQL':
						tmpStatements.push('ALTER TABLE ' + tmpTableName + ' DROP FOREIGN KEY ' + tmpFKName);
						break;
					case 'PostgreSQL':
						tmpStatements.push('ALTER TABLE ' + tmpTableName + ' DROP CONSTRAINT IF EXISTS ' + tmpFKName);
						break;
					case 'MSSQL':
						tmpStatements.push('ALTER TABLE ' + tmpTableName + ' DROP CONSTRAINT ' + tmpFKName);
						break;
					case 'SQLite':
						tmpStatements.push('-- SQLite does not support DROP FOREIGN KEY; manual migration required for foreign key on column ' + tmpFK.Column + ' in table ' + tmpTableMod.TableName);
						break;
					default:
						tmpStatements.push('ALTER TABLE ' + tmpTableName + ' DROP FOREIGN KEY ' + tmpFKName);
						break;
				}
			}
		}

		return tmpStatements;
	}

	/**
	 * Generate a complete migration script string from a schema diff.
	 *
	 * Joins all generated statements with semicolons and newlines, and prepends
	 * a header comment with a generation timestamp.
	 *
	 * @param {Object} pDiffResult - The diff result from SchemaDiff.diffSchemas()
	 * @param {string} pDatabaseType - The database engine ('MySQL'|'PostgreSQL'|'MSSQL'|'SQLite')
	 *
	 * @return {string} The complete migration script
	 */
	generateMigrationScript(pDiffResult, pDatabaseType)
	{
		let tmpStatements = this.generateMigrationStatements(pDiffResult, pDatabaseType);
		let tmpHeader = '-- Migration Script -- Generated ' + new Date().toJSON() + '\n-- Database Type: ' + pDatabaseType + '\n';

		if (tmpStatements.length === 0)
		{
			return tmpHeader + '\n-- No changes detected.\n';
		}

		return tmpHeader + '\n' + tmpStatements.join(';\n\n') + ';\n';
	}
}

module.exports = MigrationManagerServiceMigrationGenerator;

/** @type {Record<string, any>} */
MigrationManagerServiceMigrationGenerator.default_configuration = {};
