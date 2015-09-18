'use strict';

define(['./angular-app', './panelEditor', './EntityLibrary', './MaterialEditor'], function(app, baseClass){
    var primEditor = {};
    var isInitialized = false;

    window._PrimitiveEditor = {
        getSingleton: function(){
            if(!isInitialized){
                baseClass(primEditor,'PrimitiveEditor','Properties','properties',true,true,'#sidepanel .main')

                primEditor.init()
                //initialize.call(primEditor);
                primEditor.bind()
                isInitialized = true;
            }

            return primEditor;
        }
    };

    app.controller('PrimitiveController', ['$scope', function($scope){
        window._PrimitiveEditor = $scope;

        var flags = ["Name", "Visible","Static (does not move)", "Dynamic (moves frequently)", "Cast Shadows",
                     "Receive Shadows", "Passable (collides with avatars)", "Selectable (visible to pick)",
                     "Inherit Parent Scale"];
        var flagProps = ["DisplayName", "visible", "isStatic", "isDynamic", "castShadows", "receiveShadows", "passable", "isSelectable", "inheritScale"];

        $scope.flags = flags;
        $scope.flagProps = flagProps;

        var flagGroup = flagProps.map(function(elem){
            return "node.properties." + elem;
        });

        //Watch flags for changes
        $scope.$watchGroup(flagGroup, function(newVal, oldVal){
            if(newVal == oldVal) return;

            for(var i = 0; i < newVal.length; i++){
                var current = vwf.getProperty($scope.node.id, flagProps[i]);

                if(newVal[i] !== oldVal[i] && newVal[i] !== current){
                    if(newVal[i] || typeof newVal[i] === "boolean"){
                        setProperty($scope.node, flagProps[i], newVal[i]);
                    }
                    else if(i == 0 && !newVal[i]){
                        setProperty($scope.node, flagProps[0], $scope.node.id);
                    }
                }
            }
        });

        $scope.transform = {
            translation: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
        };

        $scope.$watch('node.properties.transform', updateTransform, true);
        $scope.$watch('transform', setTransform, true);

        $scope.allEditorData = [];
        $scope.node = null;

        $scope.$watch('fields.selectedNode', function(node){
            console.log("node", node);

            if(node){
                $scope.node = node;
                $scope.allEditorData.length = 0;

                recursevlyAddPrototypes(node, {});

                setFlags();
                updateTransform();
                setupAnimation();
            }
        });

        $scope.animationPlayState = false;
        $scope.playAnimation = function(){
            var method = $scope.animationPlayState ? "play" : "pause";
            callMethod($scope.node, {method: method});
        }

        function setupAnimation(){
            var node = $scope.node;
            var animationLength = vwf.getProperty(node.id, 'animationLength');

            if(animationLength > 0){
                //This should be moved into a yaml file and implemented by all objects that support animations
                $scope.animationEditorData = {
                    animationFrame: {displayname: "Animation Frame", property: "animationFrame", type: "slider", min: 0, max: parseFloat(animationLength), step: .01},
                    animationCycle: {displayname: "Animation Cycle", property: ["animationStart","animationEnd"], type: "rangeslider", min: 0, max: animationLength, step: .1},
                    animationSpeed: {displayname: "Animation Speed", property: "animationSpeed", type: "slider", min: 0, max: 10, step: .01},
                }
            }

            else if($scope.animationEditorData){
                $scope.animationEditorData = null;
            }
        }

        function rotationMatrix_2_XYZ(m) {
            var x = Math.atan2(m[9], m[10]);
            var y = Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10]));
            var z = Math.atan2(m[4], m[0]);
            return [x, y, z];
        }

        var transformFromVWF = false;
        function updateTransform(vwfTransform, oldTransform){
            if(vwfTransform == oldTransform) return;
            var node = $scope.node;
            try {
                //dont update the spinners when the user is typing in them, but when they drag the gizmo do.
                if (node && (vwf.client() !== vwf.moniker()) || $("#index-vwf:focus").length ==1) {

                    var mat = vwf.getProperty(node.id, 'transform');
                    var angles = rotationMatrix_2_XYZ(mat);
                    var pos = [mat[12],mat[13],mat[14]];

                    var scl = [MATH.lengthVec3([mat[0],mat[4],mat[8]]),MATH.lengthVec3([mat[1],mat[5],mat[9]]),MATH.lengthVec3([mat[2],mat[6],mat[10]])]

                    for(var i = 0; i < 3; i++){
                        //since there is ambiguity in the matrix, we need to keep these values aroud. otherwise , the typeins don't really do what you would think
                        var newRot = Math.round(angles[i] * 57.2957795);
                        var newScale = Math.floor(MATH.lengthVec3([mat[0],mat[1],mat[2]]) * 1000) / 1000;
                        var newPos = Math.floor(pos[i] * 1000) / 1000;

                        //If newX == oldX, then this is the tailend of the Angular-VWF roundtrip initiated by the Sandbox
                        if(newRot != $scope.transform.rotation[i] ||
                            newScale != $scope.transform.scale[i]  ||
                            newPos != $scope.transform.translation[i]){

                            $scope.transform.rotation[i] = newRot;
                            $scope.transform.scale[i] = newScale;
                            $scope.transform.translation[i] = newPos;

                            transformFromVWF = true;
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }


        function setTransform(transform, oldTransform) {
            if(transform != oldTransform && !transformFromVWF){
                var val = [0, 0, 0];
                var scale = [1, 1, 1];
                var pos = [0, 0, 0];

                for(var i = 0; i < 3; i++){
                    val[i] = !isNaN(transform.rotation[i]) ? transform.rotation[i] : 0;
                    scale[i] = parseFloat(transform.scale[i]);
                    pos[i] = parseFloat(transform.translation[i]);

                    if(isNaN(pos[i])) pos[i] = 0;
                    if(isNaN(scale[i])) scale[i] = 1;
                }

                var rotmat = makeRotMat(parseFloat(val[0]) / 57.2957795, parseFloat(val[1]) / 57.2957795, parseFloat(val[2]) / 57.2957795);
                rotmat = goog.vec.Mat4.scale(rotmat, scale[0], scale[1], scale[2]);

                pos = goog.vec.Mat4.translate(goog.vec.Mat4.createIdentity(), pos[0], pos[1], pos[2])
                var vwfTransform = goog.vec.Mat4.multMat(pos, rotmat, []);

                pushUndoEvent($scope.node, 'transform', vwfTransform);
                setProperty($scope.node, 'transform', vwfTransform);
            }

            transformFromVWF = false;
        }

        function makeRotMat(x, y, z) {
            var xm = [

                1, 0, 0, 0,
                0, Math.cos(x), -Math.sin(x), 0,
                0, Math.sin(x), Math.cos(x), 0,
                0, 0, 0, 1

            ];

            var ym = [

                Math.cos(y), 0, Math.sin(y), 0,
                0, 1, 0, 0, -Math.sin(y), 0, Math.cos(y), 0,
                0, 0, 0, 1
            ];

            var zm = [

                Math.cos(z), -Math.sin(z), 0, 0,
                Math.sin(z), Math.cos(z), 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1

            ];
            return goog.vec.Mat4.multMat(xm, goog.vec.Mat4.multMat(ym, zm, []), []);

        }

        function setFlags(){
            for(var i = 0; i < flagProps.length; i++){
                if($scope.node.properties[flagProps[i]] === undefined){
                    var temp = vwf.getProperty($scope.node.id, flagProps[i]);
                    if(temp !== undefined){
                        $scope.node.properties[flagProps[i]] = temp;
                    }
                }
            }
        }

        function buildEditorData(node, editorData, existingProps){
            if(editorData){

                var outEditorData = {};
                var numAdds = 0;
                for (var key in editorData) {
                    if(!(key in existingProps)){
                        numAdds++;
                        outEditorData[key] = editorData[key];
                        existingProps[key] = true;

                        //If propArr is an array, remove any duplicate elements
                        var props = outEditorData[key].property;
                        if(Array.isArray(props))
                            outEditorData[key].property = getUniqueElems(props);
                    }
                }

                if(numAdds == 0) return;

                //Remove duplicates in outEditorData[i].property if it's an array

                var props = node.properties;
                var obj = {
                    name: props.DisplayName || node.id,
                    type: props.type || vwf.getProperty(node.id, 'type'),
                    editorProps: outEditorData
                };

                $scope.allEditorData.push(obj);
                setInheritedProperties($scope.node, outEditorData);
            }
        }

        /**
            Iterate over properties in editorData. If it exists in the
            src node (base object), but not the dest node (derived object),
            then set the property on the derived object.
        */
        function setInheritedProperties(dest, editorData){
            for(var key in editorData){
                //vwfProp is necessary because the keys in EditorData are not always equal
                //to their respective "property" values. The VWF uses "property" internally.
                var vwfProp = editorData[key].property;

                //As it turns out, it's possible for vwfProp to be an array. The plot thickens.
                if(Array.isArray(vwfProp)){
                    for (var i = 0; i < vwfProp.length; i++) {
                        if(!(vwfProp[i] in dest.properties)){
                            setDefaultValue(dest, vwfProp[i], editorData[key].type);
                        }
                    }
                }
                else if(!(vwfProp in dest.properties)){
                    setDefaultValue(dest, vwfProp, editorData[key].type);
                }
            }
        }

        function setDefaultValue(dest, key, type){
            var value = vwf.getProperty(dest.id, key);

            if(value !== undefined){
                dest.properties[key] = value;
                //vwf.setProperty(dest.id, key, value);
            }
            else if(type === "color" || type === "vector"){

                var arr = [0, 0, 0];
                dest.properties[key] = arr;
                //vwf.setProperty(dest.id, key, arr);
            }
        }

        function recursevlyAddPrototypes(node, existingProps){
            if(node){
                var protoId = vwf.prototype(node.id);

                buildEditorData(node, vwf.getProperty(node.id, "EditorData"), existingProps);
                if(protoId) recursevlyAddPrototypes(_Editor.getNode(protoId), existingProps);
            }
        }
    }]);

    app.directive('vwfEditorProperty', ['$compile', function($compile){
        var lastValue = null;
        var valueBeforeSliding;

        function updateSliderValue(node, prop, value){
            console.log("Change in isUpdating!");
            var sliderValue = node.properties[prop];

            //On initial slide, save value before slide occurred
            //Once done sliding, push value onto undo stack
            if(value) valueBeforeSliding = sliderValue;
            else pushUndoEvent(node, prop, sliderValue, valueBeforeSliding);
        }

        function delayedUpdate(node, prop, value){
            console.log("delayedUpdate", value);

            if(lastValue === null){
                window.setTimeout(function(){
                    setProperty(node, prop, lastValue);
                    lastValue = null;
                }, 75);
            }

            lastValue = value;
        }

		function pickNode(vwfNode, vwfProp){
            _Editor.TempPickCallback = function(node) {
                if(!node) return;

                _RenderManager.flashHilight(findviewnode(node.id));
                _Editor.TempPickCallback = null;
                _Editor.SetSelectMode('Pick');

                pushUndoEvent(vwfNode, vwfProp.property, node.id);
                setProperty(vwfNode, vwfProp.property, node.id);
            };

            _Editor.SetSelectMode('TempPick');
        }

        function showPrompt(vwfNode, vwfProp, value){
            alertify.prompt('Enter a value for ' + vwfProp.property, function(ok, value) {
                if (ok){
                    pushUndoEvent(vwfNode, vwfProp.property, value);
                    setProperty(vwfNode, vwfProp.property, value);
                }
            }, value);
        }

        function linkFn(scope, elem, attr){
            scope.isUpdating = false;
            scope.onChange = function(index){
                //setTimeout is necessary because the model is not up-to-date when this event is fired
                window.setTimeout(function(){
                    var node = scope.vwfNode, prop = scope.property, value;
                    if(Array.isArray(prop)) prop = prop[index];

                    value = node.properties[prop];

                    if(value !== vwf.getProperty(node.id, prop)){
                        pushUndoEvent(node, prop, value);
                        setProperty(node, prop, value);
                    }

                }, 50);
            };

            if(scope.vwfProp){
                var exclude = ["vwfKey", "vwfNode", "vwfProp"];
                for(var key in scope.vwfProp){
                    if(exclude.indexOf(key) === -1)
                        scope[key] = scope.vwfProp[key];
                }

                console.log(scope.type);

                //Some Editor properties can actually be an array of properties!!
                if(Array.isArray(scope.property)){
                    //Some properties have duplicates (maybe to designate defaults?) Remove them.
                    scope.property = getUniqueElems(scope.property);
                    var uniques = scope.property.slice();
                    uniques.map(function(elem, i){
                        uniques[i] = 'vwfNode.properties.' + elem;
                    });

                    var getWatchFn = function(propIndex){
                        return function(newVal, oldVal){
                            if(Array.isArray(newVal)){
                                for (var i = 0; i < newVal.length; i++) {
                                    if(newVal[i] !== oldVal[i]){
                                        //scope.vwfNode[scope.property[propIndex]] = newVal;
                                        setProperty(scope.vwfNode, scope.property[propIndex], newVal);
                                        return;
                                    }
                                }
                            }
                            else if(scope.type === "rangeslider"){
                                //Update occasionally only while user is sliding
                                if(newVal !== oldVal && scope.isUpdating){
                                    delayedUpdate(scope.vwfNode, scope.property, newVal);
                                }
                            }
                            else if(newVal !== oldVal){
                                //scope.vwfNode[scope.property[propIndex]] = newVal;
                                setProperty(scope.vwfNode, scope.property[propIndex], newVal);
                            }
                        }
                    }

                    //Copy vectors instead of keeping a reference to array
                    if(scope.type === "rangevector"){
                        for(var i = 0; i < scope.property.length; i++){
                            var temp = scope.property[i];
                            scope.vwfNode.properties[temp] = scope.vwfNode.properties[temp].slice();
                        }

                        scope.$watch('isUpdating', function(newVal, oldVal){
                            if(newVal !== oldVal) updateSliderValue(vwfNode, scope.property, newVal);
                        });
                    }
                    else{
                        for (var i = 0; i < uniques.length; i++) {
                            scope.$watchCollection(uniques[i], getWatchFn(i));
                        }
                    }
                }
                else if(scope.type.indexOf("slider") > -1 || scope.type == "color"){
                    scope.$watch('vwfNode.properties[property]', function(newVal, oldVal){
                        console.log(scope.vwfProp, scope, newVal, oldVal, typeof newVal);

                        //Update occasionally only while user is sliding
                        if(newVal !== oldVal && scope.isUpdating){
                            delayedUpdate(scope.vwfNode, scope.property, newVal);
                        }
                    }, true);

                    scope.$watch('isUpdating', function(newVal, oldVal){
                        if(newVal !== oldVal) updateSliderValue(vwfNode, scope.property, newVal);
                    });
                }
                else if(scope.type === "nodeid") scope.pickNode = pickNode;
                else if(scope.type === "prompt") scope.showPrompt = showPrompt;
                else if(scope.type === "button") scope.callMethod = callMethod;
                else if(scope.type === "vector"){
                    scope.vwfNode.properties[scope.property] = scope.vwfNode.properties[scope.property].slice();
                }

                //Get template that corresponds with current type of property
                var template = $("#vwf-template-" + scope.type).html();
                $compile(template)(scope, function(e){
                    elem.html(e);
                });
            }
		}

		return {
			restrict: 'E',
			link: linkFn,
            replace: true,
            scope: { vwfProp: "=", vwfKey: "@", vwfNode: "=" },
		};
	}]);

    function callMethod(vwfNode, vwfProp){
        if (_UserManager.GetCurrentUserName() == null) {
            _Notifier.notify('You must log in to participate');
        }
        else if (vwfNode.id != 'selection') {
            if (_PermissionsManager.getPermission(_UserManager.GetCurrentUserName(), vwfNode.id) == 0) {
                _Notifier.notify('You do not have permission to edit this object');
                return;
            }
            vwf_view.kernel.callMethod(vwfNode.id, vwfProp.method);
        }
        else {
            alertify.alert('calling methods on multiple selections is not supported');
        }
    }

    function pushUndoEvent(node, prop, newVal, oldVal){
        console.log("New undo event!", prop, newVal, oldVal);
        if(oldVal != undefined)
            _UndoManager.pushEvent( new _UndoManager.SetPropertyEvent(node.id, prop, newVal, oldVal) );
        else
            _UndoManager.pushEvent( new _UndoManager.SetPropertyEvent(node.id, prop, newVal) );
    }

    function setProperty(node, prop, val) {
        if (_UserManager.GetCurrentUserName() == null) {
            _Notifier.notify('You must log in to participate');
            return;
        }
        else if (node && node.id) {
            if (_PermissionsManager.getPermission(_UserManager.GetCurrentUserName(), node.id) == 0) {
                _Notifier.notify('You do not have permission to edit this object');
                return;
            }
            vwf_view.kernel.setProperty(node.id, prop, val)
        }
        else {
            var undoEvent = new _UndoManager.CompoundEvent();

            for (var k = 0; k < _Editor.getSelectionCount(); k++) {
                if (_PermissionsManager.getPermission(_UserManager.GetCurrentUserName(), _Editor.GetSelectedVWFNode(k).id) == 0) {
                    _Notifier.notify('You do not have permission to edit this object');
                    continue;
                }

                undoEvent.push(new _UndoManager.SetPropertyEvent(_Editor.GetSelectedVWFNode(k).id, prop, val));
                vwf_view.kernel.setProperty(_Editor.GetSelectedVWFNode(k).id, prop, val)
            }
            if (!skipUndo)
                _UndoManager.pushEvent(undoEvent);
        }
    }

    function getUniqueElems(arr){
        var uniques = [];
        for (var i = 0; i < arr.length; i++) {
            if(uniques.indexOf(arr[i]) === -1)
                uniques.push(arr[i]);
        }
        return uniques;
    }

    return window._PrimitiveEditor;
}
// oldPrimEditor
);
