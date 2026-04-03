/**
 * Meadow Migration Manager - Unit Tests
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libAssert = require('assert');
const libFS = require('fs');
const libPath = require('path');
const libOS = require('os');

const libMeadowMigrationManager = require('../source/MeadowMigrationManager.js');

const _FixturePath = libPath.join(__dirname, 'fixtures');

suite
(
	'MeadowMigrationManager',
	function ()
	{
		// ================================================================
		// Main Class
		// ================================================================
		suite
		(
			'Main Class',
			function ()
			{
				test
				(
					'Should instantiate correctly',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						libAssert.ok(tmpManager, 'Manager should be created');
						libAssert.ok(tmpManager.AppData.MigrationManager, 'AppData.MigrationManager should exist');
						libAssert.ok(tmpManager.AppData.MigrationManager.Schemas, 'Schemas hash should exist');
						libAssert.ok(tmpManager.AppData.MigrationManager.Connections, 'Connections hash should exist');
					}
				);
			}
		);

		// ================================================================
		// SchemaLibrary Service
		// ================================================================
		suite
		(
			'SchemaLibrary Service',
			function ()
			{
				test
				(
					'Should add and retrieve a schema',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');
						let tmpEntry = tmpSchemaLib.addSchema('test-schema', '!Book\n@IDBook\n$Title 200\n');

						libAssert.strictEqual(tmpEntry.Name, 'test-schema');
						libAssert.ok(tmpEntry.DDL.indexOf('!Book') >= 0, 'DDL should contain the table definition');
						libAssert.strictEqual(tmpEntry.CompiledSchema, null);

						let tmpRetrieved = tmpSchemaLib.getSchema('test-schema');
						libAssert.strictEqual(tmpRetrieved.Name, 'test-schema');
					}
				);

				test
				(
					'Should list schema names',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');

						tmpSchemaLib.addSchema('alpha', '!A\n');
						tmpSchemaLib.addSchema('beta', '!B\n');

						let tmpNames = tmpSchemaLib.listSchemas();
						libAssert.ok(tmpNames.indexOf('alpha') >= 0, 'Should list alpha');
						libAssert.ok(tmpNames.indexOf('beta') >= 0, 'Should list beta');
						libAssert.strictEqual(tmpNames.length, 2);
					}
				);

				test
				(
					'Should remove a schema',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');

						tmpSchemaLib.addSchema('to-remove', '!X\n');
						libAssert.ok(tmpSchemaLib.getSchema('to-remove'), 'Schema should exist before removal');

						let tmpResult = tmpSchemaLib.removeSchema('to-remove');
						libAssert.strictEqual(tmpResult, true, 'removeSchema should return true');
						libAssert.strictEqual(tmpSchemaLib.getSchema('to-remove'), null, 'Schema should be null after removal');
					}
				);

				test
				(
					'Should return false when removing non-existent schema',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');
						libAssert.strictEqual(tmpSchemaLib.removeSchema('nonexistent'), false);
					}
				);

				test
				(
					'Should import a schema from file',
					function (fDone)
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');

						tmpSchemaLib.importSchemaFromFile(libPath.join(_FixturePath, 'bookstore.ddl'),
							function (pError, pEntry)
							{
								libAssert.ifError(pError);
								libAssert.strictEqual(pEntry.Name, 'bookstore');
								libAssert.ok(pEntry.DDL.indexOf('!Book') >= 0, 'DDL should contain Book table');
								libAssert.ok(pEntry.DDL.indexOf('!Author') >= 0, 'DDL should contain Author table');
								return fDone();
							});
					}
				);

				test
				(
					'Should save and load library',
					function (fDone)
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');

						tmpSchemaLib.addSchema('save-test', '!SaveTest\n@IDSaveTest\n');

						let tmpTempFile = libPath.join(libOS.tmpdir(), 'migration-test-lib-' + Date.now() + '.json');

						tmpSchemaLib.saveLibrary(tmpTempFile,
							function (pError)
							{
								libAssert.ifError(pError);

								// Load into a fresh manager
								let tmpManager2 = new libMeadowMigrationManager({});
								let tmpSchemaLib2 = tmpManager2.instantiateServiceProvider('SchemaLibrary');

								tmpSchemaLib2.loadLibrary(tmpTempFile,
									function (pError2)
									{
										libAssert.ifError(pError2);

										let tmpLoaded = tmpSchemaLib2.getSchema('save-test');
										libAssert.ok(tmpLoaded, 'Schema should be loaded');
										libAssert.strictEqual(tmpLoaded.Name, 'save-test');

										// Clean up
										try { libFS.unlinkSync(tmpTempFile); } catch(e) {}
										return fDone();
									});
							});
					}
				);
			}
		);

		// ================================================================
		// ConnectionLibrary Service
		// ================================================================
		suite
		(
			'ConnectionLibrary Service',
			function ()
			{
				test
				(
					'Should add and retrieve a connection',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpConnLib = tmpManager.instantiateServiceProvider('ConnectionLibrary');

						let tmpEntry = tmpConnLib.addConnection('local-sqlite', 'SQLite',
							{ database: '/tmp/test.db' });

						libAssert.strictEqual(tmpEntry.Name, 'local-sqlite');
						libAssert.strictEqual(tmpEntry.Type, 'SQLite');
						libAssert.ok(tmpEntry.Config.database, 'Config should have database');

						let tmpRetrieved = tmpConnLib.getConnection('local-sqlite');
						libAssert.strictEqual(tmpRetrieved.Type, 'SQLite');
					}
				);

				test
				(
					'Should list connection names',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpConnLib = tmpManager.instantiateServiceProvider('ConnectionLibrary');

						tmpConnLib.addConnection('conn-a', 'MySQL', {});
						tmpConnLib.addConnection('conn-b', 'PostgreSQL', {});

						let tmpNames = tmpConnLib.listConnections();
						libAssert.strictEqual(tmpNames.length, 2);
						libAssert.ok(tmpNames.indexOf('conn-a') >= 0);
						libAssert.ok(tmpNames.indexOf('conn-b') >= 0);
					}
				);

				test
				(
					'Should remove a connection',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpConnLib = tmpManager.instantiateServiceProvider('ConnectionLibrary');

						tmpConnLib.addConnection('to-remove', 'MSSQL', {});
						libAssert.strictEqual(tmpConnLib.removeConnection('to-remove'), true);
						libAssert.strictEqual(tmpConnLib.getConnection('to-remove'), null);
						libAssert.strictEqual(tmpConnLib.removeConnection('to-remove'), false);
					}
				);

				test
				(
					'Should load connections from ProgramConfiguration',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager(
							{
								ProgramConfiguration:
								{
									Connections:
									{
										'config-mysql':
										{
											Type: 'MySQL',
											Config: { server: 'localhost', port: 3306, user: 'root', database: 'testdb' }
										},
										'config-pg':
										{
											Type: 'PostgreSQL',
											Config: { server: '10.0.0.1', port: 5432, user: 'admin', database: 'app' }
										}
									}
								}
							});
						let tmpConnLib = tmpManager.instantiateServiceProvider('ConnectionLibrary');

						// loadFromConfiguration should pull connections from ProgramConfiguration
						tmpConnLib.loadFromConfiguration();

						let tmpNames = tmpConnLib.listConnections();
						libAssert.strictEqual(tmpNames.length, 2);

						let tmpMySQL = tmpConnLib.getConnection('config-mysql');
						libAssert.ok(tmpMySQL, 'config-mysql should exist');
						libAssert.strictEqual(tmpMySQL.Type, 'MySQL');
						libAssert.strictEqual(tmpMySQL.Config.database, 'testdb');

						let tmpPG = tmpConnLib.getConnection('config-pg');
						libAssert.ok(tmpPG, 'config-pg should exist');
						libAssert.strictEqual(tmpPG.Type, 'PostgreSQL');
						libAssert.strictEqual(tmpPG.Config.server, '10.0.0.1');
					}
				);

				test
				(
					'Should not overwrite existing connections with config connections',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager(
							{
								ProgramConfiguration:
								{
									Connections:
									{
										'my-db':
										{
											Type: 'PostgreSQL',
											Config: { server: 'config-server', database: 'config-db' }
										}
									}
								}
							});
						let tmpConnLib = tmpManager.instantiateServiceProvider('ConnectionLibrary');

						// Add a connection manually first
						tmpConnLib.addConnection('my-db', 'MySQL', { server: 'file-server', database: 'file-db' });

						// Now load from config — should NOT overwrite the existing entry
						tmpConnLib.loadFromConfiguration();

						let tmpConn = tmpConnLib.getConnection('my-db');
						libAssert.strictEqual(tmpConn.Type, 'MySQL', 'Should keep original type (MySQL not PostgreSQL)');
						libAssert.strictEqual(tmpConn.Config.server, 'file-server', 'Should keep original server');
					}
				);
			}
		);

		// ================================================================
		// StrictureAdapter Service
		// ================================================================
		suite
		(
			'StrictureAdapter Service',
			function ()
			{
				test
				(
					'Should compile DDL text',
					function (fDone)
					{
						this.timeout(15000);

						let tmpManager = new libMeadowMigrationManager({});
						let tmpAdapter = tmpManager.instantiateServiceProvider('StrictureAdapter');

						let tmpDDL = libFS.readFileSync(libPath.join(_FixturePath, 'bookstore.ddl'), 'utf8');

						tmpAdapter.compileDDL(tmpDDL,
							function (pError, pSchema)
							{
								libAssert.ifError(pError);
								libAssert.ok(pSchema, 'Schema should be returned');
								libAssert.ok(pSchema.Tables, 'Schema should have Tables');

								let tmpTableKeys = Object.keys(pSchema.Tables);
								libAssert.ok(tmpTableKeys.length >= 5, 'Should have at least 5 tables');

								// Check that Book table exists
								let tmpBookFound = false;
								for (let i = 0; i < tmpTableKeys.length; i++)
								{
									if (pSchema.Tables[tmpTableKeys[i]].TableName === 'Book')
									{
										tmpBookFound = true;
									}
								}
								libAssert.ok(tmpBookFound, 'Book table should exist in compiled schema');

								return fDone();
							});
					}
				);

				test
				(
					'Should generate Meadow packages from compiled schema',
					function (fDone)
					{
						this.timeout(15000);

						let tmpManager = new libMeadowMigrationManager({});
						let tmpAdapter = tmpManager.instantiateServiceProvider('StrictureAdapter');

						let tmpDDL = libFS.readFileSync(libPath.join(_FixturePath, 'bookstore.ddl'), 'utf8');

						tmpAdapter.compileAndGenerate(tmpDDL,
							function (pError, pSchema, pPackages)
							{
								libAssert.ifError(pError);
								libAssert.ok(pPackages, 'Packages should be returned');
								libAssert.ok(Array.isArray(pPackages), 'Packages should be an array');
								libAssert.ok(pPackages.length >= 5, 'Should have at least 5 packages');

								// Find the Book package
								let tmpBookPackage = null;
								for (let i = 0; i < pPackages.length; i++)
								{
									if (pPackages[i].Scope === 'Book')
									{
										tmpBookPackage = pPackages[i];
									}
								}

								libAssert.ok(tmpBookPackage, 'Book package should exist');
								libAssert.strictEqual(tmpBookPackage.DefaultIdentifier, 'IDBook');
								libAssert.ok(tmpBookPackage.Schema.length > 0, 'Schema should have entries');

								// Check type mapping
								let tmpIDEntry = tmpBookPackage.Schema.find((pEntry) => pEntry.Column === 'IDBook');
								libAssert.ok(tmpIDEntry, 'IDBook column should exist');
								libAssert.strictEqual(tmpIDEntry.Type, 'AutoIdentity');

								return fDone();
							});
					}
				);
			}
		);

		// ================================================================
		// MeadowPackageGenerator Service
		// ================================================================
		suite
		(
			'MeadowPackageGenerator Service',
			function ()
			{
				test
				(
					'Should generate a Meadow package from a table schema',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpGenerator = tmpManager.instantiateServiceProvider('MeadowPackageGenerator');

						let tmpTableSchema = {
							TableName: 'Book',
							Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'GUIDBook', DataType: 'GUID' },
								{ Column: 'CreateDate', DataType: 'DateTime' },
								{ Column: 'CreatingIDUser', DataType: 'Numeric' },
								{ Column: 'UpdateDate', DataType: 'DateTime' },
								{ Column: 'UpdatingIDUser', DataType: 'Numeric' },
								{ Column: 'Deleted', DataType: 'Boolean' },
								{ Column: 'Title', DataType: 'String', Size: '200' },
								{ Column: 'PublicationYear', DataType: 'Numeric' }
							]
						};

						let tmpPackage = tmpGenerator.generateFromTable(tmpTableSchema);

						libAssert.strictEqual(tmpPackage.Scope, 'Book');
						libAssert.strictEqual(tmpPackage.DefaultIdentifier, 'IDBook');

						// Check type mapping
						let tmpIDEntry = tmpPackage.Schema.find((pE) => pE.Column === 'IDBook');
						libAssert.strictEqual(tmpIDEntry.Type, 'AutoIdentity');

						let tmpGUIDEntry = tmpPackage.Schema.find((pE) => pE.Column === 'GUIDBook');
						libAssert.strictEqual(tmpGUIDEntry.Type, 'AutoGUID');

						// Check magic column overrides
						let tmpCreateDate = tmpPackage.Schema.find((pE) => pE.Column === 'CreateDate');
						libAssert.strictEqual(tmpCreateDate.Type, 'CreateDate');

						let tmpDeleted = tmpPackage.Schema.find((pE) => pE.Column === 'Deleted');
						libAssert.strictEqual(tmpDeleted.Type, 'Deleted');

						// Check defaults
						libAssert.strictEqual(tmpPackage.DefaultObject.IDBook, 0);
						libAssert.strictEqual(tmpPackage.DefaultObject.GUIDBook, '0x0000000000000000');
						libAssert.strictEqual(tmpPackage.DefaultObject.Title, '');
					}
				);

				test
				(
					'Should generate packages from a full DDL schema',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpGenerator = tmpManager.instantiateServiceProvider('MeadowPackageGenerator');

						let tmpSchema = {
							Tables: [
								{
									TableName: 'Author',
									Columns: [
										{ Column: 'IDAuthor', DataType: 'ID' },
										{ Column: 'Name', DataType: 'String', Size: '200' }
									]
								},
								{
									TableName: 'Book',
									Columns: [
										{ Column: 'IDBook', DataType: 'ID' },
										{ Column: 'Title', DataType: 'String', Size: '200' },
										{ Column: 'Price', DataType: 'Decimal', Size: '8,2' }
									]
								}
							]
						};

						let tmpPackages = tmpGenerator.generateFromDDLSchema(tmpSchema);
						libAssert.strictEqual(tmpPackages.length, 2);
						libAssert.strictEqual(tmpPackages[0].Scope, 'Author');
						libAssert.strictEqual(tmpPackages[1].Scope, 'Book');

						let tmpPriceEntry = tmpPackages[1].Schema.find((pE) => pE.Column === 'Price');
						libAssert.strictEqual(tmpPriceEntry.Type, 'Decimal');
					}
				);
			}
		);

		// ================================================================
		// SchemaDiff Service
		// ================================================================
		suite
		(
			'SchemaDiff Service',
			function ()
			{
				test
				(
					'Should detect added tables',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSource = { Tables: [
							{ TableName: 'Book', Columns: [{ Column: 'IDBook', DataType: 'ID' }] }
						]};
						let tmpTarget = { Tables: [
							{ TableName: 'Book', Columns: [{ Column: 'IDBook', DataType: 'ID' }] },
							{ TableName: 'Author', Columns: [{ Column: 'IDAuthor', DataType: 'ID' }] }
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesAdded.length, 1);
						libAssert.strictEqual(tmpResult.TablesAdded[0].TableName, 'Author');
						libAssert.strictEqual(tmpResult.TablesRemoved.length, 0);
						libAssert.strictEqual(tmpResult.TablesModified.length, 0);
					}
				);

				test
				(
					'Should detect removed tables',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSource = { Tables: [
							{ TableName: 'Book', Columns: [{ Column: 'IDBook', DataType: 'ID' }] },
							{ TableName: 'Author', Columns: [{ Column: 'IDAuthor', DataType: 'ID' }] }
						]};
						let tmpTarget = { Tables: [
							{ TableName: 'Book', Columns: [{ Column: 'IDBook', DataType: 'ID' }] }
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesRemoved.length, 1);
						libAssert.strictEqual(tmpResult.TablesRemoved[0].TableName, 'Author');
						libAssert.strictEqual(tmpResult.TablesAdded.length, 0);
					}
				);

				test
				(
					'Should detect added columns',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSource = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '200' }
							]}
						]};
						let tmpTarget = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '200' },
								{ Column: 'Genre', DataType: 'String', Size: '128' }
							]}
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesModified.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsAdded.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsAdded[0].Column, 'Genre');
					}
				);

				test
				(
					'Should detect removed columns',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSource = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '200' },
								{ Column: 'OldField', DataType: 'String', Size: '100' }
							]}
						]};
						let tmpTarget = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '200' }
							]}
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesModified.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsRemoved.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsRemoved[0].Column, 'OldField');
					}
				);

				test
				(
					'Should detect modified columns (size change)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSource = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '200' }
							]}
						]};
						let tmpTarget = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '500' }
							]}
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesModified.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsModified.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsModified[0].Column, 'Title');
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsModified[0].Changes.Size.From, '200');
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsModified[0].Changes.Size.To, '500');
					}
				);

				test
				(
					'Should detect modified columns (data type change)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSource = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Rating', DataType: 'Numeric' }
							]}
						]};
						let tmpTarget = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Rating', DataType: 'Decimal', Size: '3,1' }
							]}
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesModified.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsModified[0].Changes.DataType.From, 'Numeric');
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsModified[0].Changes.DataType.To, 'Decimal');
					}
				);

				test
				(
					'Should not flag unchanged tables as modified',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSchema = { Tables: [
							{ TableName: 'Book', Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '200' }
							]}
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSchema, tmpSchema);
						libAssert.strictEqual(tmpResult.TablesAdded.length, 0);
						libAssert.strictEqual(tmpResult.TablesRemoved.length, 0);
						libAssert.strictEqual(tmpResult.TablesModified.length, 0);
					}
				);

				test
				(
					'Should detect index changes',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSource = { Tables: [
							{ TableName: 'Book', Columns: [{ Column: 'IDBook', DataType: 'ID' }],
								Indices: [{ Name: 'IX_Title', Columns: ['Title'], Unique: false }] }
						]};
						let tmpTarget = { Tables: [
							{ TableName: 'Book', Columns: [{ Column: 'IDBook', DataType: 'ID' }],
								Indices: [{ Name: 'IX_Genre', Columns: ['Genre'], Unique: false }] }
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesModified.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].IndicesAdded.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].IndicesAdded[0].Name, 'IX_Genre');
						libAssert.strictEqual(tmpResult.TablesModified[0].IndicesRemoved.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].IndicesRemoved[0].Name, 'IX_Title');
					}
				);

				test
				(
					'Should detect foreign key changes',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						let tmpSource = { Tables: [
							{ TableName: 'BookPrice', Columns: [{ Column: 'IDBookPrice', DataType: 'ID' }],
								ForeignKeys: [{ Column: 'IDBook', ReferencesTable: 'Book', ReferencesColumn: 'IDBook' }] }
						]};
						let tmpTarget = { Tables: [
							{ TableName: 'BookPrice', Columns: [{ Column: 'IDBookPrice', DataType: 'ID' }],
								ForeignKeys: [] }
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesModified.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ForeignKeysRemoved.length, 1);
						libAssert.strictEqual(tmpResult.TablesModified[0].ForeignKeysRemoved[0].Column, 'IDBook');
					}
				);

				test
				(
					'Should detect relationships from Join column properties (-> syntax)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpDiff = tmpManager.instantiateServiceProvider('SchemaDiff');

						// Source has no FK on Review
						let tmpSource = { Tables: [
							{ TableName: 'Book', Columns: [{ Column: 'IDBook', DataType: 'ID' }, { Column: 'Title', DataType: 'String' }] },
							{ TableName: 'Review', Columns: [{ Column: 'IDReview', DataType: 'ID' }, { Column: 'Text', DataType: 'Text' }] }
						]};
						// Target adds IDBook FK via Join property (from -> syntax)
						let tmpTarget = { Tables: [
							{ TableName: 'Book', Columns: [{ Column: 'IDBook', DataType: 'ID' }, { Column: 'Title', DataType: 'String' }] },
							{ TableName: 'Review', Columns: [{ Column: 'IDReview', DataType: 'ID' }, { Column: 'Text', DataType: 'Text' },
								{ Column: 'IDBook', DataType: 'ForeignKey', Join: 'IDBook' }] }
						]};

						let tmpResult = tmpDiff.diffSchemas(tmpSource, tmpTarget);
						libAssert.strictEqual(tmpResult.TablesModified.length, 1, 'Review should be modified');
						libAssert.strictEqual(tmpResult.TablesModified[0].ColumnsAdded.length, 1, 'IDBook column should be added');
						libAssert.strictEqual(tmpResult.TablesModified[0].ForeignKeysAdded.length, 1, 'FK inferred from Join should be detected');
						libAssert.strictEqual(tmpResult.TablesModified[0].ForeignKeysAdded[0].ReferencesTable, 'Book');
					}
				);
			}
		);

		// ================================================================
		// MigrationGenerator Service
		// ================================================================
		suite
		(
			'MigrationGenerator Service',
			function ()
			{
				test
				(
					'Should generate CREATE TABLE for added tables (MySQL)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = {
							TablesAdded: [{
								TableName: 'Publisher',
								Columns: [
									{ Column: 'IDPublisher', DataType: 'ID' },
									{ Column: 'Name', DataType: 'String', Size: '200' }
								]
							}],
							TablesRemoved: [],
							TablesModified: []
						};

						let tmpStatements = tmpMigGen.generateMigrationStatements(tmpDiff, 'MySQL');
						libAssert.strictEqual(tmpStatements.length, 1);
						libAssert.ok(tmpStatements[0].indexOf('CREATE TABLE') >= 0, 'Should generate CREATE TABLE');
						libAssert.ok(tmpStatements[0].indexOf('`Publisher`') >= 0, 'Should use backtick quoting');
						libAssert.ok(tmpStatements[0].indexOf('AUTO_INCREMENT') >= 0, 'ID should map to AUTO_INCREMENT');
					}
				);

				test
				(
					'Should ignore removed tables (no DROP TABLE)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = {
							TablesAdded: [],
							TablesRemoved: [{ TableName: 'OldTable', Columns: [] }],
							TablesModified: []
						};

						let tmpStatements = tmpMigGen.generateMigrationStatements(tmpDiff, 'PostgreSQL');
						libAssert.strictEqual(tmpStatements.length, 0, 'Removed tables should not generate any statements');
					}
				);

				test
				(
					'Should generate ALTER TABLE ADD COLUMN',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = {
							TablesAdded: [],
							TablesRemoved: [],
							TablesModified: [{
								TableName: 'Book',
								ColumnsAdded: [{ Column: 'Genre', DataType: 'String', Size: '128' }],
								ColumnsRemoved: [],
								ColumnsModified: [],
								IndicesAdded: [],
								IndicesRemoved: [],
								ForeignKeysAdded: [],
								ForeignKeysRemoved: []
							}]
						};

						let tmpStatements = tmpMigGen.generateMigrationStatements(tmpDiff, 'MSSQL');
						libAssert.strictEqual(tmpStatements.length, 1);
						libAssert.ok(tmpStatements[0].indexOf('ALTER TABLE') >= 0);
						// MSSQL uses ADD without COLUMN keyword
						libAssert.ok(tmpStatements[0].indexOf(' ADD ') >= 0);
						libAssert.ok(tmpStatements[0].indexOf('ADD COLUMN') < 0, 'MSSQL should not use ADD COLUMN');
						libAssert.ok(tmpStatements[0].indexOf('[Genre]') >= 0, 'Should use bracket quoting for MSSQL');
						libAssert.ok(tmpStatements[0].indexOf('NVARCHAR') >= 0, 'String should map to NVARCHAR for MSSQL');
					}
				);

				test
				(
					'Should generate ADD COLUMN with COLUMN keyword for non-MSSQL engines',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = {
							TablesAdded: [],
							TablesRemoved: [],
							TablesModified: [{
								TableName: 'Book',
								ColumnsAdded: [{ Column: 'Genre', DataType: 'String', Size: '128' }],
								ColumnsRemoved: [],
								ColumnsModified: [],
								IndicesAdded: [],
								IndicesRemoved: [],
								ForeignKeysAdded: [],
								ForeignKeysRemoved: []
							}]
						};

						let tmpMySQL = tmpMigGen.generateMigrationStatements(tmpDiff, 'MySQL');
						libAssert.ok(tmpMySQL[0].indexOf('ADD COLUMN') >= 0, 'MySQL should use ADD COLUMN');

						let tmpPostgreSQL = tmpMigGen.generateMigrationStatements(tmpDiff, 'PostgreSQL');
						libAssert.ok(tmpPostgreSQL[0].indexOf('ADD COLUMN') >= 0, 'PostgreSQL should use ADD COLUMN');

						let tmpSQLite = tmpMigGen.generateMigrationStatements(tmpDiff, 'SQLite');
						libAssert.ok(tmpSQLite[0].indexOf('ADD COLUMN') >= 0, 'SQLite should use ADD COLUMN');
					}
				);

				test
				(
					'Should generate ALTER COLUMN without DEFAULT for MSSQL',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = {
							TablesAdded: [],
							TablesRemoved: [],
							TablesModified: [{
								TableName: 'Sample',
								ColumnsAdded: [],
								ColumnsRemoved: [],
								ColumnsModified: [
									{
										Column: 'BuyUSA',
										DataType: 'Boolean',
										Changes: { DataType: { From: 'Numeric', To: 'Boolean' } }
									},
									{
										Column: 'ExternalSyncGUID',
										DataType: 'String',
										Size: '64',
										Changes: { Size: { From: '36', To: '64' } }
									}
								],
								IndicesAdded: [],
								IndicesRemoved: [],
								ForeignKeysAdded: [],
								ForeignKeysRemoved: []
							}]
						};

						let tmpStatements = tmpMigGen.generateMigrationStatements(tmpDiff, 'MSSQL');
						libAssert.strictEqual(tmpStatements.length, 2);

						// BuyUSA: type change — simple ALTER COLUMN without DEFAULT
						libAssert.ok(tmpStatements[0].indexOf('ALTER COLUMN') >= 0, 'Should use ALTER COLUMN');
						libAssert.ok(tmpStatements[0].indexOf('[BuyUSA]') >= 0, 'Should reference BuyUSA');
						libAssert.ok(tmpStatements[0].indexOf('BIT NOT NULL') >= 0, 'Boolean should map to BIT NOT NULL');
						libAssert.ok(tmpStatements[0].indexOf('DEFAULT') < 0, 'MSSQL ALTER COLUMN must not contain DEFAULT');

						// ExternalSyncGUID: size-only change — simple ALTER COLUMN without DEFAULT
						libAssert.ok(tmpStatements[1].indexOf('ALTER COLUMN') >= 0, 'Should use ALTER COLUMN for size change');
						libAssert.ok(tmpStatements[1].indexOf('[ExternalSyncGUID]') >= 0, 'Should reference ExternalSyncGUID');
						libAssert.ok(tmpStatements[1].indexOf('NVARCHAR(64)') >= 0, 'Should use new size');
						libAssert.ok(tmpStatements[1].indexOf('DEFAULT') < 0, 'MSSQL ALTER COLUMN must not contain DEFAULT');
					}
				);

				test
				(
					'Should generate ALTER COLUMN with DEFAULT for non-MSSQL engines',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = {
							TablesAdded: [],
							TablesRemoved: [],
							TablesModified: [{
								TableName: 'Sample',
								ColumnsAdded: [],
								ColumnsRemoved: [],
								ColumnsModified: [
									{
										Column: 'IsActive',
										DataType: 'Boolean',
										Changes: { DataType: { From: 'Numeric', To: 'Boolean' } }
									}
								],
								IndicesAdded: [],
								IndicesRemoved: [],
								ForeignKeysAdded: [],
								ForeignKeysRemoved: []
							}]
						};

						let tmpMySQL = tmpMigGen.generateMigrationStatements(tmpDiff, 'MySQL');
						libAssert.ok(tmpMySQL[0].indexOf('MODIFY COLUMN') >= 0, 'MySQL should use MODIFY COLUMN');
						libAssert.ok(tmpMySQL[0].indexOf('DEFAULT') >= 0, 'MySQL ALTER should include DEFAULT');

						let tmpPostgreSQL = tmpMigGen.generateMigrationStatements(tmpDiff, 'PostgreSQL');
						libAssert.ok(tmpPostgreSQL[0].indexOf('ALTER COLUMN') >= 0, 'PostgreSQL should use ALTER COLUMN');
						libAssert.ok(tmpPostgreSQL[0].indexOf('TYPE') >= 0, 'PostgreSQL should use TYPE keyword');
					}
				);

				test
				(
					'Should generate ALTER COLUMN for size-only changes using target DataType',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						// Size-only change: DataType is the same (String), only Size changed
						let tmpDiff = {
							TablesAdded: [],
							TablesRemoved: [],
							TablesModified: [{
								TableName: 'Book',
								ColumnsAdded: [],
								ColumnsRemoved: [],
								ColumnsModified: [
									{
										Column: 'Title',
										DataType: 'String',
										Size: '512',
										Changes: { Size: { From: '200', To: '512' } }
									}
								],
								IndicesAdded: [],
								IndicesRemoved: [],
								ForeignKeysAdded: [],
								ForeignKeysRemoved: []
							}]
						};

						// MySQL: should generate MODIFY COLUMN with new size
						let tmpMySQL = tmpMigGen.generateMigrationStatements(tmpDiff, 'MySQL');
						libAssert.strictEqual(tmpMySQL.length, 1, 'Should generate one statement');
						libAssert.ok(tmpMySQL[0].indexOf('MODIFY COLUMN') >= 0, 'MySQL should use MODIFY COLUMN');
						libAssert.ok(tmpMySQL[0].indexOf('512') >= 0, 'Should use new size');

						// MSSQL: should generate simple ALTER COLUMN without DEFAULT
						let tmpMSSQL = tmpMigGen.generateMigrationStatements(tmpDiff, 'MSSQL');
						libAssert.strictEqual(tmpMSSQL.length, 1, 'Should generate one statement');
						libAssert.ok(tmpMSSQL[0].indexOf('ALTER COLUMN') >= 0, 'MSSQL should use ALTER COLUMN');
						libAssert.ok(tmpMSSQL[0].indexOf('NVARCHAR(512)') >= 0, 'Should use new size');
						libAssert.ok(tmpMSSQL[0].indexOf('DEFAULT') < 0, 'MSSQL ALTER COLUMN must not contain DEFAULT');

						// PostgreSQL: should generate ALTER COLUMN TYPE with new size
						let tmpPG = tmpMigGen.generateMigrationStatements(tmpDiff, 'PostgreSQL');
						libAssert.strictEqual(tmpPG.length, 1, 'Should generate one statement');
						libAssert.ok(tmpPG[0].indexOf('ALTER COLUMN') >= 0, 'PostgreSQL should use ALTER COLUMN');
						libAssert.ok(tmpPG[0].indexOf('VARCHAR(512)') >= 0, 'Should use new size');
					}
				);

				test
				(
					'Should generate ALTER TABLE DROP COLUMN',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = {
							TablesAdded: [],
							TablesRemoved: [],
							TablesModified: [{
								TableName: 'Book',
								ColumnsAdded: [],
								ColumnsRemoved: [{ Column: 'OldField', DataType: 'String' }],
								ColumnsModified: [],
								IndicesAdded: [],
								IndicesRemoved: [],
								ForeignKeysAdded: [],
								ForeignKeysRemoved: []
							}]
						};

						let tmpStatements = tmpMigGen.generateMigrationStatements(tmpDiff, 'SQLite');
						libAssert.strictEqual(tmpStatements.length, 1);
						libAssert.ok(tmpStatements[0].indexOf('DROP COLUMN') >= 0);
						libAssert.ok(tmpStatements[0].indexOf('SQLite 3.35') >= 0, 'Should include SQLite version note');
					}
				);

				test
				(
					'Should generate complete migration script',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = {
							TablesAdded: [
								{ TableName: 'Publisher', Columns: [
									{ Column: 'IDPublisher', DataType: 'ID' },
									{ Column: 'Name', DataType: 'String', Size: '200' }
								]}
							],
							TablesRemoved: [],
							TablesModified: [{
								TableName: 'Book',
								ColumnsAdded: [{ Column: 'Edition', DataType: 'String', Size: '32' }],
								ColumnsRemoved: [],
								ColumnsModified: [],
								IndicesAdded: [],
								IndicesRemoved: [],
								ForeignKeysAdded: [],
								ForeignKeysRemoved: []
							}]
						};

						let tmpScript = tmpMigGen.generateMigrationScript(tmpDiff, 'MySQL');
						libAssert.ok(tmpScript.indexOf('Migration Script') >= 0, 'Should have header');
						libAssert.ok(tmpScript.indexOf('MySQL') >= 0, 'Should mention database type');
						libAssert.ok(tmpScript.indexOf('CREATE TABLE') >= 0, 'Should contain CREATE TABLE');
						libAssert.ok(tmpScript.indexOf('ALTER TABLE') >= 0, 'Should contain ALTER TABLE');
					}
				);

				test
				(
					'Should handle empty diff',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDiff = { TablesAdded: [], TablesRemoved: [], TablesModified: [] };
						let tmpScript = tmpMigGen.generateMigrationScript(tmpDiff, 'MySQL');
						libAssert.ok(tmpScript.indexOf('No changes detected') >= 0);
					}
				);

				test
				(
					'Should use correct quoting per database type',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						libAssert.strictEqual(tmpMigGen._quoteIdentifier('Book', 'MySQL'), '`Book`');
						libAssert.strictEqual(tmpMigGen._quoteIdentifier('Book', 'PostgreSQL'), '"Book"');
						libAssert.strictEqual(tmpMigGen._quoteIdentifier('Book', 'MSSQL'), '[Book]');
						libAssert.strictEqual(tmpMigGen._quoteIdentifier('Book', 'SQLite'), '"Book"');
					}
				);
			}
		);

		// ================================================================
		// SchemaVisualizer Service
		// ================================================================
		suite
		(
			'SchemaVisualizer Service',
			function ()
			{
				let _TestSchema = {
					Tables: [
						{
							TableName: 'Book',
							Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '200' },
								{ Column: 'Genre', DataType: 'String', Size: '128' },
								{ Column: 'PublicationYear', DataType: 'Numeric' }
							],
							ForeignKeys: []
						},
						{
							TableName: 'BookAuthorJoin',
							Columns: [
								{ Column: 'IDBookAuthorJoin', DataType: 'ID' },
								{ Column: 'IDBook', DataType: 'ForeignKey' },
								{ Column: 'IDAuthor', DataType: 'ForeignKey' }
							],
							ForeignKeys: [
								{ Column: 'IDBook', ReferencesTable: 'Book', ReferencesColumn: 'IDBook' },
								{ Column: 'IDAuthor', ReferencesTable: 'Author', ReferencesColumn: 'IDAuthor' }
							]
						}
					]
				};

				test
				(
					'Should generate table list',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpViz = tmpManager.instantiateServiceProvider('SchemaVisualizer');

						let tmpOutput = tmpViz.generateTableList(_TestSchema);
						libAssert.ok(tmpOutput.indexOf('Tables (2)') >= 0);
						libAssert.ok(tmpOutput.indexOf('Book') >= 0);
						libAssert.ok(tmpOutput.indexOf('4 columns') >= 0);
						libAssert.ok(tmpOutput.indexOf('BookAuthorJoin') >= 0);
						libAssert.ok(tmpOutput.indexOf('3 columns') >= 0);
					}
				);

				test
				(
					'Should generate table detail',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpViz = tmpManager.instantiateServiceProvider('SchemaVisualizer');

						let tmpOutput = tmpViz.generateTableDetail(_TestSchema.Tables[0]);
						libAssert.ok(tmpOutput.indexOf('Table: Book') >= 0);
						libAssert.ok(tmpOutput.indexOf('IDBook') >= 0);
						libAssert.ok(tmpOutput.indexOf('ID') >= 0);
						libAssert.ok(tmpOutput.indexOf('String(200)') >= 0);
						libAssert.ok(tmpOutput.indexOf('Numeric') >= 0);
					}
				);

				test
				(
					'Should generate relationship map',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpViz = tmpManager.instantiateServiceProvider('SchemaVisualizer');

						let tmpOutput = tmpViz.generateRelationshipMap(_TestSchema);
						libAssert.ok(tmpOutput.indexOf('Relationships') >= 0);
						libAssert.ok(tmpOutput.indexOf('BookAuthorJoin.IDBook') >= 0);
						libAssert.ok(tmpOutput.indexOf('Book.IDBook') >= 0);
						libAssert.ok(tmpOutput.indexOf('Author.IDAuthor') >= 0);
					}
				);

				test
				(
					'Should return no relationships message when none exist',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpViz = tmpManager.instantiateServiceProvider('SchemaVisualizer');

						let tmpOutput = tmpViz.generateRelationshipMap({ Tables: [{ TableName: 'Simple', Columns: [], ForeignKeys: [] }] });
						libAssert.ok(tmpOutput.indexOf('No relationships found') >= 0);
					}
				);

				test
				(
					'Should generate ASCII diagram',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpViz = tmpManager.instantiateServiceProvider('SchemaVisualizer');

						let tmpOutput = tmpViz.generateASCIIDiagram(_TestSchema);
						libAssert.ok(tmpOutput.indexOf('+') >= 0, 'Should have box borders');
						libAssert.ok(tmpOutput.indexOf('Book') >= 0);
						libAssert.ok(tmpOutput.indexOf('[PK]') >= 0, 'Should show PK abbreviation');
						libAssert.ok(tmpOutput.indexOf('STR') >= 0, 'Should show STR abbreviation');
						libAssert.ok(tmpOutput.indexOf('FK') >= 0, 'Should show FK abbreviation');
					}
				);

				test
				(
					'Should detect relationships from column Join property (-> syntax)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpViz = tmpManager.instantiateServiceProvider('SchemaVisualizer');

						// Schema using Join properties instead of ForeignKeys arrays
						let tmpSchema = {
							Tables: [
								{
									TableName: 'Book',
									Columns: [
										{ Column: 'IDBook', DataType: 'ID' },
										{ Column: 'Title', DataType: 'String', Size: '200' }
									]
								},
								{
									TableName: 'Author',
									Columns: [
										{ Column: 'IDAuthor', DataType: 'ID' },
										{ Column: 'Name', DataType: 'String', Size: '200' }
									]
								},
								{
									TableName: 'BookAuthorJoin',
									Columns: [
										{ Column: 'IDBookAuthorJoin', DataType: 'ID' },
										{ Column: 'IDBook', DataType: 'ForeignKey', Join: 'IDBook' },
										{ Column: 'IDAuthor', DataType: 'ForeignKey', Join: 'IDAuthor' }
									]
								}
							]
						};

						let tmpOutput = tmpViz.generateRelationshipMap(tmpSchema);
						libAssert.ok(tmpOutput.indexOf('Relationships') >= 0, 'Should have Relationships header');
						libAssert.ok(tmpOutput.indexOf('BookAuthorJoin.IDBook') >= 0, 'Should show BookAuthorJoin.IDBook');
						libAssert.ok(tmpOutput.indexOf('Book.IDBook') >= 0, 'Should reference Book.IDBook');
						libAssert.ok(tmpOutput.indexOf('BookAuthorJoin.IDAuthor') >= 0, 'Should show BookAuthorJoin.IDAuthor');
						libAssert.ok(tmpOutput.indexOf('Author.IDAuthor') >= 0, 'Should reference Author.IDAuthor');
					}
				);

				test
				(
					'Should detect relationships from column TableJoin property (=> syntax)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpViz = tmpManager.instantiateServiceProvider('SchemaVisualizer');

						// Schema using TableJoin properties
						let tmpSchema = {
							Tables: [
								{
									TableName: 'Category',
									Columns: [
										{ Column: 'IDCategory', DataType: 'ID' },
										{ Column: 'Name', DataType: 'String', Size: '128' }
									]
								},
								{
									TableName: 'Product',
									Columns: [
										{ Column: 'IDProduct', DataType: 'ID' },
										{ Column: 'IDCategory', DataType: 'ForeignKey', TableJoin: 'Category' }
									]
								}
							]
						};

						let tmpOutput = tmpViz.generateRelationshipMap(tmpSchema);
						libAssert.ok(tmpOutput.indexOf('Relationships') >= 0, 'Should have Relationships header');
						libAssert.ok(tmpOutput.indexOf('Product.IDCategory') >= 0, 'Should show Product.IDCategory');
						libAssert.ok(tmpOutput.indexOf('Category') >= 0, 'Should reference Category table');
					}
				);

				test
				(
					'Should handle Stricture Extended JSON hash format',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpViz = tmpManager.instantiateServiceProvider('SchemaVisualizer');

						// Schema using Tables as a hash (Stricture Extended JSON output)
						let tmpSchema = {
							Tables:
							{
								'Book':
								{
									TableName: 'Book',
									Columns: [
										{ Column: 'IDBook', DataType: 'ID' },
										{ Column: 'Title', DataType: 'String', Size: '200' }
									]
								},
								'Review':
								{
									TableName: 'Review',
									Columns: [
										{ Column: 'IDReview', DataType: 'ID' },
										{ Column: 'IDBook', DataType: 'ForeignKey', Join: 'IDBook' },
										{ Column: 'Rating', DataType: 'Numeric' }
									]
								}
							}
						};

						// All visualizer methods should work with hash-format Tables
						let tmpRelMap = tmpViz.generateRelationshipMap(tmpSchema);
						libAssert.ok(tmpRelMap.indexOf('Relationships') >= 0, 'Should have Relationships header');
						libAssert.ok(tmpRelMap.indexOf('Review.IDBook') >= 0, 'Should show Review.IDBook');
						libAssert.ok(tmpRelMap.indexOf('Book.IDBook') >= 0, 'Should reference Book.IDBook');

						let tmpTableList = tmpViz.generateTableList(tmpSchema);
						libAssert.ok(tmpTableList.indexOf('Tables (2)') >= 0, 'Should list 2 tables from hash');
						libAssert.ok(tmpTableList.indexOf('Book') >= 0, 'Should include Book table');
						libAssert.ok(tmpTableList.indexOf('Review') >= 0, 'Should include Review table');

						let tmpDiagram = tmpViz.generateASCIIDiagram(tmpSchema);
						libAssert.ok(tmpDiagram.indexOf('+') >= 0, 'Should have box borders from hash');
						libAssert.ok(tmpDiagram.indexOf('Book') >= 0, 'Should show Book in diagram');
						libAssert.ok(tmpDiagram.indexOf('Review') >= 0, 'Should show Review in diagram');
						libAssert.ok(tmpDiagram.indexOf('[PK]') >= 0, 'Should show PK abbreviation');
					}
				);
			}
		);

		// ================================================================
		// FlowDataBuilder Service
		// ================================================================
		suite
		(
			'FlowDataBuilder Service',
			function ()
			{
				let _FlowTestSchema = {
					Tables: [
						{
							TableName: 'Book',
							Columns: [
								{ Column: 'IDBook', DataType: 'ID' },
								{ Column: 'Title', DataType: 'String', Size: '200' },
								{ Column: 'Genre', DataType: 'String', Size: '128' },
								{ Column: 'PublicationYear', DataType: 'Numeric' }
							],
							ForeignKeys: []
						},
						{
							TableName: 'Author',
							Columns: [
								{ Column: 'IDAuthor', DataType: 'ID' },
								{ Column: 'Name', DataType: 'String', Size: '200' }
							],
							ForeignKeys: []
						},
						{
							TableName: 'BookAuthorJoin',
							Columns: [
								{ Column: 'IDBookAuthorJoin', DataType: 'ID' },
								{ Column: 'IDBook', DataType: 'ForeignKey' },
								{ Column: 'IDAuthor', DataType: 'ForeignKey' }
							],
							ForeignKeys: [
								{ Column: 'IDBook', ReferencesTable: 'Book', ReferencesColumn: 'IDBook' },
								{ Column: 'IDAuthor', ReferencesTable: 'Author', ReferencesColumn: 'IDAuthor' }
							]
						},
						{
							TableName: 'BookPrice',
							Columns: [
								{ Column: 'IDBookPrice', DataType: 'ID' },
								{ Column: 'IDBook', DataType: 'ForeignKey' },
								{ Column: 'Price', DataType: 'Decimal', Size: '8,2' },
								{ Column: 'Currency', DataType: 'String', Size: '3' }
							],
							ForeignKeys: [
								{ Column: 'IDBook', ReferencesTable: 'Book', ReferencesColumn: 'IDBook' }
							]
						},
						{
							TableName: 'BookReview',
							Columns: [
								{ Column: 'IDBookReview', DataType: 'ID' },
								{ Column: 'IDBook', DataType: 'ForeignKey' },
								{ Column: 'Rating', DataType: 'Numeric' },
								{ Column: 'ReviewText', DataType: 'Text' }
							],
							ForeignKeys: [
								{ Column: 'IDBook', ReferencesTable: 'Book', ReferencesColumn: 'IDBook' }
							]
						}
					]
				};

				test
				(
					'Should build flow data with correct node count',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpFlowData = tmpFlowBuilder.buildFlowData(_FlowTestSchema);

						libAssert.ok(tmpFlowData, 'Flow data should be returned');
						libAssert.ok(Array.isArray(tmpFlowData.Nodes), 'Nodes should be an array');
						libAssert.strictEqual(tmpFlowData.Nodes.length, 5, 'Should have 5 nodes (one per table)');
						libAssert.ok(tmpFlowData.ViewState, 'ViewState should exist');
					}
				);

				test
				(
					'Should create output ports for FK columns',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpFlowData = tmpFlowBuilder.buildFlowData(_FlowTestSchema);

						// BookAuthorJoin has 2 FKs: IDBook and IDAuthor
						let tmpJoinNode = tmpFlowData.Nodes.find((pN) => pN.Hash === 'table-BookAuthorJoin');
						libAssert.ok(tmpJoinNode, 'BookAuthorJoin node should exist');

						let tmpOutputPorts = tmpJoinNode.Ports.filter((pP) => pP.Direction === 'output');
						libAssert.strictEqual(tmpOutputPorts.length, 2, 'BookAuthorJoin should have 2 output ports (FK columns)');

						let tmpIDBookOut = tmpOutputPorts.find((pP) => pP.Hash === 'port-BookAuthorJoin-IDBook-out');
						libAssert.ok(tmpIDBookOut, 'Should have output port for IDBook FK');
						libAssert.strictEqual(tmpIDBookOut.Side, 'right');

						let tmpIDAuthorOut = tmpOutputPorts.find((pP) => pP.Hash === 'port-BookAuthorJoin-IDAuthor-out');
						libAssert.ok(tmpIDAuthorOut, 'Should have output port for IDAuthor FK');
					}
				);

				test
				(
					'Should create input ports for referenced columns',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpFlowData = tmpFlowBuilder.buildFlowData(_FlowTestSchema);

						// Book.IDBook is referenced by BookAuthorJoin, BookPrice, and BookReview
						let tmpBookNode = tmpFlowData.Nodes.find((pN) => pN.Hash === 'table-Book');
						libAssert.ok(tmpBookNode, 'Book node should exist');

						let tmpInputPorts = tmpBookNode.Ports.filter((pP) => pP.Direction === 'input');
						libAssert.strictEqual(tmpInputPorts.length, 1, 'Book should have 1 input port (IDBook referenced by FKs)');
						libAssert.strictEqual(tmpInputPorts[0].Hash, 'port-Book-IDBook-in');
						libAssert.strictEqual(tmpInputPorts[0].Side, 'left');

						// Author.IDAuthor is referenced by BookAuthorJoin
						let tmpAuthorNode = tmpFlowData.Nodes.find((pN) => pN.Hash === 'table-Author');
						let tmpAuthorInputPorts = tmpAuthorNode.Ports.filter((pP) => pP.Direction === 'input');
						libAssert.strictEqual(tmpAuthorInputPorts.length, 1, 'Author should have 1 input port');
						libAssert.strictEqual(tmpAuthorInputPorts[0].Hash, 'port-Author-IDAuthor-in');
					}
				);

				test
				(
					'Should create connections matching FK relationships',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpFlowData = tmpFlowBuilder.buildFlowData(_FlowTestSchema);

						libAssert.ok(Array.isArray(tmpFlowData.Connections), 'Connections should be an array');
						// 2 from BookAuthorJoin + 1 from BookPrice + 1 from BookReview = 4
						libAssert.strictEqual(tmpFlowData.Connections.length, 4, 'Should have 4 connections');

						// Verify a specific connection: BookAuthorJoin.IDBook → Book.IDBook
						let tmpConn = tmpFlowData.Connections.find(
							(pC) => pC.SourceNodeHash === 'table-BookAuthorJoin' && pC.TargetNodeHash === 'table-Book');
						libAssert.ok(tmpConn, 'Should have connection from BookAuthorJoin to Book');
						libAssert.strictEqual(tmpConn.SourcePortHash, 'port-BookAuthorJoin-IDBook-out');
						libAssert.strictEqual(tmpConn.TargetPortHash, 'port-Book-IDBook-in');
					}
				);

				test
				(
					'Should handle schemas with no FKs',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpSimpleSchema = {
							Tables: [
								{
									TableName: 'SimpleTable',
									Columns: [
										{ Column: 'IDSimpleTable', DataType: 'ID' },
										{ Column: 'Name', DataType: 'String', Size: '200' }
									],
									ForeignKeys: []
								}
							]
						};

						let tmpFlowData = tmpFlowBuilder.buildFlowData(tmpSimpleSchema);
						libAssert.strictEqual(tmpFlowData.Nodes.length, 1, 'Should have 1 node');
						libAssert.strictEqual(tmpFlowData.Connections.length, 0, 'Should have 0 connections');
						libAssert.strictEqual(tmpFlowData.Nodes[0].Ports.length, 0, 'Should have no ports');
					}
				);

				test
				(
					'Should handle empty schemas gracefully',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpFlowData = tmpFlowBuilder.buildFlowData({ Tables: [] });
						libAssert.strictEqual(tmpFlowData.Nodes.length, 0);
						libAssert.strictEqual(tmpFlowData.Connections.length, 0);

						let tmpFlowData2 = tmpFlowBuilder.buildFlowData(null);
						libAssert.strictEqual(tmpFlowData2.Nodes.length, 0);
						libAssert.strictEqual(tmpFlowData2.Connections.length, 0);
					}
				);

				test
				(
					'Should handle Tables as hash (Stricture Extended JSON format)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpHashSchema = {
							Tables:
							{
								'Book':
								{
									TableName: 'Book',
									Columns: [
										{ Column: 'IDBook', DataType: 'ID' },
										{ Column: 'Title', DataType: 'String', Size: '200' }
									],
									ForeignKeys: []
								},
								'Author':
								{
									TableName: 'Author',
									Columns: [
										{ Column: 'IDAuthor', DataType: 'ID' },
										{ Column: 'Name', DataType: 'String', Size: '200' }
									],
									ForeignKeys: []
								}
							}
						};

						let tmpFlowData = tmpFlowBuilder.buildFlowData(tmpHashSchema);
						libAssert.strictEqual(tmpFlowData.Nodes.length, 2, 'Should handle hash tables');
					}
				);

				test
				(
					'Should build connections from Join column properties (-> syntax)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						// Schema with Join properties and no ForeignKeys arrays
						let tmpJoinSchema = {
							Tables: [
								{
									TableName: 'Book',
									Columns: [
										{ Column: 'IDBook', DataType: 'ID' },
										{ Column: 'Title', DataType: 'String', Size: '200' }
									]
								},
								{
									TableName: 'Review',
									Columns: [
										{ Column: 'IDReview', DataType: 'ID' },
										{ Column: 'IDBook', DataType: 'ForeignKey', Join: 'IDBook' },
										{ Column: 'Rating', DataType: 'Numeric' }
									]
								}
							]
						};

						let tmpFlowData = tmpFlowBuilder.buildFlowData(tmpJoinSchema);
						libAssert.strictEqual(tmpFlowData.Nodes.length, 2, 'Should have 2 nodes');
						libAssert.strictEqual(tmpFlowData.Connections.length, 1, 'Should have 1 connection from Join inference');

						let tmpConn = tmpFlowData.Connections[0];
						libAssert.strictEqual(tmpConn.Data.SourceTable, 'Review');
						libAssert.strictEqual(tmpConn.Data.TargetTable, 'Book');
						libAssert.strictEqual(tmpConn.Data.SourceColumn, 'IDBook');
						libAssert.strictEqual(tmpConn.Data.TargetColumn, 'IDBook');
						libAssert.strictEqual(tmpConn.Data.Type, 'Join');
					}
				);

				test
				(
					'Should build connections from TableJoin column properties (=> syntax)',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpTableJoinSchema = {
							Tables: [
								{
									TableName: 'Category',
									Columns: [
										{ Column: 'IDCategory', DataType: 'ID' },
										{ Column: 'Name', DataType: 'String', Size: '128' }
									]
								},
								{
									TableName: 'Product',
									Columns: [
										{ Column: 'IDProduct', DataType: 'ID' },
										{ Column: 'IDCategory', DataType: 'ForeignKey', TableJoin: 'Category' }
									]
								}
							]
						};

						let tmpFlowData = tmpFlowBuilder.buildFlowData(tmpTableJoinSchema);
						libAssert.strictEqual(tmpFlowData.Nodes.length, 2, 'Should have 2 nodes');
						libAssert.strictEqual(tmpFlowData.Connections.length, 1, 'Should have 1 connection from TableJoin inference');

						let tmpConn = tmpFlowData.Connections[0];
						libAssert.strictEqual(tmpConn.Data.SourceTable, 'Product');
						libAssert.strictEqual(tmpConn.Data.TargetTable, 'Category');
						libAssert.strictEqual(tmpConn.Data.Type, 'TableJoin');
					}
				);

				test
				(
					'Should build diff flow data with colored node types',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpDiffResult = {
							TablesAdded: [{ TableName: 'BookReview' }],
							TablesRemoved: [],
							TablesModified: [{ TableName: 'Book', ColumnsAdded: [], ColumnsRemoved: [], ColumnsModified: [] }]
						};

						let tmpFlowData = tmpFlowBuilder.buildDiffFlowData(_FlowTestSchema, tmpDiffResult);

						// Verify added table gets green type
						let tmpReviewNode = tmpFlowData.Nodes.find((pN) => pN.Hash === 'table-BookReview');
						libAssert.ok(tmpReviewNode, 'BookReview node should exist');
						libAssert.strictEqual(tmpReviewNode.Type, 'TABLE_ADDED', 'Added table should have TABLE_ADDED type');
						libAssert.strictEqual(tmpReviewNode.Data.DiffStatus, 'Added');

						// Verify modified table gets yellow type
						let tmpBookNode = tmpFlowData.Nodes.find((pN) => pN.Hash === 'table-Book');
						libAssert.strictEqual(tmpBookNode.Type, 'TABLE_MODIFIED', 'Modified table should have TABLE_MODIFIED type');
						libAssert.strictEqual(tmpBookNode.Data.DiffStatus, 'Modified');

						// Verify unchanged table stays default
						let tmpAuthorNode = tmpFlowData.Nodes.find((pN) => pN.Hash === 'table-Author');
						libAssert.strictEqual(tmpAuthorNode.Type, 'TABLE', 'Unchanged table should keep TABLE type');
						libAssert.strictEqual(tmpAuthorNode.Data.DiffStatus, 'Unchanged');
					}
				);

				test
				(
					'Should set correct node dimensions and positions',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpFlowData = tmpFlowBuilder.buildFlowData(_FlowTestSchema);

						// All nodes should have a Hash starting with 'table-'
						for (let i = 0; i < tmpFlowData.Nodes.length; i++)
						{
							let tmpNode = tmpFlowData.Nodes[i];
							libAssert.ok(tmpNode.Hash.indexOf('table-') === 0, 'Node hash should start with table-');
							libAssert.strictEqual(tmpNode.Type, 'TABLE', 'Node type should be TABLE');
							libAssert.strictEqual(tmpNode.Width, 260, 'Width should be 260');
							libAssert.ok(tmpNode.Height > 0, 'Height should be positive');
							libAssert.ok(typeof tmpNode.X === 'number', 'X should be a number');
							libAssert.ok(typeof tmpNode.Y === 'number', 'Y should be a number');
							libAssert.ok(tmpNode.Data, 'Data should exist');
							libAssert.ok(tmpNode.Data.TableName, 'Data.TableName should exist');
							libAssert.ok(Array.isArray(tmpNode.Data.Columns), 'Data.Columns should be an array');
						}

						// Book has 1 port (IDBook input): height = 28 + max(1, 2) * 22 + 16 = 88
						let tmpBookNode = tmpFlowData.Nodes.find((pN) => pN.Hash === 'table-Book');
						libAssert.strictEqual(tmpBookNode.Height, 88, 'Book height should be calculated from port count');
					}
				);

				test
				(
					'Should store column metadata in node Data',
					function ()
					{
						let tmpManager = new libMeadowMigrationManager({});
						let tmpFlowBuilder = tmpManager.instantiateServiceProvider('FlowDataBuilder');

						let tmpFlowData = tmpFlowBuilder.buildFlowData(_FlowTestSchema);

						let tmpBookNode = tmpFlowData.Nodes.find((pN) => pN.Hash === 'table-Book');
						let tmpCols = tmpBookNode.Data.Columns;

						libAssert.strictEqual(tmpCols.length, 4, 'Book should have 4 column entries');

						let tmpIDCol = tmpCols.find((pC) => pC.Column === 'IDBook');
						libAssert.strictEqual(tmpIDCol.TypeDisplay, 'PK', 'IDBook should display as PK');

						let tmpTitleCol = tmpCols.find((pC) => pC.Column === 'Title');
						libAssert.strictEqual(tmpTitleCol.TypeDisplay, 'STR(200)', 'Title should display as STR(200)');

						let tmpYearCol = tmpCols.find((pC) => pC.Column === 'PublicationYear');
						libAssert.strictEqual(tmpYearCol.TypeDisplay, 'INT', 'PublicationYear should display as INT');
					}
				);
			}
		);

		// ================================================================
		// End-to-End: Compile → Diff → Migrate
		// ================================================================
		suite
		(
			'End-to-End Schema Workflow',
			function ()
			{
				test
				(
					'Should compile two DDL versions and diff them',
					function (fDone)
					{
						this.timeout(30000);

						let tmpManager = new libMeadowMigrationManager({});
						let tmpAdapter = tmpManager.instantiateServiceProvider('StrictureAdapter');
						let tmpDiffService = tmpManager.instantiateServiceProvider('SchemaDiff');
						let tmpMigGen = tmpManager.instantiateServiceProvider('MigrationGenerator');

						let tmpDDLv1 = libFS.readFileSync(libPath.join(_FixturePath, 'bookstore.ddl'), 'utf8');
						let tmpDDLv2 = libFS.readFileSync(libPath.join(_FixturePath, 'bookstore-v2.ddl'), 'utf8');

						// Compile v1
						tmpAdapter.compileDDL(tmpDDLv1,
							function (pError, pSchemaV1)
							{
								libAssert.ifError(pError);

								// Compile v2
								tmpAdapter.compileDDL(tmpDDLv2,
									function (pError2, pSchemaV2)
									{
										libAssert.ifError(pError2);

										// Convert both schemas to DDL format (Tables array) for diffing
										let tmpTablesV1 = [];
										let tmpTablesV2 = [];

										let tmpKeysV1 = Object.keys(pSchemaV1.Tables);
										for (let i = 0; i < tmpKeysV1.length; i++)
										{
											tmpTablesV1.push(pSchemaV1.Tables[tmpKeysV1[i]]);
										}

										let tmpKeysV2 = Object.keys(pSchemaV2.Tables);
										for (let i = 0; i < tmpKeysV2.length; i++)
										{
											tmpTablesV2.push(pSchemaV2.Tables[tmpKeysV2[i]]);
										}

										let tmpDiffResult = tmpDiffService.diffSchemas(
											{ Tables: tmpTablesV1 },
											{ Tables: tmpTablesV2 }
										);

										// v2 adds Publisher table
										libAssert.ok(tmpDiffResult.TablesAdded.length >= 1, 'Should have at least 1 added table');
										let tmpPublisherAdded = tmpDiffResult.TablesAdded.find((pT) => pT.TableName === 'Publisher');
										libAssert.ok(tmpPublisherAdded, 'Publisher table should be added');

										// v2 modifies Book (Title size 200→500, adds Edition and PageCount)
										let tmpBookMod = tmpDiffResult.TablesModified.find((pT) => pT.TableName === 'Book');
										libAssert.ok(tmpBookMod, 'Book table should be modified');
										libAssert.ok(tmpBookMod.ColumnsAdded.length >= 1, 'Book should have added columns');

										// Generate migration script
										let tmpScript = tmpMigGen.generateMigrationScript(tmpDiffResult, 'MySQL');
										libAssert.ok(tmpScript.indexOf('CREATE TABLE') >= 0, 'Script should contain CREATE TABLE for Publisher');
										libAssert.ok(tmpScript.indexOf('ALTER TABLE') >= 0, 'Script should contain ALTER TABLE for Book modifications');

										return fDone();
									});
							});
					}
				);
			}
		);
	}
);
