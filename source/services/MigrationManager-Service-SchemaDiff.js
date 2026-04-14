/**
 * Meadow Migration Manager - Schema Diff Service
 *
 * Compares two DDL-level schemas and produces a structured diff describing
 * the tables, columns, indices, and foreign keys that have been added,
 * removed, or modified between a source schema and a target schema.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libFableServiceBase = require('fable').ServiceProviderBase;

/**
 * Service that compares two DDL-level schemas and returns a structured diff.
 */
class MigrationManagerServiceSchemaDiff extends libFableServiceBase
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

		this.serviceType = 'SchemaDiff';
	}

	/**
	 * Resolve all relationships for a table, including explicit ForeignKeys
	 * and inferred joins from column-level Join (-> syntax) and TableJoin
	 * (=> syntax) properties.
	 *
	 * @param {Object} pTable - A single table object
	 * @param {Array}  pAllTables - All tables in the schema (for resolving Join targets)
	 *
	 * @return {Array} Array of { Column, ReferencesTable, ReferencesColumn } objects
	 */
	_resolveTableRelationships(pTable, pAllTables)
	{
		let tmpRelationships = [];
		let tmpForeignKeys = Array.isArray(pTable.ForeignKeys) ? pTable.ForeignKeys : [];
		let tmpColumns = Array.isArray(pTable.Columns) ? pTable.Columns : [];
		let tmpResolvedColumns = {};

		// First: add explicit ForeignKeys entries
		for (let i = 0; i < tmpForeignKeys.length; i++)
		{
			let tmpFK = tmpForeignKeys[i];
			tmpRelationships.push(tmpFK);
			tmpResolvedColumns[tmpFK.Column] = true;
		}

		// Second: infer from column-level Join property (-> syntax)
		for (let i = 0; i < tmpColumns.length; i++)
		{
			let tmpCol = tmpColumns[i];

			// Skip columns already resolved via explicit ForeignKeys
			if (tmpResolvedColumns[tmpCol.Column])
			{
				continue;
			}

			if (tmpCol.Join)
			{
				let tmpJoinColumn = tmpCol.Join;

				// Search all tables for the referenced PK column
				for (let k = 0; k < pAllTables.length; k++)
				{
					let tmpOtherTable = pAllTables[k];

					if (tmpOtherTable.TableName === pTable.TableName)
					{
						continue;
					}

					let tmpOtherCols = Array.isArray(tmpOtherTable.Columns) ? tmpOtherTable.Columns : [];

					for (let m = 0; m < tmpOtherCols.length; m++)
					{
						if (tmpOtherCols[m].Column === tmpJoinColumn && tmpOtherCols[m].DataType === 'ID')
						{
							tmpRelationships.push(
							{
								Column: tmpCol.Column,
								ReferencesTable: tmpOtherTable.TableName,
								ReferencesColumn: tmpJoinColumn
							});
							tmpResolvedColumns[tmpCol.Column] = true;
						}
					}
				}
			}

			// Handle TableJoin (=> syntax) — table-level join without column specificity
			if (tmpCol.TableJoin && !tmpResolvedColumns[tmpCol.Column])
			{
				tmpRelationships.push(
				{
					Column: tmpCol.Column,
					ReferencesTable: tmpCol.TableJoin,
					ReferencesColumn: ''
				});
				tmpResolvedColumns[tmpCol.Column] = true;
			}
		}

		return tmpRelationships;
	}

	/**
	 * Compare two DDL-level schemas and return a structured diff.
	 *
	 * Each schema is expected to have a `Tables` array where each entry has
	 * `TableName`, `Columns`, `Indices`, and optionally `ForeignKeys` properties.
	 * Relationships can also be inferred from column-level Join and TableJoin
	 * properties (MicroDDL -> and => syntax).
	 *
	 * @param {Object} pSourceSchema - The source (existing) schema
	 * @param {Object} pSourceSchema.Tables - Array of table objects in the source
	 * @param {Object} pTargetSchema - The target (desired) schema
	 * @param {Object} pTargetSchema.Tables - Array of table objects in the target
	 *
	 * @return {Object} A diff result with TablesAdded, TablesRemoved, and TablesModified arrays
	 */
	diffSchemas(pSourceSchema, pTargetSchema)
	{
		let tmpDiffResult = {
			TablesAdded: [],
			TablesRemoved: [],
			TablesModified: []
		};

		let tmpSourceTables = Array.isArray(pSourceSchema.Tables) ? pSourceSchema.Tables : [];
		let tmpTargetTables = Array.isArray(pTargetSchema.Tables) ? pTargetSchema.Tables : [];

		// Build lookup maps by TableName
		let tmpSourceTableMap = {};
		for (let i = 0; i < tmpSourceTables.length; i++)
		{
			tmpSourceTableMap[tmpSourceTables[i].TableName] = tmpSourceTables[i];
		}

		let tmpTargetTableMap = {};
		for (let i = 0; i < tmpTargetTables.length; i++)
		{
			tmpTargetTableMap[tmpTargetTables[i].TableName] = tmpTargetTables[i];
		}

		// Tables in target but not in source are added
		for (let i = 0; i < tmpTargetTables.length; i++)
		{
			if (!tmpSourceTableMap.hasOwnProperty(tmpTargetTables[i].TableName))
			{
				tmpDiffResult.TablesAdded.push(tmpTargetTables[i]);
			}
		}

		// Tables in source but not in target are removed
		for (let i = 0; i < tmpSourceTables.length; i++)
		{
			if (!tmpTargetTableMap.hasOwnProperty(tmpSourceTables[i].TableName))
			{
				tmpDiffResult.TablesRemoved.push(tmpSourceTables[i]);
			}
		}

		// Tables in both require a detailed comparison
		for (let i = 0; i < tmpTargetTables.length; i++)
		{
			let tmpTableName = tmpTargetTables[i].TableName;

			if (tmpSourceTableMap.hasOwnProperty(tmpTableName))
			{
				let tmpTableDiff = this.diffTables(tmpSourceTableMap[tmpTableName], tmpTargetTableMap[tmpTableName], tmpSourceTables, tmpTargetTables);

				if (this.hasChanges(tmpTableDiff))
				{
					tmpDiffResult.TablesModified.push(tmpTableDiff);
				}
			}
		}

		return tmpDiffResult;
	}

	/**
	 * Compare a single source table to a single target table.
	 *
	 * Produces a detailed diff of columns (added, removed, modified),
	 * indices (added, removed), and foreign keys / relationships (added, removed).
	 *
	 * Relationships are resolved from both explicit ForeignKeys arrays and
	 * column-level Join / TableJoin properties (MicroDDL -> and => syntax).
	 *
	 * @param {Object} pSourceTable - The source table definition
	 * @param {Object} pTargetTable - The target table definition
	 * @param {Array}  [pSourceAllTables] - All source tables (for Join resolution)
	 * @param {Array}  [pTargetAllTables] - All target tables (for Join resolution)
	 *
	 * @return {Object} A table-level diff result
	 */
	diffTables(pSourceTable, pTargetTable, pSourceAllTables, pTargetAllTables)
	{
		let tmpTableDiff = {
			TableName: pTargetTable.TableName,
			ColumnsAdded: [],
			ColumnsRemoved: [],
			ColumnsModified: [],
			IndicesAdded: [],
			IndicesRemoved: [],
			ForeignKeysAdded: [],
			ForeignKeysRemoved: []
		};

		// -- Diff columns --
		let tmpSourceColumns = Array.isArray(pSourceTable.Columns) ? pSourceTable.Columns : [];
		let tmpTargetColumns = Array.isArray(pTargetTable.Columns) ? pTargetTable.Columns : [];

		let tmpSourceColumnMap = {};
		for (let i = 0; i < tmpSourceColumns.length; i++)
		{
			tmpSourceColumnMap[tmpSourceColumns[i].Column] = tmpSourceColumns[i];
		}

		let tmpTargetColumnMap = {};
		for (let i = 0; i < tmpTargetColumns.length; i++)
		{
			tmpTargetColumnMap[tmpTargetColumns[i].Column] = tmpTargetColumns[i];
		}

		// Columns in target but not in source
		for (let i = 0; i < tmpTargetColumns.length; i++)
		{
			if (!tmpSourceColumnMap.hasOwnProperty(tmpTargetColumns[i].Column))
			{
				tmpTableDiff.ColumnsAdded.push(tmpTargetColumns[i]);
			}
		}

		// Columns in source but not in target
		for (let i = 0; i < tmpSourceColumns.length; i++)
		{
			if (!tmpTargetColumnMap.hasOwnProperty(tmpSourceColumns[i].Column))
			{
				tmpTableDiff.ColumnsRemoved.push(tmpSourceColumns[i]);
			}
		}

		// Columns in both -- check for property-level modifications
		for (let i = 0; i < tmpTargetColumns.length; i++)
		{
			let tmpColumnName = tmpTargetColumns[i].Column;

			if (tmpSourceColumnMap.hasOwnProperty(tmpColumnName))
			{
				let tmpSourceCol = tmpSourceColumnMap[tmpColumnName];
				let tmpTargetCol = tmpTargetColumnMap[tmpColumnName];
				let tmpChanges = {};
				let tmpHasColumnChanges = false;

				// Compare DataType — treat ForeignKey and Numeric as equivalent
				// because they map to the same native type in all engines (e.g.
				// INT NOT NULL DEFAULT 0 in MSSQL).  Introspection may return
				// Numeric for columns that the schema defines as ForeignKey when
				// the database lacks explicit FK constraints.
				if (tmpSourceCol.DataType !== tmpTargetCol.DataType
					&& !this._areEquivalentDataTypes(tmpSourceCol.DataType, tmpTargetCol.DataType))
				{
					tmpChanges.DataType = { From: tmpSourceCol.DataType, To: tmpTargetCol.DataType };
					tmpHasColumnChanges = true;
				}

				// Compare Size — only meaningful for DataTypes whose native SQL
				// type actually varies by Size (GUID, String, Decimal).  For
				// Numeric, ForeignKey, Boolean, DateTime, Text, and ID, Size is
				// a DDL-level hint (e.g. "int") that every MigrationGenerator
				// ignores; treating it as a delta would cause spurious ALTERs
				// on every run (introspection returns Size:'' for INT columns
				// while meadow models emit Size:'int' for Numeric).
				//
				// Normalize empty string, undefined, and absent Size as
				// equivalent ("no specific size").
				let tmpEffectiveDataType = tmpChanges.DataType ? tmpTargetCol.DataType : tmpSourceCol.DataType;
				if (this._isSizeSignificantForDataType(tmpEffectiveDataType))
				{
					let tmpSourceSize = tmpSourceCol.hasOwnProperty('Size') ? tmpSourceCol.Size : '';
					let tmpTargetSize = tmpTargetCol.hasOwnProperty('Size') ? tmpTargetCol.Size : '';
					let tmpNormSourceSize = (tmpSourceSize === null || tmpSourceSize === undefined) ? '' : String(tmpSourceSize);
					let tmpNormTargetSize = (tmpTargetSize === null || tmpTargetSize === undefined) ? '' : String(tmpTargetSize);
					if (tmpNormSourceSize !== tmpNormTargetSize)
					{
						tmpChanges.Size = { From: tmpSourceSize, To: tmpTargetSize };
						tmpHasColumnChanges = true;
					}
				}

				// Compare Indexed
				let tmpSourceIndexed = tmpSourceCol.hasOwnProperty('Indexed') ? tmpSourceCol.Indexed : undefined;
				let tmpTargetIndexed = tmpTargetCol.hasOwnProperty('Indexed') ? tmpTargetCol.Indexed : undefined;
				if (tmpSourceIndexed !== tmpTargetIndexed)
				{
					tmpChanges.Indexed = { From: tmpSourceIndexed, To: tmpTargetIndexed };
					tmpHasColumnChanges = true;
				}

				// Compare IndexName
				let tmpSourceIndexName = tmpSourceCol.hasOwnProperty('IndexName') ? tmpSourceCol.IndexName : undefined;
				let tmpTargetIndexName = tmpTargetCol.hasOwnProperty('IndexName') ? tmpTargetCol.IndexName : undefined;
				if (tmpSourceIndexName !== tmpTargetIndexName)
				{
					tmpChanges.IndexName = { From: tmpSourceIndexName, To: tmpTargetIndexName };
					tmpHasColumnChanges = true;
				}

				if (tmpHasColumnChanges)
				{
					tmpTableDiff.ColumnsModified.push({
						Column: tmpColumnName,
						// Include target column DataType and Size so MigrationGenerator
						// can produce valid ALTER statements for size-only changes
						DataType: tmpTargetCol.DataType,
						Size: tmpTargetCol.hasOwnProperty('Size') ? tmpTargetCol.Size : undefined,
						Changes: tmpChanges
					});
				}
			}
		}

		// -- Diff indices --
		let tmpSourceIndices = Array.isArray(pSourceTable.Indices) ? pSourceTable.Indices : [];
		let tmpTargetIndices = Array.isArray(pTargetTable.Indices) ? pTargetTable.Indices : [];

		let tmpSourceIndexMap = {};
		for (let i = 0; i < tmpSourceIndices.length; i++)
		{
			tmpSourceIndexMap[tmpSourceIndices[i].Name] = tmpSourceIndices[i];
		}

		let tmpTargetIndexMap = {};
		for (let i = 0; i < tmpTargetIndices.length; i++)
		{
			tmpTargetIndexMap[tmpTargetIndices[i].Name] = tmpTargetIndices[i];
		}

		// Indices in target but not in source
		for (let i = 0; i < tmpTargetIndices.length; i++)
		{
			if (!tmpSourceIndexMap.hasOwnProperty(tmpTargetIndices[i].Name))
			{
				tmpTableDiff.IndicesAdded.push(tmpTargetIndices[i]);
			}
		}

		// Indices in source but not in target
		for (let i = 0; i < tmpSourceIndices.length; i++)
		{
			if (!tmpTargetIndexMap.hasOwnProperty(tmpSourceIndices[i].Name))
			{
				tmpTableDiff.IndicesRemoved.push(tmpSourceIndices[i]);
			}
		}

		// -- Diff foreign keys / relationships --
		let tmpSourceAllTables = Array.isArray(pSourceAllTables) ? pSourceAllTables : [pSourceTable];
		let tmpTargetAllTables = Array.isArray(pTargetAllTables) ? pTargetAllTables : [pTargetTable];
		let tmpSourceForeignKeys = this._resolveTableRelationships(pSourceTable, tmpSourceAllTables);
		let tmpTargetForeignKeys = this._resolveTableRelationships(pTargetTable, tmpTargetAllTables);

		let tmpSourceFKMap = {};
		for (let i = 0; i < tmpSourceForeignKeys.length; i++)
		{
			tmpSourceFKMap[tmpSourceForeignKeys[i].Column] = tmpSourceForeignKeys[i];
		}

		let tmpTargetFKMap = {};
		for (let i = 0; i < tmpTargetForeignKeys.length; i++)
		{
			tmpTargetFKMap[tmpTargetForeignKeys[i].Column] = tmpTargetForeignKeys[i];
		}

		// Foreign keys in target but not in source
		for (let i = 0; i < tmpTargetForeignKeys.length; i++)
		{
			if (!tmpSourceFKMap.hasOwnProperty(tmpTargetForeignKeys[i].Column))
			{
				tmpTableDiff.ForeignKeysAdded.push(tmpTargetForeignKeys[i]);
			}
		}

		// Foreign keys in source but not in target
		for (let i = 0; i < tmpSourceForeignKeys.length; i++)
		{
			if (!tmpTargetFKMap.hasOwnProperty(tmpSourceForeignKeys[i].Column))
			{
				tmpTableDiff.ForeignKeysRemoved.push(tmpSourceForeignKeys[i]);
			}
		}

		return tmpTableDiff;
	}

	/**
	 * Check whether two Meadow DataTypes are functionally equivalent.
	 *
	 * ForeignKey and Numeric map to the same native type in all engines
	 * (e.g. INT NOT NULL DEFAULT 0 in MSSQL).  Database introspection may
	 * return Numeric for columns that the schema defines as ForeignKey
	 * when the database lacks explicit FK constraints.
	 *
	 * @param {string} pTypeA - First DataType
	 * @param {string} pTypeB - Second DataType
	 *
	 * @return {boolean} True if the types are equivalent
	 */
	_areEquivalentDataTypes(pTypeA, pTypeB)
	{
		// ForeignKey and Numeric are equivalent
		if ((pTypeA === 'ForeignKey' && pTypeB === 'Numeric')
			|| (pTypeA === 'Numeric' && pTypeB === 'ForeignKey'))
		{
			return true;
		}
		return false;
	}

	/**
	 * Check whether the Size property affects the native SQL type produced
	 * by MigrationGenerator for the given Meadow DataType.
	 *
	 * Size is only meaningful for types whose native SQL form includes a
	 * length or precision (GUID → CHAR/NCHAR(N), String → VARCHAR/NVARCHAR(N),
	 * Decimal → DECIMAL(precision[,scale])).  For all other types (Numeric,
	 * ForeignKey, Boolean, DateTime, Text, ID) the MigrationGenerator maps
	 * to a fixed native type and ignores Size entirely.
	 *
	 * @param {string} pDataType - The Meadow DataType
	 *
	 * @return {boolean} True if Size affects the native type
	 */
	_isSizeSignificantForDataType(pDataType)
	{
		return (pDataType === 'GUID' || pDataType === 'String' || pDataType === 'Decimal');
	}

	/**
	 * Check whether a table diff object contains any changes.
	 *
	 * @param {Object} pTableDiff - A table diff result from diffTables()
	 *
	 * @return {boolean} True if any of the diff arrays have entries
	 */
	hasChanges(pTableDiff)
	{
		return (
			(pTableDiff.ColumnsAdded.length > 0) ||
			(pTableDiff.ColumnsRemoved.length > 0) ||
			(pTableDiff.ColumnsModified.length > 0) ||
			(pTableDiff.IndicesAdded.length > 0) ||
			(pTableDiff.IndicesRemoved.length > 0) ||
			(pTableDiff.ForeignKeysAdded.length > 0) ||
			(pTableDiff.ForeignKeysRemoved.length > 0)
		);
	}
}

module.exports = MigrationManagerServiceSchemaDiff;

/** @type {Record<string, any>} */
MigrationManagerServiceSchemaDiff.default_configuration = {};
