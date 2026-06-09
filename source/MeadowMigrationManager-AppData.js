/**
 * Meadow Migration Manager - AppData namespace factory
 *
 * Single definition of the AppData.MigrationManager namespace the library, diff,
 * and migration services read and write. Both the MeadowMigrationManager class
 * (in its constructor) and the CLI program seed this, so it lives in one place to
 * keep the two from drifting.
 *
 * Returns a FRESH object on every call so separate hosts (a class instance and the
 * CLI program) never share the same Schemas / Connections hashes.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
function createMigrationManagerAppData()
{
	return (
		{
			Schemas: {},
			Connections: {},
			ActiveSchemaName: null,
			ActiveConnectionName: null,
			DiffResult: null,
			MigrationScript: null,
			IntrospectionResult: null
		});
}

module.exports = createMigrationManagerAppData;
