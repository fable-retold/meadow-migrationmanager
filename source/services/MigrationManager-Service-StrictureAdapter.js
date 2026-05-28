/**
 * Meadow Migration Manager - Stricture Adapter Service
 *
 * Wraps the Stricture compiler to convert MicroDDL text into compiled schema
 * objects and Meadow package JSON definitions. Handles temporary file
 * management for the compilation pipeline.
 *
 * The compilation flow:
 *   1. Write DDL text to a temporary file
 *   2. Instantiate the Stricture compiler service
 *   3. Run compileFile to produce JSON output
 *   4. Read and parse the Extended JSON output
 *   5. Optionally generate Meadow packages from the compiled schema
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libFS = require('fs');
const libPath = require('path');
const libOS = require('os');
const libMkdirp = require('mkdirp');
const libStricture = require('stricture');

const libFableServiceBase = require('fable').ServiceProviderBase;

/**
 * Service that wraps Stricture's compiler for DDL compilation and
 * Meadow package generation.
 */
class MigrationManagerServiceStrictureAdapter extends libFableServiceBase
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

		this.serviceType = 'StrictureAdapter';
	}

	/**
	 * Compile MicroDDL text into a Stricture schema object.
	 *
	 * Writes the DDL text to a temporary file, invokes the Stricture compiler
	 * service, reads the resulting Extended JSON output, and returns the parsed
	 * schema via callback.
	 *
	 * @param {string} pDDLText - The MicroDDL text to compile
	 * @param {function} fCallback - Callback invoked as fCallback(pError, pSchema)
	 */
	compileDDL(pDDLText, fCallback)
	{
		let tmpCallback = (typeof (fCallback) === 'function') ? fCallback : () => {};

		let tmpTempDir = libPath.join(libOS.tmpdir(), 'meadow-migrationmanager-' + Date.now());
		let tmpInputFile = libPath.join(tmpTempDir, 'input.mddl');
		let tmpOutputLocation = libPath.join(tmpTempDir, 'output') + libPath.sep;
		let tmpOutputPrefix = 'CompiledSchema';

		try
		{
			// Ensure temp directories exist
			libMkdirp.sync(tmpTempDir);
			libMkdirp.sync(tmpOutputLocation);

			// Write the DDL text to a temporary file
			libFS.writeFileSync(tmpInputFile, pDDLText, 'utf8');
		}
		catch (tmpError)
		{
			this.log.error(`StrictureAdapter: Error setting up temp files: ${tmpError}`);
			return tmpCallback(tmpError);
		}

		this.log.info('StrictureAdapter: Compiling DDL via Stricture...');

		// Instantiate the Stricture compiler, passing Product so log context is correct
		let tmpStricture = new libStricture({ Product: this.fable.settings.Product || 'MeadowMigrationManager' });
		let tmpCompiler = tmpStricture.instantiateServiceProvider('StrictureCompiler');

		tmpCompiler.compileFile(tmpInputFile, tmpOutputLocation, tmpOutputPrefix,
			(pError) =>
			{
				if (pError)
				{
					this.log.error(`StrictureAdapter: Stricture compilation error: ${pError}`);
					return tmpCallback(pError);
				}

				// Read the Extended JSON output
				let tmpExtendedFile = tmpOutputLocation + tmpOutputPrefix + '-Extended.json';

				try
				{
					let tmpRawJSON = libFS.readFileSync(tmpExtendedFile, 'utf8');
					let tmpSchema = JSON.parse(tmpRawJSON);

					// Stricture's MDDL grammar currently treats `+`-prefixed
					// lines as comments (see the test output's "Comment on
					// line #N" log lines). Until that lands upstream, parse
					// + index lines from the original MDDL text ourselves
					// and attach them as Tables[Name].Indices on the
					// compiled schema so MeadowPackageGenerator (and the
					// MigrationGenerator that consumes the package) get the
					// index information they need.
					this._attachNamedIndexes(pDDLText, tmpSchema);

					this.log.info('StrictureAdapter: DDL compilation successful.');
					return tmpCallback(null, tmpSchema);
				}
				catch (tmpReadError)
				{
					this.log.error(`StrictureAdapter: Error reading compiled output [${tmpExtendedFile}]: ${tmpReadError}`);
					return tmpCallback(tmpReadError);
				}
			});
	}

	/**
	 * Parse `+`-prefixed named-index lines from an MDDL source string and
	 * attach them to the compiled schema's per-table Indices array.
	 *
	 * Recognized syntax (one line per index):
	 *   +!IndexName Column1[, Column2, ...]   — unique  (alternate key)
	 *   +IndexName  Column1[, Column2, ...]   — non-unique (lookup index)
	 *
	 * Index lines apply to the table opened by the most recent `!TableName`
	 * line. Whitespace + trailing commas are tolerated; blank lines and any
	 * non-`+`/non-`!` lines pass through unchanged.
	 *
	 * Mutates pSchema in place; safe to call multiple times because each
	 * call rebuilds the per-table Indices array from the source text.
	 */
	_attachNamedIndexes(pDDLText, pSchema)
	{
		if (typeof pDDLText !== 'string' || !pSchema || !pSchema.Tables) { return; }
		let tmpLines = pDDLText.split(/\r?\n/);
		let tmpByTable = {};
		let tmpCurrent = null;
		for (let i = 0; i < tmpLines.length; i++)
		{
			let tmpLine = tmpLines[i];
			let tmpTrimmed = tmpLine.replace(/^\s+/, '');
			// `!TableName` opens a stanza. Trailing comments / inline notes
			// after the table name are tolerated.
			let tmpTableMatch = tmpTrimmed.match(/^!\s*([A-Za-z_][A-Za-z0-9_]*)/);
			if (tmpTableMatch)
			{
				tmpCurrent = tmpTableMatch[1];
				if (!tmpByTable[tmpCurrent]) { tmpByTable[tmpCurrent] = []; }
				continue;
			}
			// `+!Name Col, Col, ...` or `+Name Col, Col, ...`
			let tmpIndexMatch = tmpTrimmed.match(/^\+(!?)\s*([A-Za-z_][A-Za-z0-9_]*)\s+(.+?)\s*$/);
			if (tmpIndexMatch && tmpCurrent)
			{
				let tmpUnique = (tmpIndexMatch[1] === '!');
				let tmpName = tmpIndexMatch[2];
				let tmpColumns = tmpIndexMatch[3]
					.split(',')
					.map(function (pC) { return pC.trim(); })
					.filter(function (pC) { return pC.length > 0; });
				if (tmpColumns.length === 0) { continue; }
				tmpByTable[tmpCurrent].push({ Name: tmpName, Unique: tmpUnique, Columns: tmpColumns });
			}
		}
		// Attach to compiled schema. Stricture's Extended JSON exposes
		// Tables as either a hash keyed by table name or an array (the
		// pict.AppData.ModelIndices path uses the hash form, which is what
		// our test against `pSchema.Tables.User.Indices` expects).
		let tmpTables = pSchema.Tables;
		Object.keys(tmpByTable).forEach(function (pTableName)
		{
			let tmpEntries = tmpByTable[pTableName];
			if (tmpEntries.length === 0) { return; }
			let tmpTable = null;
			if (tmpTables && typeof tmpTables === 'object' && !Array.isArray(tmpTables))
			{
				tmpTable = tmpTables[pTableName];
			}
			else if (Array.isArray(tmpTables))
			{
				tmpTable = tmpTables.find(function (pT) { return pT && pT.TableName === pTableName; });
			}
			if (tmpTable)
			{
				tmpTable.Indices = tmpEntries;
			}
		});
	}

	/**
	 * Compile a MicroDDL file directly from its path on disk.
	 *
	 * Unlike compileDDL (which writes text to a temp file), this method compiles
	 * from the original file in place so that [Include ...] directives resolve
	 * correctly relative to the source directory. Only the output is written
	 * to a temporary directory.
	 *
	 * @param {string} pFilePath - Absolute path to the .mddl / .ddl file
	 * @param {function} fCallback - Callback invoked as fCallback(pError, pSchema)
	 */
	compileDDLFile(pFilePath, fCallback)
	{
		let tmpCallback = (typeof (fCallback) === 'function') ? fCallback : () => {};

		let tmpTempDir = libPath.join(libOS.tmpdir(), 'meadow-migrationmanager-' + Date.now());
		let tmpOutputLocation = libPath.join(tmpTempDir, 'output') + libPath.sep;
		let tmpOutputPrefix = 'CompiledSchema';

		try
		{
			// Only need a temp directory for the output
			libMkdirp.sync(tmpOutputLocation);
		}
		catch (tmpError)
		{
			this.log.error(`StrictureAdapter: Error setting up output directory: ${tmpError}`);
			return tmpCallback(tmpError);
		}

		this.log.info(`StrictureAdapter: Compiling DDL file [${pFilePath}] via Stricture...`);

		// Instantiate the Stricture compiler, passing Product so log context is correct
		let tmpStricture = new libStricture({ Product: this.fable.settings.Product || 'MeadowMigrationManager' });
		let tmpCompiler = tmpStricture.instantiateServiceProvider('StrictureCompiler');

		tmpCompiler.compileFile(pFilePath, tmpOutputLocation, tmpOutputPrefix,
			(pError) =>
			{
				if (pError)
				{
					this.log.error(`StrictureAdapter: Stricture compilation error: ${pError}`);
					return tmpCallback(pError);
				}

				// Read the Extended JSON output
				let tmpExtendedFile = tmpOutputLocation + tmpOutputPrefix + '-Extended.json';

				try
				{
					let tmpRawJSON = libFS.readFileSync(tmpExtendedFile, 'utf8');
					let tmpSchema = JSON.parse(tmpRawJSON);

					// Same `+`-prefixed named-index parser the inline
					// compileDDL path uses; see _attachNamedIndexes below.
					// Reads the original .mddl text off disk so [Include]
					// directives that pull in additional files are still
					// honored — only the top-level file is parsed for
					// index lines (matches Stricture's "comments live in
					// the source file" model).
					try
					{
						let tmpSourceText = libFS.readFileSync(pFilePath, 'utf8');
						this._attachNamedIndexes(tmpSourceText, tmpSchema);
					}
					catch (eRead)
					{
						this.log.warn(`StrictureAdapter: could not re-read source file for index parsing: ${eRead.message}`);
					}

					this.log.info('StrictureAdapter: DDL file compilation successful.');
					return tmpCallback(null, tmpSchema);
				}
				catch (tmpReadError)
				{
					this.log.error(`StrictureAdapter: Error reading compiled output [${tmpExtendedFile}]: ${tmpReadError}`);
					return tmpCallback(tmpReadError);
				}
			});
	}

	/**
	 * Compile a DDL file and generate Meadow packages in a single operation.
	 *
	 * Uses compileDDLFile for correct [Include ...] resolution, then
	 * generateMeadowPackages to build the Meadow package JSON objects.
	 *
	 * @param {string} pFilePath - Absolute path to the .mddl / .ddl file
	 * @param {function} fCallback - Callback invoked as fCallback(pError, pCompiledSchema, pMeadowPackages)
	 */
	compileFileAndGenerate(pFilePath, fCallback)
	{
		let tmpCallback = (typeof (fCallback) === 'function') ? fCallback : () => {};

		this.compileDDLFile(pFilePath,
			(pError, pCompiledSchema) =>
			{
				if (pError)
				{
					return tmpCallback(pError);
				}

				let tmpMeadowPackages = this.generateMeadowPackages(pCompiledSchema);

				this.log.info('StrictureAdapter: File compile and generate complete.');
				return tmpCallback(null, pCompiledSchema, tmpMeadowPackages);
			});
	}

	/**
	 * Generate Meadow package JSON objects from a compiled schema.
	 *
	 * Iterates each table in the compiled schema's Tables hash, mapping column
	 * DataTypes to Meadow schema types using the same type mapping as
	 * Stricture-Service-GenerateMeadow.js.
	 *
	 * Type mapping:
	 *   ID         -> AutoIdentity
	 *   GUID       -> AutoGUID
	 *   ForeignKey -> Integer
	 *   Numeric    -> Integer
	 *   Decimal    -> Decimal
	 *   String     -> String
	 *   Text       -> String
	 *   DateTime   -> DateTime
	 *   Boolean    -> Boolean
	 *
	 * Magic column name overrides:
	 *   CreateDate     -> CreateDate
	 *   CreatingIDUser -> CreateIDUser
	 *   UpdateDate     -> UpdateDate
	 *   UpdatingIDUser -> UpdateIDUser
	 *   Deleted        -> Deleted
	 *   DeleteDate     -> DeleteDate
	 *   DeletingIDUser -> DeleteIDUser
	 *
	 * @param {Object} pCompiledSchema - A compiled Stricture schema with Tables hash
	 *
	 * @return {Array<Object>} An array of Meadow package JSON objects
	 */
	generateMeadowPackages(pCompiledSchema)
	{
		let tmpPackages = [];

		if (!pCompiledSchema || !pCompiledSchema.Tables)
		{
			this.log.error('StrictureAdapter: No Tables found in compiled schema.');
			return tmpPackages;
		}

		let tmpTableKeys = Object.keys(pCompiledSchema.Tables);

		for (let i = 0; i < tmpTableKeys.length; i++)
		{
			let tmpTable = pCompiledSchema.Tables[tmpTableKeys[i]];
			let tmpPrimaryKey = 'ID' + tmpTable.TableName;

			// Find the actual primary key column
			for (let j = 0; j < tmpTable.Columns.length; j++)
			{
				if (tmpTable.Columns[j].DataType === 'ID')
				{
					tmpPrimaryKey = tmpTable.Columns[j].Column;
				}
			}

			let tmpMeadowModel =
			{
				Scope: tmpTable.TableName,
				DefaultIdentifier: tmpPrimaryKey,
				Domain: (typeof (tmpTable.Domain) === 'undefined') ? 'Default' : tmpTable.Domain,
				Schema: [],
				DefaultObject: {},
				JsonSchema:
				{
					title: tmpTable.TableName,
					type: 'object',
					properties: {},
					required: []
				},
				Authorization: {}
			};

			// Build the schema for each column
			for (let j = 0; j < tmpTable.Columns.length; j++)
			{
				let tmpColumnName = tmpTable.Columns[j].Column;
				let tmpColumnType = tmpTable.Columns[j].DataType;
				let tmpColumnSize = tmpTable.Columns[j].hasOwnProperty('Size') ? tmpTable.Columns[j].Size : 'Default';

				let tmpSchemaEntry = { Column: tmpColumnName, Type: 'Default' };

				// Map DataType to Meadow schema type and set default values
				switch (tmpColumnType)
				{
					case 'ID':
						tmpSchemaEntry.Type = 'AutoIdentity';
						tmpMeadowModel.DefaultObject[tmpColumnName] = 0;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
						tmpMeadowModel.JsonSchema.required.push(tmpColumnName);
						break;
					case 'GUID':
						tmpSchemaEntry.Type = 'AutoGUID';
						tmpMeadowModel.DefaultObject[tmpColumnName] = '0x0000000000000000';
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
						break;
					case 'ForeignKey':
						tmpSchemaEntry.Type = 'Integer';
						tmpMeadowModel.DefaultObject[tmpColumnName] = 0;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
						tmpMeadowModel.JsonSchema.required.push(tmpColumnName);
						break;
					case 'Numeric':
						tmpSchemaEntry.Type = 'Integer';
						tmpMeadowModel.DefaultObject[tmpColumnName] = 0;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
						break;
					case 'Decimal':
						tmpSchemaEntry.Type = 'Decimal';
						tmpMeadowModel.DefaultObject[tmpColumnName] = 0.0;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'number', size: tmpColumnSize };
						break;
					case 'String':
					case 'Text':
						tmpSchemaEntry.Type = 'String';
						tmpMeadowModel.DefaultObject[tmpColumnName] = '';
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
						break;
					case 'DateTime':
						tmpSchemaEntry.Type = 'DateTime';
						tmpMeadowModel.DefaultObject[tmpColumnName] = null;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
						break;
					case 'Boolean':
						tmpSchemaEntry.Type = 'Boolean';
						tmpMeadowModel.DefaultObject[tmpColumnName] = false;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'boolean', size: tmpColumnSize };
						break;
				}

				// Mark magic change-tracking columns
				switch (tmpColumnName)
				{
					case 'CreateDate':
						tmpSchemaEntry.Type = 'CreateDate';
						break;
					case 'CreatingIDUser':
						tmpSchemaEntry.Type = 'CreateIDUser';
						break;
					case 'UpdateDate':
						tmpSchemaEntry.Type = 'UpdateDate';
						break;
					case 'UpdatingIDUser':
						tmpSchemaEntry.Type = 'UpdateIDUser';
						break;
					case 'DeleteDate':
						tmpSchemaEntry.Type = 'DeleteDate';
						break;
					case 'DeletingIDUser':
						tmpSchemaEntry.Type = 'DeleteIDUser';
						break;
					case 'Deleted':
						tmpSchemaEntry.Type = 'Deleted';
						break;
				}

				tmpSchemaEntry.Size = tmpColumnSize;
				tmpMeadowModel.Schema.push(tmpSchemaEntry);
			}

			// Add authorization if present in the compiled schema
			if (pCompiledSchema.hasOwnProperty('Authorization') && pCompiledSchema.Authorization.hasOwnProperty(tmpTable.TableName))
			{
				tmpMeadowModel.Authorization = pCompiledSchema.Authorization[tmpTable.TableName];
			}

			// Carry named indices through so the connector's createIndex pipeline picks them up
			if (Array.isArray(tmpTable.Indices) && tmpTable.Indices.length > 0)
			{
				tmpMeadowModel.Indices = JSON.parse(JSON.stringify(tmpTable.Indices));
			}

			tmpPackages.push(tmpMeadowModel);
		}

		this.log.info(`StrictureAdapter: Generated ${tmpPackages.length} Meadow package(s).`);
		return tmpPackages;
	}

	/**
	 * Compile DDL text and generate Meadow packages in a single operation.
	 *
	 * Calls compileDDL to produce the compiled schema, then
	 * generateMeadowPackages to build the Meadow package JSON objects from
	 * the result.
	 *
	 * @param {string} pDDLText - The MicroDDL text to compile
	 * @param {function} fCallback - Callback invoked as fCallback(pError, pCompiledSchema, pMeadowPackages)
	 */
	compileAndGenerate(pDDLText, fCallback)
	{
		let tmpCallback = (typeof (fCallback) === 'function') ? fCallback : () => {};

		this.compileDDL(pDDLText,
			(pError, pCompiledSchema) =>
			{
				if (pError)
				{
					return tmpCallback(pError);
				}

				let tmpMeadowPackages = this.generateMeadowPackages(pCompiledSchema);

				this.log.info('StrictureAdapter: Compile and generate complete.');
				return tmpCallback(null, pCompiledSchema, tmpMeadowPackages);
			});
	}
}

module.exports = MigrationManagerServiceStrictureAdapter;

/** @type {Record<string, any>} */
MigrationManagerServiceStrictureAdapter.default_configuration = {};
