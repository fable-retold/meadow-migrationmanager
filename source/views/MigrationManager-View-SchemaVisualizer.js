/**
 * Meadow Migration Manager - Schema Visualizer View
 *
 * Provides an interactive pict-section-flow diagram showing database tables
 * as nodes with field-level ports for foreign key relationships, plus a
 * text-based table list and relationship map for reference.
 *
 * Uses the FlowDataBuilder service to convert compiled schemas into
 * pict-section-flow data structures, and FlowCard-MeadowTable for the
 * visual appearance of each table node.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libPictView = require('pict-view');
const libPictSectionFlow = require('pict-section-flow');

const libFlowCardMeadowTable = require('../flowcards/FlowCard-MeadowTable.js');

class MigrationManagerViewSchemaVisualizer extends libPictView
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
	 * Build a map of FlowCard node type configurations for table nodes.
	 *
	 * Creates instances of each FlowCard variant and extracts their
	 * NodeType configuration for the flow view.
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
			let tmpCard = new tmpCardClasses[i](this.fable, {}, 'FlowCard-Table-' + i);
			let tmpConfig = tmpCard.getNodeTypeConfiguration();
			tmpNodeTypes[tmpConfig.Hash] = tmpConfig;
		}

		return tmpNodeTypes;
	}

	/**
	 * Generate visualization data before rendering.
	 *
	 * Locates the active schema's compiled output and calls the
	 * SchemaVisualizer service to produce table list, relationship map,
	 * and ASCII diagram strings.  Also calls FlowDataBuilder to produce
	 * the pict-section-flow data structure.  Stores results in AppData
	 * for template consumption.
	 *
	 * @param {Object} pRenderable - The renderable being rendered
	 */
	onBeforeRender(pRenderable)
	{
		let tmpAppData = this.fable.AppData.MigrationManager;
		let tmpActiveSchemaName = tmpAppData.ActiveSchemaName;
		let tmpSchemaEntry = tmpActiveSchemaName ? tmpAppData.Schemas[tmpActiveSchemaName] : null;
		let tmpCompiledSchema = tmpSchemaEntry ? tmpSchemaEntry.CompiledSchema : null;

		// Reset visualization data
		tmpAppData.VisualizerTableList = '';
		tmpAppData.VisualizerRelationshipMap = '';
		tmpAppData.SchemaFlowData = { Nodes: [], Connections: [], ViewState: { PanX: 0, PanY: 0, Zoom: 1 } };

		if (tmpCompiledSchema)
		{
			let tmpVisualizer = this.fable.instantiateServiceProviderIfNotExists('SchemaVisualizer');

			if (tmpVisualizer)
			{
				tmpAppData.VisualizerTableList = tmpVisualizer.generateTableList(tmpCompiledSchema);
				tmpAppData.VisualizerRelationshipMap = tmpVisualizer.generateRelationshipMap(tmpCompiledSchema);
			}

			// Build flow data for the interactive diagram
			let tmpFlowBuilder = this.fable.instantiateServiceProviderIfNotExists('FlowDataBuilder');

			if (tmpFlowBuilder)
			{
				tmpAppData.SchemaFlowData = tmpFlowBuilder.buildFlowData(tmpCompiledSchema);
			}
		}

		return super.onBeforeRender(pRenderable);
	}

	/**
	 * After the HTML template is rendered, create the pict-section-flow
	 * view and render it into the flow container element.
	 *
	 * @param {Object} pRenderable - The renderable that was rendered
	 * @param {String} pRenderDestinationAddress - The destination address
	 * @param {Object} pRecord - The data record
	 * @param {String} pContent - The rendered content
	 */
	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		if (!this._FlowView)
		{
			this._FlowView = this.pict.addView('MigrationManager-SchemaFlow',
				{
					ViewIdentifier: 'MigrationManager-SchemaFlow',

					DefaultRenderable: 'SchemaFlow-Container',
					DefaultDestinationAddress: '#MigrationManager-SchemaFlow-Container',

					AutoRender: false,

					FlowDataAddress: 'AppData.MigrationManager.SchemaFlowData',

					TargetElementAddress: '#SchemaFlow-SVG-Container',

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
							RenderableHash: 'SchemaFlow-Container',
							TemplateHash: 'SchemaFlow-Container-Template',
							DestinationAddress: '#MigrationManager-SchemaFlow-Container',
							RenderMethod: 'replace'
						}
					]
				},
				libPictSectionFlow
			);
		}

		// Reset the flow view's render state so it re-initializes SVG elements
		this._FlowView.initialRenderComplete = false;
		this._FlowView.render();

		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}
}

MigrationManagerViewSchemaVisualizer.default_configuration =
{
	ViewIdentifier: 'MigrationManager-SchemaVisualizer',

	DefaultRenderable: 'MigrationManager-SchemaVisualizer-Content',
	DefaultDestinationAddress: '#MigrationManager-Content',

	AutoRender: false,

	CSS: /*css*/`
		#MigrationManager-SchemaVisualizer {
			padding: 1em;
		}
		#MigrationManager-SchemaFlow-Container {
			height: 500px;
			border: 1px solid var(--theme-color-border-default, #ddd);
			border-radius: 4px;
			margin-bottom: 1em;
			background: var(--theme-color-background-secondary, #fafafa);
		}
		.visualizer-section {
			margin-bottom: 1em;
		}
		.visualizer-section h3 {
			margin: 0 0 0.5em 0;
			font-size: 1.1em;
			color: #2c3e50;
		}
		.visualizer-section pre {
			background: #f8f9fa;
			border: 1px solid var(--theme-color-border-default, #e0e0e0);
			border-radius: 4px;
			padding: 1em;
			overflow-x: auto;
			font-size: 0.9em;
		}
	`,

	Templates:
	[
		{
			Hash: 'MigrationManager-SchemaVisualizer-Content',
			Template: [
				'<div id="MigrationManager-SchemaVisualizer">',
				'  <h2>Schema Visualizer</h2>',
				'  <div class="visualizer-header">',
				'    <span>Schema: {~D:AppData.MigrationManager.ActiveSchemaName~}</span>',
				'  </div>',
				'  <div id="MigrationManager-SchemaFlow-Container"></div>',
				'  <div class="visualizer-section">',
				'    <h3>Table List</h3>',
				'    <pre>{~D:AppData.MigrationManager.VisualizerTableList~}</pre>',
				'  </div>',
				'  <div class="visualizer-section">',
				'    <h3>Relationship Map</h3>',
				'    <pre>{~D:AppData.MigrationManager.VisualizerRelationshipMap~}</pre>',
				'  </div>',
				'</div>'
			].join('\n')
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'MigrationManager-SchemaVisualizer-Content',
			TemplateHash: 'MigrationManager-SchemaVisualizer-Content',
			DestinationAddress: '#MigrationManager-Content'
		}
	]
};

module.exports = MigrationManagerViewSchemaVisualizer;
