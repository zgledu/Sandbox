define( [ "module", "vwf/model" ], function( module, model ) {

    // vwf/model/object.js is a backstop property store.

    return model.load( module, {

        // == Module Definition ====================================================================

        // -- initialize ---------------------------------------------------------------------------

        initialize: function() {
            this.objects = {}; // maps id => { property: value, ... }
            this.creatingNode( undefined, 0 ); // global root  // TODO: to allow vwf.children( 0 ), vwf.getNode( 0 ); is this the best way, or should the kernel createNode( global-root-id /* 0 */ )?
        },

        // == Model API ============================================================================

        // -- creatingNode -------------------------------------------------------------------------

        creatingNode: function( nodeID, childID, childExtendsID, childImplementsIDs,
            childSource, childType, childName, callback /* ( ready ) */ ) {

            this.objects[childID] = {

                id: childID,
                extends: childExtendsID,
                implements: childImplementsIDs,

                source: childSource,
                type: childType,

                properties: {},
                children: [],

            };

        },

        // -- prototyping --------------------------------------------------------------------------

        prototyping: function( nodeID ) {  // TODO: not for global anchor node 0
            return this.objects[nodeID].extends;
        },

        // -- addingChild --------------------------------------------------------------------------

        addingChild: function( nodeID, childID, childName ) {  // TODO: not for global anchor node 0
            nodeID != 0 && this.objects[nodeID].children.push( this.objects[childID] );
        },

        // TODO: creatingProperties

        // -- settingProperties --------------------------------------------------------------------

        settingProperties: function( nodeID, properties ) {

            var node_properties = this.objects[nodeID].properties;

            for ( var propertyName in properties ) {  // TODO: since undefined values don't serialize to json, interate over node_properties (has-own only) instead and set to undefined if missing from properties?
                if ( node_properties.hasOwnProperty( propertyName ) ) {
                    node_properties[propertyName] = properties[propertyName];
                }
            }

            return node_properties;
        },

        // -- gettingProperties --------------------------------------------------------------------

        gettingProperties: function( nodeID, properties ) {
            return this.objects[nodeID].properties;
        },

        // -- creatingProperty ---------------------------------------------------------------------

        creatingProperty: function( nodeID, propertyName, propertyValue ) {
            return this.objects[nodeID].properties[propertyName] = propertyValue;
        },

        // TODO: deletingProperty

        // -- settingProperty ----------------------------------------------------------------------

        settingProperty: function( nodeID, propertyName, propertyValue ) {
            return this.objects[nodeID].properties[propertyName] = propertyValue;
        },

        // -- gettingProperty ----------------------------------------------------------------------

        gettingProperty: function( nodeID, propertyName, propertyValue ) {
            return this.objects[nodeID].properties[propertyName];
        },

getNode: function( nodeID ) {
    return JSON.parse( JSON.stringify( this.objects[nodeID] ) );
}


    } );

} );
