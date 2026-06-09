/**
 * Meadow Migration Manager
 *
 * A CLI, Web, and Console UI tool for managing database schemas and migrations.
 * Extends Pict (which extends Fable) and registers all service types.
 *
 * Usage (programmatic):
 *   const MeadowMigrationManager = require('meadow-migrationmanager');
 *   let tmpManager = new MeadowMigrationManager({});
 *   let tmpSchemaLib = tmpManager.instantiateServiceProvider('SchemaLibrary');
 *   tmpSchemaLib.addSchema('bookstore', '!Book\n@IDBook\n$Title 200\n');
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libPict = require('pict');
const libCreateMigrationManagerAppData = require('./MeadowMigrationManager-AppData.js');

/**
 * The main MeadowMigrationManager class -- registers all service types on construction.
 *
 * Service types registered:
 *   - SchemaLibrary           -- manages DDL/JSON schema collection
 *   - ConnectionLibrary       -- manages storage connection configurations
 *   - StrictureAdapter        -- wraps Stricture compiler for DDL compilation
 *   - SchemaIntrospector      -- wraps provider introspection methods
 *   - SchemaDiff              -- compares two DDL schemas
 *   - SchemaDeployer          -- creates tables/indices on live databases
 *   - MigrationGenerator      -- converts schema diffs to migration SQL
 *   - SchemaVisualizer        -- produces text-based schema visualizations
 *   - MeadowPackageGenerator  -- converts DDL schemas to Meadow package JSON
 */
class MeadowMigrationManager extends libPict
{
	/**
	 * @param {Object} pSettings - Settings hash passed through to Pict/Fable
	 */
	constructor(pSettings)
	{
		super(pSettings);

		// Initialize AppData namespace for migration manager state
		if (!this.AppData)
		{
			this.AppData = {};
		}
		if (!this.AppData.MigrationManager)
		{
			this.AppData.MigrationManager = libCreateMigrationManagerAppData();
		}

		// -- Register all service types --

		// Core services
		this.addServiceType('SchemaLibrary', require('./services/MigrationManager-Service-SchemaLibrary.js'));
		this.addServiceType('ConnectionLibrary', require('./services/MigrationManager-Service-ConnectionLibrary.js'));
		this.addServiceType('StrictureAdapter', require('./services/MigrationManager-Service-StrictureAdapter.js'));
		this.addServiceType('MeadowPackageGenerator', require('./services/MigrationManager-Service-MeadowPackageGenerator.js'));

		// Diff and migration services
		this.addServiceType('SchemaDiff', require('./services/MigrationManager-Service-SchemaDiff.js'));
		this.addServiceType('MigrationGenerator', require('./services/MigrationManager-Service-MigrationGenerator.js'));

		// Database interaction services
		this.addServiceType('DatabaseProviderFactory', require('./services/MigrationManager-Service-DatabaseProviderFactory.js'));
		this.addServiceType('SchemaIntrospector', require('./services/MigrationManager-Service-SchemaIntrospector.js'));
		this.addServiceType('SchemaDeployer', require('./services/MigrationManager-Service-SchemaDeployer.js'));

		// Visualization
		this.addServiceType('SchemaVisualizer', require('./services/MigrationManager-Service-SchemaVisualizer.js'));
		this.addServiceType('FlowDataBuilder', require('./services/MigrationManager-Service-FlowDataBuilder.js'));
	}
}

module.exports = MeadowMigrationManager;
