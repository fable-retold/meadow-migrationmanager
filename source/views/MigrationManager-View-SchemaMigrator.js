/**
 * Meadow Migration Manager - Schema Migrator View
 *
 * Displays the schema diff result with an interactive pict-section-flow
 * diagram showing color-coded tables (green=added, red=removed,
 * yellow=modified, gray=unchanged) alongside the text-based diff summary
 * and migration controls.
 *
 * Uses FlowDataBuilder.buildDiffFlowData() to produce colored nodes and
 * FlowCard-MeadowTable variants for the visual appearance.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libPictView = require('pict-view');
const libPictSectionFlow = require('pict-section-flow');

const libFlowCardMeadowTable = require('../flowcards/FlowCard-MeadowTable.js');

class MigrationManagerViewSchemaMigrator extends libPictView
{
	/**
	 * @param {Object} pFable - The Fable/Pict instance
	 * @param {Object} pOptions - View configuration options
	 * @param {String} pServiceHash - The service hash
	 */
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'PictView';

		/** @type {Object|null} */
		this._FlowView = null;
	}

	/**
	 * Build a map of FlowCard node type configurations for table nodes,
	 * including diff-colored variants.
	 *
	 * @return {Object} Hash of NodeType configurations keyed by Hash
	 */
	_buildFlowCardNodeTypes()
	{
		let tmpCardClasses =
		[
			libFlowCardMeadowTable.FlowCardMeadowTable,
			libFlowCardMeadowTable.FlowCardMeadowTableAdded,
			libFlowCardMeadowTable.FlowCardMeadowTableRemoved,
			libFlowCardMeadowTable.FlowCardMeadowTableModified
		];

		let tmpNodeTypes = {};

		for (let i = 0; i < tmpCardClasses.length; i++)
		{
			let tmpCard = new tmpCardClasses[i](this.fable, {}, 'FlowCard-MigratorTable-' + i);
			let tmpConfig = tmpCard.getNodeTypeConfiguration();
			tmpNodeTypes[tmpConfig.Hash] = tmpConfig;
		}

		return tmpNodeTypes;
	}

	/**
	 * Generate diff visualization data before rendering.
	 *
	 * If a DiffResult and target compiled schema exist, builds the
	 * diff-colored flow data for the interactive diagram.
	 *
	 * @param {Object} pRenderable - The renderable being rendered
	 */
	onBeforeRender(pRenderable)
	{
		let tmpAppData = this.fable.AppData.MigrationManager;

		// Reset migrator flow data
		tmpAppData.MigratorFlowData = { Nodes: [], Connections: [], ViewState: { PanX: 0, PanY: 0, Zoom: 1 } };

		let tmpDiffResult = tmpAppData.DiffResult;
		let tmpActiveSchemaName = tmpAppData.ActiveSchemaName;
		let tmpSchemaEntry = tmpActiveSchemaName ? tmpAppData.Schemas[tmpActiveSchemaName] : null;
		let tmpCompiledSchema = tmpSchemaEntry ? tmpSchemaEntry.CompiledSchema : null;

		if (tmpDiffResult && tmpCompiledSchema)
		{
			let tmpFlowBuilder = this.fable.instantiateServiceProviderIfNotExists('FlowDataBuilder');

			if (tmpFlowBuilder)
			{
				tmpAppData.MigratorFlowData = tmpFlowBuilder.buildDiffFlowData(tmpCompiledSchema, tmpDiffResult);
			}
		}

		return super.onBeforeRender(pRenderable);
	}

	/**
	 * After the HTML template is rendered, create the pict-section-flow
	 * diff view and render it into the migrator flow container.
	 *
	 * @param {Object} pRenderable - The renderable that was rendered
	 * @param {String} pRenderDestinationAddress - The destination address
	 * @param {Object} pRecord - The data record
	 * @param {String} pContent - The rendered content
	 */
	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		let tmpAppData = this.fable.AppData.MigrationManager;

		// Only create the flow view if there is diff data to show
		if (tmpAppData.MigratorFlowData && tmpAppData.MigratorFlowData.Nodes.length > 0)
		{
			if (!this._FlowView)
			{
				this._FlowView = this.pict.addView('MigrationManager-MigratorFlow',
					{
						ViewIdentifier: 'MigrationManager-MigratorFlow',

						DefaultRenderable: 'MigratorFlow-Container',
						DefaultDestinationAddress: '#MigrationManager-MigratorFlow-Container',

						AutoRender: false,

						FlowDataAddress: 'AppData.MigrationManager.MigratorFlowData',

						TargetElementAddress: '#MigratorFlow-SVG-Container',

						EnableToolbar: true,
						EnablePanning: true,
						EnableZooming: true,
						EnableNodeDragging: true,
						EnableConnectionCreation: false,
						EnableGridSnap: false,

						MinZoom: 0.1,
						MaxZoom: 5.0,
						ZoomStep: 0.1,

						DefaultNodeType: 'TABLE',
						DefaultNodeWidth: 260,
						DefaultNodeHeight: 200,

						NodeTypes: this._buildFlowCardNodeTypes(),

						Renderables:
						[
							{
								RenderableHash: 'MigratorFlow-Container',
								TemplateHash: 'MigratorFlow-Container-Template',
								DestinationAddress: '#MigrationManager-MigratorFlow-Container',
								RenderMethod: 'replace'
							}
						]
					},
					libPictSectionFlow
				);
			}

			// Reset and re-render
			this._FlowView.initialRenderComplete = false;
			this._FlowView.render();
		}

		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}
}

MigrationManagerViewSchemaMigrator.default_configuration =
{
	ViewIdentifier: 'MigrationManager-SchemaMigrator',

	DefaultRenderable: 'MigrationManager-SchemaMigrator-Content',
	DefaultDestinationAddress: '#MigrationManager-Content',

	AutoRender: false,

	CSS: /*css*/`
		#MigrationManager-SchemaMigrator {
			padding: 1em;
		}
		#MigrationManager-MigratorFlow-Container {
			height: 400px;
			border: 1px solid var(--theme-color-border-default, #ddd);
			border-radius: 4px;
			margin-bottom: 1em;
			background: var(--theme-color-background-secondary, #fafafa);
		}
		.migrator-diff-legend {
			display: flex;
			gap: 1.5em;
			margin-bottom: 1em;
			font-size: 0.9em;
		}
		.migrator-diff-legend span {
			display: flex;
			align-items: center;
			gap: 0.4em;
		}
		.legend-dot {
			display: inline-block;
			width: 12px;
			height: 12px;
			border-radius: 3px;
		}
		.legend-dot-added { background: var(--theme-color-status-success, #27ae60); }
		.legend-dot-removed { background: #c0392b; }
		.legend-dot-modified { background: #e67e22; }
		.legend-dot-unchanged { background: #2c3e50; }
		.migrator-diff .diff-section {
			display: flex;
			gap: 1em;
			flex-wrap: wrap;
		}
		.migrator-diff .diff-section > div {
			flex: 1;
			min-width: 200px;
		}
		.migrator-diff pre {
			background: #f8f9fa;
			border: 1px solid var(--theme-color-border-default, #e0e0e0);
			border-radius: 4px;
			padding: 1em;
			overflow-x: auto;
			font-size: 0.9em;
		}
		.migrator-actions {
			margin: 1em 0;
		}
		.migrator-actions button {
			padding: 0.5em 1.5em;
			margin-right: 0.5em;
			border: 1px solid var(--theme-color-border-default, #ddd);
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.9em;
		}
	`,

	Templates:
	[
		{
			Hash: 'MigrationManager-SchemaMigrator-Content',
			Template: [
				'<div id="MigrationManager-SchemaMigrator">',
				'  <h2>Schema Migrator</h2>',
				'  <div class="migrator-header">',
				'    <span>Schema: {~D:AppData.MigrationManager.ActiveSchemaName~}</span>',
				'    <span> &mdash; Connection: {~D:AppData.MigrationManager.ActiveConnectionName~}</span>',
				'  </div>',
				'  <div class="migrator-diff-legend">',
				'    <span><span class="legend-dot legend-dot-added"></span> Added</span>',
				'    <span><span class="legend-dot legend-dot-removed"></span> Removed</span>',
				'    <span><span class="legend-dot legend-dot-modified"></span> Modified</span>',
				'    <span><span class="legend-dot legend-dot-unchanged"></span> Unchanged</span>',
				'  </div>',
				'  <div id="MigrationManager-MigratorFlow-Container"></div>',
				'  <div class="migrator-diff">',
				'    <h3>Diff Result</h3>',
				'    <div class="diff-section">',
				'      <div class="diff-tables-added">',
				'        <h4>Tables to Add</h4>',
				'        <pre>{~D:AppData.MigrationManager.DiffTablesToAdd~}</pre>',
				'      </div>',
				'      <div class="diff-tables-removed">',
				'        <h4>Tables to Remove</h4>',
				'        <pre>{~D:AppData.MigrationManager.DiffTablesToRemove~}</pre>',
				'      </div>',
				'      <div class="diff-columns-changed">',
				'        <h4>Columns Changed</h4>',
				'        <pre>{~D:AppData.MigrationManager.DiffColumnsChanged~}</pre>',
				'      </div>',
				'    </div>',
				'  </div>',
				'  <div class="migrator-actions">',
				'    <button id="MigrationManager-SchemaMigrator-GenerateScript">Generate Migration Script</button>',
				'    <button id="MigrationManager-SchemaMigrator-Execute">Execute Migration</button>',
				'  </div>',
				'  <div id="MigrationManager-SchemaMigrator-Status" class="migrator-status">',
				'    <span>{~D:AppData.MigrationManager.MigrationStatus~}</span>',
				'  </div>',
				'</div>'
			].join('\n')
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'MigrationManager-SchemaMigrator-Content',
			TemplateHash: 'MigrationManager-SchemaMigrator-Content',
			DestinationAddress: '#MigrationManager-Content'
		}
	]
};

module.exports = MigrationManagerViewSchemaMigrator;
