/**
 * Meadow Migration Manager - CLI Program Setup
 *
 * Sets up the Commander.js-based CLI using pict-service-commandlineutility.
 * Registers all available subcommands and service types, and handles
 * cascading configuration from config files.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libCLIProgram = require('pict-service-commandlineutility');
const libCreateMigrationManagerAppData = require('./MeadowMigrationManager-AppData.js');

/**
 * Create the CLI program instance with all commands registered.
 *
 * This extends Pict (via CLIProgram), so all Fable services are available.
 * The program supports cascading configuration from:
 *   1. Default settings (below)
 *   2. Home folder .meadow-migration-config.json
 *   3. CWD .meadow-migration-config.json
 */
const _MeadowMigrationCLI = new libCLIProgram(
	{
		Product: 'meadow-migration',
		Version: require('../package.json').version,
		Command: 'meadow-migration',
		Description: 'Database schema migration manager for Meadow.',

		// Default configuration merged into ProgramConfiguration
		DefaultProgramConfiguration:
		{
			SchemaLibraryFile: '.meadow-migration-schemas.json',
			ConnectionLibraryFile: '.meadow-migration-connections.json',
			ModelPath: ''
		},

		// Configuration file name for cascading config lookup
		ProgramConfigurationFileName: '.meadow-migration-config.json',

		// Automatically gather configuration from default + home + cwd
		AutoGatherProgramConfiguration: true,

		// Add a built-in 'explain-config' command showing the config cascade
		AutoAddConfigurationExplanationCommand: true
	},
	[
		// Each command is a self-contained service that registers itself
		require('./commands/MigrationManager-Command-ListSchemas.js'),
		require('./commands/MigrationManager-Command-AddSchema.js'),
		require('./commands/MigrationManager-Command-ListConnections.js'),
		require('./commands/MigrationManager-Command-AddConnection.js'),
		require('./commands/MigrationManager-Command-Compile.js'),
		require('./commands/MigrationManager-Command-Introspect.js'),
		require('./commands/MigrationManager-Command-Diff.js'),
		require('./commands/MigrationManager-Command-Deploy.js'),
		require('./commands/MigrationManager-Command-Migrate.js'),
		require('./commands/MigrationManager-Command-GenerateScript.js'),
		require('./commands/MigrationManager-Command-TUI.js'),
		require('./commands/MigrationManager-Command-Serve.js')
	]);

// Seed the AppData.MigrationManager namespace that the library, diff, and
// migration services read and write. The MeadowMigrationManager class seeds this
// in its constructor; the CLI program is a separate Pict host, so without the same
// seed here every command that touches the schema or connection library (and the
// diff, migrate, and introspect commands) dereferences an undefined namespace and
// throws. Guarded so it never clobbers an already-initialized namespace.
if (!_MeadowMigrationCLI.AppData)
{
	_MeadowMigrationCLI.AppData = {};
}
if (!_MeadowMigrationCLI.AppData.MigrationManager)
{
	_MeadowMigrationCLI.AppData.MigrationManager = libCreateMigrationManagerAppData();
}

// Register all service types on the CLI program instance
_MeadowMigrationCLI.addServiceType('SchemaLibrary', require('./services/MigrationManager-Service-SchemaLibrary.js'));
_MeadowMigrationCLI.addServiceType('ConnectionLibrary', require('./services/MigrationManager-Service-ConnectionLibrary.js'));
_MeadowMigrationCLI.addServiceType('StrictureAdapter', require('./services/MigrationManager-Service-StrictureAdapter.js'));
_MeadowMigrationCLI.addServiceType('MeadowPackageGenerator', require('./services/MigrationManager-Service-MeadowPackageGenerator.js'));
_MeadowMigrationCLI.addServiceType('SchemaDiff', require('./services/MigrationManager-Service-SchemaDiff.js'));
_MeadowMigrationCLI.addServiceType('MigrationGenerator', require('./services/MigrationManager-Service-MigrationGenerator.js'));
_MeadowMigrationCLI.addServiceType('DatabaseProviderFactory', require('./services/MigrationManager-Service-DatabaseProviderFactory.js'));
_MeadowMigrationCLI.addServiceType('SchemaIntrospector', require('./services/MigrationManager-Service-SchemaIntrospector.js'));
_MeadowMigrationCLI.addServiceType('SchemaDeployer', require('./services/MigrationManager-Service-SchemaDeployer.js'));
_MeadowMigrationCLI.addServiceType('SchemaVisualizer', require('./services/MigrationManager-Service-SchemaVisualizer.js'));

module.exports = _MeadowMigrationCLI;
