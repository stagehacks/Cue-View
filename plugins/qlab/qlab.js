let _ = require('lodash');

exports.defaultName = 'QLab 4';
exports.connectionType = 'osc';
exports.searchOptions = {
  type: 'Bonjour',
  bonjourName: 'qlab',
};

exports.ready = function (device) {
  device.send('/workspaces');
};

exports.data = function (device, oscData) {
  const address = oscData.address;
  let osc = oscData.address.split('/');
  osc.shift();

  let data;

  
  //console.log(address)

  if(match(osc, ["reply", "version"])){ // heartbeat response

    this.deviceInfoUpdate(device, 'status', 'ok');



  }else if(match(osc, ["reply", "workspaces"])){
    
    let json = JSON.parse(oscData.args[0]);
    json.data.forEach(wksp => {
      device.data.workspaces = {};

      device.data.workspaces[wksp.uniqueID] = {
        uniqueID: wksp.uniqueID,
        displayName: wksp.displayName,
        cueLists: {},
        cues: {}
      }

      device.send(`/workspace/${wksp.uniqueID}/connect`);

    });


  }else if(match(osc, ["reply", "workspace", "*", "connect"])){

    device.send(`/workspace/${osc[2]}/updates`, [
      { type: 'i', value: 1 },
    ]);

    device.send(`/workspace/${osc[2]}/cueLists`);



  }else if(match(osc, ["reply", "workspace", "*", "cueLists"])){

    this.deviceInfoUpdate(device, 'status', 'ok');

    let workspace = device.data.workspaces[osc[2]];
    let json = JSON.parse(oscData.args[0]);

    workspace.cueLists = {};
    workspace.cues = {};


    json.data.forEach(ql => {
      workspace.cueLists[ql.uniqueID] = ql;
      addChildrenToWorkspace(workspace, ql);
    });

    device.draw();

    setTimeout(function(){
      json.data.forEach(ql => {
        workspace.cueLists[ql.uniqueID] = ql;
        getValuesForKeys(device, json.workspace_id, ql);
      });
    }, 0);



  }else if(match(osc, ["reply", "cue_id", "*", "children"])){

    let json = JSON.parse(oscData.args[0]);
    let workspace = device.data.workspaces[json.workspace_id];
    let cue_id = osc[2];

    workspace.cueLists[cue_id].cues = json.data;
    addChildrenToWorkspace(workspace, workspace.cueLists[cue_id]);

    device.draw();

    getValuesForKeys(device, json.workspace_id, workspace.cues[cue_id]);



  }else if(match(osc, ["reply", "cue_id", "*", "valuesForKeys"])){

    let json = JSON.parse(oscData.args[0]);
    let cueValues = json.data;

    let workspace = device.data.workspaces[json.workspace_id];
    let cue = workspace.cues[cueValues.uniqueID];

    if(!cue){
      cue = workspace.cues[cueValues.uniqueID] = {};
    }

    cue.uniqueID = cueValues.uniqueID;
    cue.number = cueValues.number;
    cue.name = cueValues.name;
    cue.listName = cueValues.listName;
    cue.displayName = cueValues.displayName;
    cue.broken = cueValues.isBroken;
    cue.running = cueValues.isRunning;
    cue.loaded = cueValues.isLoaded;
    cue.flagged = cueValues.isFlagged;
    cue.type = cueValues.type;
    cue.cues = cueValues.children;
    cue.preWait = cueValues.preWait;
    cue.postWait = cueValues.postWait;
    cue.duration = cueValues.currentDuration;
    cue.colorName = cueValues.colorName;
    cue.continueMode = cueValues.continueMode;
    cue.groupMode = cueValues.mode;
    cue.parent = cueValues.parent;
    cue.cartRows = cueValues.cartRows;
    cue.cartColumns = cueValues.cartColumns;
    cue.cartPosition = cueValues.cartPosition;

    let nestedGroupModes = [];
    let nestedGroupPosition = [0];
    var obj = cue;

    while(obj.parent!="[root group of cue lists]"){
      nestedGroupModes.push(obj.groupMode);

      let pos = _.findIndex(workspace.cues[obj.parent].cues, {uniqueID: obj.uniqueID});
      pos= Math.abs(pos-workspace.cues[obj.parent].cues.length)-1;
      nestedGroupPosition.push(pos)

      obj = workspace.cues[obj.parent];
    }
    cue.nestedGroupModes = nestedGroupModes;
    cue.nestedGroupPosition = nestedGroupPosition;

    device.update("updateCueData", {cue: cue, allCues: workspace.cues, workspace: workspace});



  }else if(match(osc, ["update", "workspace", "*", "cue_id", "*"])){

    let workspace = device.data.workspaces[osc[2]];
    let cueLists = Object.keys(workspace.cueLists);
    let cue_id = osc[4];

    if(cueLists.includes(cue_id)){
      device.send(`/workspace/${workspace.uniqueID}/cue_id/${cue_id}/children`);
    }

    device.send(`/workspace/${osc[2]}/cue_id/${cue_id}/valuesForKeys`, [
      {type: 's', value: valuesForKeysString}
    ]);

  
  }else if(match(osc, ["update", "workspace", "*"])){
    // nothing here yet
    // occurs when cue lists are reordered or a list is deleted
    device.send(`/workspace/${osc[2]}/cueLists`);


  }else if(match(osc, ["update", "workspace", "*", "dashboard"])){
    // nothing here yet


  }else if(match(osc, ["update", "workspace", "*", "cueList", "*", "playbackPosition"])){

    let workspace = device.data.workspaces[osc[2]];
    let cue = workspace.cues[oscData.args[0]];

    if(cue) device.update("updatePlaybackPosition", {cue: cue});

  }else{
    console.log(address)
  }


  
};

const valuesForKeysString = 
'["uniqueID","number","name","listName","isBroken","isRunning","isLoaded","isFlagged",'
+'"type","children","preWait","postWait","currentDuration","colorName","continueMode",'
+'"mode","parent","cartRows","cartColumns","cartPosition","displayName"]';

function addChildrenToWorkspace(workspace, q){
  workspace.cues[q.uniqueID] = q;
  workspace.cues[q.uniqueID].nestedGroupModes = [];
  workspace.cues[q.uniqueID].nestedGroupPosition = [];

  if(q.cues){
    q.cues.forEach(q => {
      addChildrenToWorkspace(workspace, q);
    });
  }
}


function getValuesForKeys(device, workspace_id, q){
  device.send(`/workspace/${workspace_id}/cue_id/${q.uniqueID}/valuesForKeys`, [
    {type: 's', value: valuesForKeysString}
  ]);
  if(q.cues){
    q.cues.forEach(q => {
      getValuesForKeys(device, workspace_id, q);
    });
  }
}


function match(osc, array){
  let out = true;
  if(osc.length!=array.length){
    return false;
  }
  array.forEach((match, i)=> {
    if(osc[i]!=match && match!="*"){
      out = false;
    }
  });
  return out;
}


exports.heartbeat = function (device) {
  device.send(`/version`);
};