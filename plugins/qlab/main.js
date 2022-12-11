const _ = require('lodash');
const fs = require('fs');
const path = require('path');

exports.config = {
  defaultName: "QLab",
  connectionType: "osc",
  heartbeatInterval: 50,
  heartbeatTimeout: 2000,
  mayChangePort: true,
  searchOptions: {
    type: 'Bonjour',
    bonjourName: 'qlab',
  },
  fields: [{
    key: "passcode",
    label: "Pass",
    type: "textinput",
    value: "",
    action: function(device){
      device.send('/workspaces');
    }
  }]
}

let lastElapsedUpdate = Date.now();
let interval = 5;
let heartbeatCount = 0;

const valuesForKeysString = 
'["uniqueID","number","name","listName","isBroken","isRunning","isLoaded","isFlagged",'
+ '"type","children","preWait","postWait","currentDuration","colorName","continueMode",'
+ '"mode","parent","cartRows","cartColumns","cartPosition","displayName","preWaitElapsed",'
+ '"actionElapsed","postWaitElapsed","isPaused"]';

const cueTemplate = _.template(fs.readFileSync(path.join(__dirname, `cue.ejs`)));
const tileTemplate = _.template(fs.readFileSync(path.join(__dirname, `tile.ejs`)));
const cartTemplate = _.template(fs.readFileSync(path.join(__dirname, `cart.ejs`)));


exports.ready = function ready(device) {
  device.send(`/version`);
  device.send('/workspaces');
};

exports.data = function data(_device, oscData) {
  const device = _device;

  const oscAddressParts = oscData.address.split('/');
  oscAddressParts.shift();

  if(match(oscAddressParts, ["reply", "version"])){
    const json = JSON.parse(oscData.args[0]);
    device.data.version = json.data;

    this.deviceInfoUpdate(device, 'status', 'ok');
  }else if(match(oscAddressParts, ["reply", "workspaces"])){
    
    const json = JSON.parse(oscData.args[0]);
    device.data.workspaces = {};

    json.data.forEach(wksp => {
    
      device.data.workspaces[wksp.uniqueID] = {
        uniqueID: wksp.uniqueID,
        displayName: wksp.displayName,
        cueLists: {},
        cues: {}
      }
      device.send(`/workspace/${wksp.uniqueID}/connect`, device.fields.passcode);
    });
  }else if(match(oscAddressParts, ["reply", "workspace", "*", "connect"])){

    device.send(`/workspace/${oscAddressParts[2]}/updates`, [
      { type: 'i', value: 1 },
    ]);

    device.send(`/workspace/${oscAddressParts[2]}/cueLists`);

  }else if(match(oscAddressParts, ["reply", "workspace", "*", "cueLists"])){

    this.deviceInfoUpdate(device, 'status', 'ok');
    const workspace = device.data.workspaces[oscAddressParts[2]];
    const json = JSON.parse(oscData.args[0]);

    workspace.cueLists = {};
    workspace.cues = {};

    if(json.data){

      json.data.forEach(cueList => {
        workspace.cueLists[cueList.uniqueID] = cueList;
        addCueToWorkspace(workspace, cueList);
      });

      device.draw();

      setTimeout(() => {
        json.data.forEach(ql => {
          workspace.cueLists[ql.uniqueID] = ql;
          getValuesForKeys(device, json.workspace_id, ql);
        });
      }, 0);
    }

  }else if(match(oscAddressParts, ["reply", "cue_id", "*", "children"]) || match(oscAddressParts, ["reply", "workspace", "*", "cue_id", "*", "children"])){

    const json = JSON.parse(oscData.args[0]);
    const workspace = device.data.workspaces[json.workspace_id];
    const cueID = json.address.substring(55, 91);
    const cue = workspace.cues[cueID];

    if(!_.isEqual(cue.cues, json.data)){
      workspace.cueLists[cueID].cues = json.data;
      addCueToWorkspace(workspace, workspace.cueLists[cueID]);
      device.draw();
      getValuesForKeys(device, json.workspace_id, cue);
    }

  }else if(match(oscAddressParts, ["reply", "cue_id", "*", "valuesForKeys"]) || match(oscAddressParts, ["reply", "workspace", "*", "cue_id", "*", "valuesForKeys"])){

    const json = JSON.parse(oscData.args[0]);
    const cueValues = json.data;
    const workspace = device.data.workspaces[json.workspace_id];
    let cue = workspace.cues[cueValues.uniqueID];

    if(!cue){
      workspace.cues[cueValues.uniqueID] = {};
      cue = workspace.cues[cueValues.uniqueID];
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
    cue.paused = cueValues.isPaused;
    cue.type = cueValues.type;
    //cue.cues = cueValues.children;
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
    cue.preWaitElapsed = cueValues.preWaitElapsed;
    cue.actionElapsed = cueValues.actionElapsed;
    cue.postWaitElapsed = cueValues.postWaitElapsed;

    // QLab 5 fix
    if(cueValues.type=="Group" || cueValues.type=="Cue List"){
       cue.cues = cueValues.children;
    }else{
       cue.cues = undefined;
    }

    const nestedGroupModes = [];
    const nestedGroupPosition = [];


    let obj = cue;
    let sum = 0;

    if(obj.cues){
      sum+=obj.cues.length;
    }

    while(obj.parent !== "[root group of cue lists]"){

      let pos = _.findIndex(workspace.cues[obj.parent].cues, {uniqueID: obj.uniqueID});
      pos = Math.abs(pos - workspace.cues[obj.parent].cues.length)-1;

      if(obj.cues === undefined){
        sum += pos;
      }

      nestedGroupPosition.unshift(sum);

      if(obj.cues){
        sum+=pos;
        nestedGroupModes.unshift(obj.groupMode);
      }else{
        nestedGroupModes.unshift(workspace.cues[obj.parent].groupMode);
      }
      
      obj = workspace.cues[obj.parent];

    }

    cue.nestedGroupModes = nestedGroupModes;
    cue.nestedGroupPosition = nestedGroupPosition;

    device.update("updateCueData", {'cue': cue, 'allCues': workspace.cues, 'workspace': workspace});

  }else if(match(oscAddressParts, ["reply", "cue_id", "*", "preWaitElapsed"])){

    const json = JSON.parse(oscData.args[0]);
    const workspace = device.data.workspaces[json.workspace_id];
    const cue = workspace.cues[json.address.substring(55, 91)];

    cue.preWaitElapsed = json.data;
    lastElapsedUpdate = Date.now();

    device.update("updateCueData", {'cue': cue, 'allCues': workspace.cues, 'workspace': workspace});

  }else if(match(oscAddressParts, ["reply", "cue_id", "*", "actionElapsed"])){

    const json = JSON.parse(oscData.args[0]);
    const workspace = device.data.workspaces[json.workspace_id];
    const cue = workspace.cues[json.address.substring(55, 91)];

    cue.actionElapsed = json.data;
    lastElapsedUpdate = Date.now();

    device.update("updateCueData", {'cue': cue, 'allCues': workspace.cues, 'workspace': workspace});

  }else if(match(oscAddressParts, ["reply", "cue_id", "*", "postWaitElapsed"])){

    const json = JSON.parse(oscData.args[0]);
    const workspace = device.data.workspaces[json.workspace_id];
    const cue = workspace.cues[json.address.substring(55, 91)];

    cue.postWaitElapsed = json.data;
    lastElapsedUpdate = Date.now();

    device.update("updateCueData", {'cue': cue, 'allCues': workspace.cues, 'workspace': workspace});

  }else if(match(oscAddressParts, ["update", "workspace", "*", "cue_id", "*"])){

    const workspace = device.data.workspaces[oscAddressParts[2]];
    
    if(workspace){
      const cueLists = Object.keys(workspace.cueLists);
      const cueID = oscAddressParts[4];

      if(cueID !== "[root group of cue lists"){
        if(cueLists.includes(cueID)){
          device.send(`/workspace/${workspace.uniqueID}/cue_id/${cueID}/children`);
        }

        device.send(`/workspace/${oscAddressParts[2]}/cue_id/${cueID}/valuesForKeys`, [
          {type: 's', value: valuesForKeysString}
        ]);
      }
    }
  
  }else if(match(oscAddressParts, ["update", "workspace", "*"])){
    // occurs when cue lists are reordered or a list is deleted
    device.send(`/workspace/${oscAddressParts[2]}/cueLists`);

  }else if(match(oscAddressParts, ["update", "workspace", "*", "dashboard"])){
    // this workspace might be new, let's check
    if(device.data.workspaces[oscAddressParts[2]] === undefined){
      console.log("new workspace!");
      device.send('/workspaces');
    }

  }else if(match(oscAddressParts, ["update", "workspace", "*", "cueList", "*", "playbackPosition"])){

    const workspace = device.data.workspaces[oscAddressParts[2]];

    if(workspace){
      const cue = workspace.cues[oscData.args[0]];
      
      if(cue){
        workspace.playbackPosition = oscData.args[0] ? cue.uniqueID : "";
        device.update("updatePlaybackPosition", {'cue': cue});
      }
    }

  }else if(match(oscAddressParts, ["update", "workspace", "*", "disconnect"])){

    delete device.data.workspaces[oscAddressParts[2]];
    device.draw();

  }else{
    // console.log(address)
  }
  
};




exports.update = function update(device, doc, updateType, data){

  if(updateType === "updateCueData"){
    const $elem = doc.getElementById(data.cue.uniqueID);

    if($elem){

      if(data.cue.type === "Cue List"){
        $elem.outerHTML = `<h3>${data.workspace.displayName} &mdash; ${data.cue.name}</h3>`;

      }else if(data.cue.type === "Cart"){
        $elem.outerHTML = cartTemplate({'tileTemplate': tileTemplate, 'cueList': data.cue, 'allCues': data.workspace.cues});
        
      }else if(data.cue.cartPosition && data.cue.cartPosition[0] !== 0){
        // checking that the parent cue is a cart cue
        const parentCue = data.workspace.cues[data.cue.parent];
        if(parentCue && parentCue.type === "Cart"){
          $elem.outerHTML = tileTemplate(data);
        }else{
          $elem.outerHTML = cueTemplate(data);
        } 
        
      }else{
        $elem.outerHTML = cueTemplate(data);
      }
    }

  }else if(updateType === "updatePlaybackPosition"){
    Array.from(doc.getElementsByClassName("playback-position")).forEach(
    ($elem, index, array) => {
        $elem.classList.remove("playback-position");
    });

    const $elem = doc.getElementById(data.cue.uniqueID);
    $elem.classList.add("playback-position");
    $elem.scrollIntoView({behavior: "smooth", block: "center"});

  }
}



function addCueToWorkspace(_workspace, cue){
  const workspace = _workspace;
  workspace.cues[cue.uniqueID] = cue;
  workspace.cues[cue.uniqueID].nestedGroupModes = [];
  workspace.cues[cue.uniqueID].nestedGroupPosition = [];

  if(cue.cues){
    // this cue has children so add them as well
    cue.cues.forEach(childCue => {
      addCueToWorkspace(workspace, childCue);
    });
  }
}

function getValuesForKeys(device, workspaceID, cue){
  device.send(`/workspace/${workspaceID}/cue_id/${cue.uniqueID}/valuesForKeys`, [
    {type: 's', value: valuesForKeysString}
  ]);
  if(cue.cues){
    cue.cues.forEach(childCue => {
      getValuesForKeys(device, workspaceID, childCue);
    });
  }
}

function match(testArray, patternArray){
  let out = true;
  if(testArray.length !== patternArray.length){
    return false;
  }
  patternArray.forEach((patternPart, i)=> {
    if(testArray[i] !== patternPart && patternPart !== "*"){
      out = false;
    }
  });
  return out;
}


exports.heartbeat = function heartbeat(device) {
  heartbeatCount++;

  if(Date.now() - lastElapsedUpdate > 300){
    interval = 24;
  }else{
    interval = 1;
  }

  if(heartbeatCount % interval === 0){
    device.send(`/cue_id/active/preWaitElapsed`);
    device.send(`/cue_id/active/actionElapsed`);
    device.send(`/cue_id/active/postWaitElapsed`);
  }
};