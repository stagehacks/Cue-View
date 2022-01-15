exports.defaultName = 'QLab 4';
exports.connectionType = 'osc';
exports.searchOptions = {
  type: 'Bonjour',
  bonjourName: 'qlab',
};

exports.ready = function (device) {
  device.send('/workspaces');
};

exports.data = function (device, osc) {
  const address = osc.address;
  const p = osc.address.split('/');
  p.shift();

  //console.log(address)

  if (osc.address == '/reply/workspaces') {
    const d = JSON.parse(osc.args[0]).data;
    device.data.workspaces = {};
    for (let i = 0; i < d.length; i++) {
      device.data.workspaces[d[i].uniqueID] = {
        displayName: d[i].displayName,
        selectionIsPlayhead: true,
      };
      device.data.version = d[i].version;
      device.send(`/workspace/${d[i].uniqueID}/cueLists`);
      device.send(`/workspace/${d[i].uniqueID}/updates`, [
        { type: 'i', value: 1 },
      ]);
      device.send(`/cue/playbackPosition/uniqueID`);
      device.send(`/workspace/${d[i].uniqueID}/selectionIsPlayhead`);
    }
  } else if (p[1] == 'workspace' && p[3] == 'cueLists') {
    const workspace = p[2];
    const d = JSON.parse(osc.args[0]).data;
    device.data.workspaces[workspace].cueLists = {};
    device.data.workspaces[workspace].allCues = {};
    device.data.workspaces[workspace].allCuesOrdered = [];
    device.data.lastCueInGroup = {};

    for (let i in d) {
      device.data.workspaces[workspace].cueLists[d[i].uniqueID] = d[i];
      device.data.workspaces[workspace].cueLists[d[i].uniqueID].cues =
        d[i].cues;

      device.data.workspaces[workspace].allCues[d[i].uniqueID] = d[i];

      if(d[i].type=="Cart"){
        device.send(`/cue_id/${d[i].uniqueID}/cartColumns`);
        device.send(`/cue_id/${d[i].uniqueID}/cartRows`);
      }

      function getMoreCueInfo(group, groups_arg) {
        const groups = JSON.parse(JSON.stringify(groups_arg));
        groups.push(group.uniqueID);

        for (let cueIndex in group.cues) {
          const cue = group.cues[cueIndex];
           //console.log(cue)

          device.data.lastCueInGroup[group.uniqueID] = cue;

          cue.groups = groups;
          device.send(
            `/workspace/${workspace}/cue_id/${cue.uniqueID}/valuesForKeys`,
            [
              {
                type: 's',
                value:
                  '["mode", "parent", "isBroken", "preWait", "duration", "postWait", "continueMode", "cueTargetNumber", "isLoaded", "isRunning", "cartPosition", "displayName"]',
              },
            ]
          );
          cue.index =
            device.data.workspaces[workspace].allCuesOrdered.push(cue) - 1;

          if (cue.cues) {
            cue.mode = 0;
            getMoreCueInfo(cue, groups);
          }

          device.data.workspaces[workspace].allCues[cue.uniqueID] = cue;

          
        }
      }

      getMoreCueInfo(d[i], []);


    }

    // console.log(device.data.lastCueInGroup)

    device.draw();
  } else if (p[0] == 'update' && p[1] == 'workspace' && p[3] == 'cue_id') {
    device.send(`/workspace/${p[2]}/cueLists`);
  } else if (
    p[0] == 'update' &&
    p[1] == 'workspace' &&
    p[5] == 'playbackPosition'
  ) {
    //console.log('pb move');
    device.data.playbackPosition = osc.args[0];
    device.draw();
  } else if (p[0] == 'reply' && p[1] == 'cue_id') {

    const d = JSON.parse(osc.args[0]);
    const cueID = p[2];
    const workspace = d.workspace_id;
    const cueList = d.data.parent;

    if (p[3] == 'uniqueID') {
      // response to /cue/playbackPosition/uniqueID
      device.data.playbackPosition = d.data;

    } else if (p[3] == 'mode') {
      device.data.workspaces[workspace].allCues[cueID].mode = d.data;

    } else if (p[3] == 'valuesForKeys') {
      this.deviceInfoUpdate(device, 'status', 'ok');

      device.data.workspaces[workspace].allCues[cueID].mode = d.data.mode;
      device.data.workspaces[workspace].allCues[cueID].preWait = d.data.preWait;
      device.data.workspaces[workspace].allCues[cueID].duration =
        d.data.duration;
      device.data.workspaces[workspace].allCues[cueID].postWait =
        d.data.postWait;
      device.data.workspaces[workspace].allCues[cueID].continueMode =
        d.data.continueMode;
      device.data.workspaces[workspace].allCues[cueID].target =
        d.data.cueTargetNumber;
      device.data.workspaces[workspace].allCues[cueID].loaded = d.data.isLoaded;
      device.data.workspaces[workspace].allCues[cueID].broken = d.data.isBroken;
      device.data.workspaces[workspace].allCues[cueID].running =
        d.data.isRunning;
      device.data.workspaces[workspace].allCues[cueID].cartPosition =
        d.data.cartPosition;
      device.data.workspaces[workspace].allCues[cueID].displayName =
        d.data.displayName;
    }else if(p[3] == 'cartColumns'){
      device.data.workspaces[workspace].allCues[cueID].cartColumns = d.data;
    }else if(p[3] == 'cartRows'){
      device.data.workspaces[workspace].allCues[cueID].cartRows = d.data;
    }
    device.draw();
  } else if (p[1] == 'workspace' && p[3] == 'selectionIsPlayhead') {
    device.data.workspaces[p[2]].selectionIsPlayhead = JSON.parse(
      osc.args[0]
    ).data;
  } else {
  }
};

exports.heartbeat = function (device) {
  try {
    device.send(`/workspace/${Object.keys(device.data.workspaces)[0]}/thump`);
  } catch (err) {}
};
