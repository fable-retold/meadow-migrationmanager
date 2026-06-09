/**
 * Meadow Migration Manager - CLI Program Tests
 *
 * Regression coverage for the CLI host seeding its own AppData.MigrationManager
 * namespace. The MeadowMigrationManager class seeds it in its constructor, and the
 * rest of the suite exercises the services through the class. The CLI program is a
 * separate Pict host; before it seeded the namespace itself, every command that
 * touched the schema or connection library threw on an undefined
 * AppData.MigrationManager (read it before it was made ready).
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libAssert = require('assert');

suite
(
	'MeadowMigrationManager CLI Program',
	function ()
	{
		test
		(
			'seeds AppData.MigrationManager so the services have their state',
			function ()
			{
				// Requiring the module builds the program; run() lives in -Run.js and is not called here.
				let tmpCLI = require('../source/MeadowMigrationManager-CLI.js');

				libAssert.ok(tmpCLI.AppData.MigrationManager, 'CLI AppData.MigrationManager should exist');
				libAssert.ok(tmpCLI.AppData.MigrationManager.Schemas, 'Schemas hash should exist');
				libAssert.ok(tmpCLI.AppData.MigrationManager.Connections, 'Connections hash should exist');
			}
		);

		test
		(
			'addConnection works on the CLI host without the class seeding it',
			function ()
			{
				let tmpCLI = require('../source/MeadowMigrationManager-CLI.js');
				let tmpConnectionLibrary = tmpCLI.instantiateServiceProvider('ConnectionLibrary');

				let tmpEntry = tmpConnectionLibrary.addConnection('cli-cold-connection', 'SQLite', { database: '/tmp/cli-cold.sqlite' });

				libAssert.strictEqual(tmpEntry.Name, 'cli-cold-connection', 'addConnection should return the entry');
				libAssert.ok(tmpCLI.AppData.MigrationManager.Connections['cli-cold-connection'], 'connection should be stored in the library');
			}
		);

		test
		(
			'addSchema works on the CLI host without the class seeding it',
			function ()
			{
				let tmpCLI = require('../source/MeadowMigrationManager-CLI.js');
				let tmpSchemaLibrary = tmpCLI.instantiateServiceProvider('SchemaLibrary');

				let tmpEntry = tmpSchemaLibrary.addSchema('cli-cold-schema', '!Book\n@IDBook\n$Title 200\n');

				libAssert.ok(tmpEntry, 'addSchema should return an entry');
				libAssert.ok(tmpCLI.AppData.MigrationManager.Schemas['cli-cold-schema'], 'schema should be stored in the library');
			}
		);
	}
);
