const _ = require('lodash');
const fs = require('fs');
const path = require('path');

let lastElapsedUpdate = Date.now();

exports.defaultName = 'QLab 4';
exports.connectionType = 'osc';
exports.heartbeatInterval = 50;
exports.heartbeatTimeout = 2000;
exports.searchOptions = {
  type: 'Bonjour',
  bonjourName: 'qlab',
};

exports.ready = function ready(device) {
  device.send(`/version`);
  device.send('/workspaces');
};

exports.data = function data(device, oscData) {
  const osc = oscData.address.split('/');
  osc.shift();
  const d = device;
  
  // console.log(oscData.address)

  if(match(osc, ["reply", "version"])){

    const json = JSON.parse(oscData.args[0]);
    d.data.version = json.data;

    this.deviceInfoUpdate(d, 'status', 'ok');


  }else if(match(osc, ["reply", "workspaces"])){
    
    const json = JSON.parse(oscData.args[0]);
    d.data.workspaces = {};

    json.data.forEach(wksp => {
    
      d.data.workspaces[wksp.uniqueID] = {
        uniqueID: wksp.uniqueID,
        displayName: wksp.displayName,
        cueLists: {},
        cues: {}
      }

      d.send(`/workspace/${wksp.uniqueID}/connect`);

    });


  }else if(match(osc, ["reply", "workspace", "*", "connect"])){

    d.send(`/workspace/${osc[2]}/updates`, [
      { type: 'i', value: 1 },
    ]);

    d.send(`/workspace/${osc[2]}/cueLists`);



  }else if(match(osc, ["reply", "workspace", "*", "cueLists"])){

    this.deviceInfoUpdate(d, 'status', 'ok');


    const workspace = d.data.workspaces[osc[2]];
    const json = JSON.parse(oscData.args[0]);

    workspace.cueLists = {};
    workspace.cues = {};


    json.data.forEach(ql => {
      workspace.cueLists[ql.uniqueID] = ql;
      addChildrenToWorkspace(workspace, ql);
    });

    d.draw();
    

    setTimeout(() => {
      json.data.forEach(ql => {
        workspace.cueLists[ql.uniqueID] = ql;
        getValuesForKeys(d, json.workspace_id, ql);
      });
    }, 0);



  }else if(match(osc, ["reply", "cue_id", "*", "children"])){

    const json = JSON.parse(oscData.args[0]);
    const workspace = d.data.workspaces[json.workspace_id];
    const cueID = osc[2];
    const cue = workspace.cues[cueID];

    if(!_.isEqual(cue.cues, json.data)){
      workspace.cueLists[cueID].cues = json.data;
      addChildrenToWorkspace(workspace, workspace.cueLists[cueID]);

      d.draw();

      getValuesForKeys(d, json.workspace_id, cue);
    }


  }else if(match(osc, ["reply", "cue_id", "*", "valuesForKeys"])){

    const json = JSON.parse(oscData.args[0]);
    const cueValues = json.data;

    const workspace = d.data.workspaces[json.workspace_id];
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
    cue.preWaitElapsed = cueValues.preWaitElapsed;
    cue.actionElapsed = cueValues.actionElapsed;
    cue.postWaitElapsed = cueValues.postWaitElapsed;

    const nestedGroupModes = [];
    const nestedGroupPosition = [0];
    let obj = cue;

    while(obj.parent !== "[root group of cue lists]"){
      nestedGroupModes.push(obj.groupMode);

      let pos = _.findIndex(workspace.cues[obj.parent].cues, {uniqueID: obj.uniqueID});
      pos = Math.abs(pos - workspace.cues[obj.parent].cues.length) - 1;
      nestedGroupPosition.push(pos)

      obj = workspace.cues[obj.parent];
    }
    cue.nestedGroupModes = nestedGroupModes;
    cue.nestedGroupPosition = nestedGroupPosition;

    // console.log("draw "+cue.number)

    d.update("updateCueData", {'cue': cue, 'allCues': workspace.cues, 'workspace': workspace});


  }else if(match(osc, ["reply", "cue_id", "*", "preWaitElapsed"])){

    const json = JSON.parse(oscData.args[0]);
    const workspace = d.data.workspaces[json.workspace_id];
    const cue = workspace.cues[osc[2]];

    cue.preWaitElapsed = json.data;
    lastElapsedUpdate = Date.now();

    d.update("updateCueData", {'cue': cue, 'allCues': workspace.cues, 'workspace': workspace});


  }else if(match(osc, ["reply", "cue_id", "*", "actionElapsed"])){

    const json = JSON.parse(oscData.args[0]);
    const workspace = d.data.workspaces[json.workspace_id];
    const cue = workspace.cues[osc[2]];

    cue.actionElapsed = json.data;
    lastElapsedUpdate = Date.now();

    d.update("updateCueData", {'cue': cue, 'allCues': workspace.cues, 'workspace': workspace});


  }else if(match(osc, ["reply", "cue_id", "*", "postWaitElapsed"])){

    const json = JSON.parse(oscData.args[0]);
    const workspace = device.data.workspaces[json.workspace_id];
    const cue = workspace.cues[osc[2]];

    cue.postWaitElapsed = json.data;
    lastElapsedUpdate = Date.now();

    d.update("updateCueData", {'cue': cue, 'allCues': workspace.cues, 'workspace': workspace});


  }else if(match(osc, ["update", "workspace", "*", "cue_id", "*"])){

    const workspace = d.data.workspaces[osc[2]];
    
    if(workspace){
      const cueLists = Object.keys(workspace.cueLists);
      const cueID = osc[4];

      if(cueID !== "[root group of cue lists"){
        if(cueLists.includes(cueID)){
          d.send(`/workspace/${workspace.uniqueID}/cue_id/${cueID}/children`);
        }

        d.send(`/workspace/${osc[2]}/cue_id/${cueID}/valuesForKeys`, [
          {type: 's', value: valuesForKeysString}
        ]);

      }
    }

  
  }else if(match(osc, ["update", "workspace", "*"])){
    // occurs when cue lists are reordered or a list is deleted
    d.send(`/workspace/${osc[2]}/cueLists`);


  }else if(match(osc, ["update", "workspace", "*", "dashboard"])){
    // this workspace might be new, let's check

    if(d.data.workspaces[osc[2]]){
      //
    }else{
      console.log("new workspace!");
      d.send('/workspaces');
    }


  }else if(match(osc, ["update", "workspace", "*", "cueList", "*", "playbackPosition"])){

    const workspace = d.data.workspaces[osc[2]];

    if(workspace){
      const cue = workspace.cues[oscData.args[0]];
      
      if(cue){
        workspace.playbackPosition = oscData.args[0] ? cue.uniqueID : "";
        d.update("updatePlaybackPosition", {'cue': cue});
      }
    }

  }else if(match(osc, ["update", "workspace", "*", "disconnect"])){

    delete d.data.workspaces[osc[2]];
    d.draw();

  }else{
    // console.log(address)
  }


  
};


const cueTemplate = _.template(fs.readFileSync(path.join(__dirname, `cue.ejs`)));
const tileTemplate = _.template(fs.readFileSync(path.join(__dirname, `tile.ejs`)));
const cartTemplate = _.template(fs.readFileSync(path.join(__dirname, `cart.ejs`)));

exports.update = function update(device, doc, updateType, data){

  if(updateType === "updateCueData"){
    const $elem = doc.getElementById(data.cue.uniqueID);

    if($elem){

      if(data.cue.type === "Cue List"){
        $elem.outerHTML = `<h3>${data.workspace.displayName} &mdash; ${data.cue.name}</h3>`;

      }else if(data.cue.type === "Cart"){
        $elem.outerHTML = cartTemplate({'tileTemplate': tileTemplate, 'cueList': data.cue, 'allCues': data.workspace.cues});
        
      }else if(data.cue.cartPosition && data.cue.cartPosition[0] !== 0){
        $elem.outerHTML = tileTemplate(data);
        
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









const valuesForKeysString = 
'["uniqueID","number","name","listName","isBroken","isRunning","isLoaded","isFlagged",'
+ '"type","children","preWait","postWait","currentDuration","colorName","continueMode",'
+ '"mode","parent","cartRows","cartColumns","cartPosition","displayName","preWaitElapsed",'
+ '"actionElapsed","postWaitElapsed","isPaused"]';

function addChildrenToWorkspace(workspace, q){
  const w = workspace;
  w.cues[q.uniqueID] = q;
  w.cues[q.uniqueID].nestedGroupModes = [];
  w.cues[q.uniqueID].nestedGroupPosition = [];

  if(q.cues){
    q.cues.forEach(cue => {
      addChildrenToWorkspace(w, cue);
    });
  }
}


function getValuesForKeys(device, workspaceID, q){
  device.send(`/workspace/${workspaceID}/cue_id/${q.uniqueID}/valuesForKeys`, [
    {type: 's', value: valuesForKeysString}
  ]);
  if(q.cues){
    q.cues.forEach(cue => {
      getValuesForKeys(device, workspaceID, cue);
    });
  }
}


function match(osc, array){
  let out = true;
  if(osc.length !== array.length){
    return false;
  }
  array.forEach((m, i)=> {
    if(osc[i] !== m && m !== "*"){
      out = false;
    }
  });
  return out;
}

let interval = 5;
let heartbeatCount = 0;
exports.heartbeat = function heartbeat(device) {
  heartbeatCount++;

  if(Date.now() - lastElapsedUpdate > 300){
    interval = 5;
  }else{
    interval = 1;
  }

  if(heartbeatCount % interval === 0){
    device.send(`/cue/active/preWaitElapsed`);
    device.send(`/cue/active/actionElapsed`);
    device.send(`/cue/active/postWaitElapsed`);
  }

};



