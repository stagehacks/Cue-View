exports.config = {
  defaultName: 'LightFactory',
  connectionType: 'TCPsocket',
  remotePort: 3100,
  mayChangePorts: true,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from('\n', 'ascii'),
    testPort: 3100,
    validateResponse(msg, info) {
      return msg.toString().includes('LightFactory');
    },
  },
};

exports.ready = function ready(device) {
  device.data.cueLists = {};
  device.send('get cue list\n');
};

function cleanMessage(message) {
  return message.split('\n').filter((line) => line.trim() !== '');
}

// TODO(jwetzell): process updates? are they live or do we need to poll?
exports.data = function data(_device, _message) {
  const message = _message.toString();
  const device = _device;
  console.log(message);

  if (message.includes('Current Cue List')) {
    // NOTE(jwetzell): loading cue list info
    const cueListMessage = cleanMessage(message);
    if (cueListMessage.includes('<LIST START>') && cueListMessage.includes('<LIST FINISHED>')) {
      console.log('message is a cue list message');
      const cueListstartIndex = cueListMessage.indexOf('<LIST START>');
      const cueListFinishedIndex = cueListMessage.indexOf('<LIST FINISHED>');

      for (let i = cueListstartIndex + 1; i < cueListFinishedIndex; i++) {
        const cueListName = cueListMessage[i];
        if (device.data.cueLists[cueListName] === undefined) {
          device.data.cueLists[cueListName] = {
            name: cueListName,
            cues: {},
            active: false,
          };
        } else {
          // NOTE(jwetzell): reset active as it will be computed in a few lines
          device.data.cueLists[cueListName].active = false;
        }
      }
      const activeCueListLine = cueListMessage[cueListFinishedIndex + 1];
      if (activeCueListLine) {
        const activeCueListLineParts = activeCueListLine.split('Current Cue List');
        const activeCueList = activeCueListLineParts[activeCueListLineParts.length - 1].trim();
        if (activeCueList && device.data.cueLists[activeCueList] !== undefined) {
          device.data.cueLists[activeCueList].active = true;
        }
      }
      device.data.cueListToLoad = Object.keys(device.data.cueLists)[0];
      console.log(device.data.cueListToLoad);
      device.send(`get cues ${device.data.cueListToLoad}\n`);
    }
  } else if (message.includes('Current Live Cue')) {
    // NOTE(jwetzell): loading cues for a cue list
    const cueList = device.data.cueLists[device.data.cueListToLoad];
    const cueListCuesMessage = cleanMessage(message);

    console.log(cueListCuesMessage);
    if (cueListCuesMessage.includes('<LIST START>') && cueListCuesMessage.includes('<LIST FINISHED>')) {
      console.log('message is a cue list message');
      const cuesStartIndex = cueListCuesMessage.indexOf('<LIST START>');
      const cuesFinishedIndex = cueListCuesMessage.indexOf('<LIST FINISHED>');
      for (let i = cuesStartIndex + 1; i < cuesFinishedIndex; i++) {
        const cueName = cueListCuesMessage[i];
        if (cueList.cues[cueName] === undefined) {
          cueList.cues[cueName] = {
            name: cueName,
            active: false,
          };
        } else {
          // NOTE(jwetzell): reset active as it will be computed in a few lines
          cueList[cueName].active = false;
        }
      }
    }
    const cueListNames = Object.keys(device.data.cueLists);

    const cueListIndex = cueListNames.indexOf(device.data.cueListToLoad);
    device.data.cueListToLoad = cueListNames.at(cueListIndex + 1);
    if (device.data.cueListToLoad !== undefined) {
      device.send(`get cues ${device.data.cueListToLoad}\n`);
    }
  }
  device.draw();
};

// TODO(jwetzell): keep alive? refresh cue list info?
exports.heartbeat = function heartbeat(device) {};
