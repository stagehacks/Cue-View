exports.config = {
  defaultName: 'LightFactory',
  connectionType: 'TCPsocket',
  remotePort: 3100,
  mayChangePorts: true,
  heartbeatInterval: 5000,
  heartbeatTimeout: 10000,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from('\n', 'ascii'),
    testPort: 3100,
    validateResponse(msg, info) {
      return msg.toString().includes('LightFactory');
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data.cueLists = {};
  device.send('get cue list\n');
};

function cleanMessage(message) {
  return message.split('\n').filter((line) => line.trim() !== '');
}

// TODO(jwetzell): try to grab notes?
exports.data = function data(_device, _message) {
  const message = _message.toString();
  const device = _device;

  if (message.includes('Current Cue List')) {
    // NOTE(jwetzell): loading cue list info
    const cueListMessage = cleanMessage(message);
    if (cueListMessage.includes('<LIST START>') && cueListMessage.includes('<LIST FINISHED>')) {
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
      device.send(`get cues ${device.data.cueListToLoad}\n`);
    }
  } else if (message.includes('Current Live Cue')) {
    // NOTE(jwetzell): loading cues for a cue list
    const cueList = device.data.cueLists[device.data.cueListToLoad];
    const cueListCuesMessage = cleanMessage(message);

    // NOTE(jwetzell): this is so gross
    if (cueListCuesMessage.includes('<LIST START>') && cueListCuesMessage.includes('<LIST FINISHED>')) {
      const cuesStartIndex = cueListCuesMessage.indexOf('<LIST START>');
      const cuesFinishedIndex = cueListCuesMessage.indexOf('<LIST FINISHED>');

      const validCueNumbers = [];
      for (let i = cuesStartIndex + 1; i < cuesFinishedIndex; i++) {
        const cueData = cueListCuesMessage[i];
        const cueSplit = cueData.indexOf(' ');
        const cueNumber = cueSplit > 0 ? cueData.substring(0, cueSplit).trim() : cueData.trim();
        const cueName = cueSplit > 0 ? cueData.substring(cueSplit + 1).trim() : '';
        cueList.cues[cueNumber] = {
          name: cueName,
          number: cueNumber,
          active: false,
        };
        validCueNumbers.push(cueNumber);
      }

      const invalidCueNumbers = Object.keys(cueList.cues).filter((cueNumber) => !validCueNumbers.includes(cueNumber));

      invalidCueNumbers.forEach((cueNumber) => {
        delete cueList.cues[cueNumber];
      });

      const activeCueLine = cueListCuesMessage[cuesFinishedIndex + 1];
      if (activeCueLine) {
        const activeCueLineParts = activeCueLine.split('Current Live Cue');
        const activeCue = activeCueLineParts[activeCueLineParts.length - 1].trim();
        if (activeCue && cueList.cues[activeCue] !== undefined) {
          cueList.cues[activeCue].active = true;
        }
      }
    }
    // NOTE(jwetzell): load next cue list's cues if there is one
    const cueListNames = Object.keys(device.data.cueLists);
    const cueListIndex = cueListNames.indexOf(device.data.cueListToLoad);
    device.data.cueListToLoad = cueListNames.at(cueListIndex + 1);
    if (device.data.cueListToLoad !== undefined) {
      device.send(`get cues ${device.data.cueListToLoad}\n`);
    }
  } else if (message.includes('Running cue') || message.includes('Goto cue')) {
    const cueUpdateMessage = message
      .trim()
      .slice(0, -1)
      .split(':')
      .map((item) => item.trim());
    if (cueUpdateMessage.length === 3) {
      const cueListName = cueUpdateMessage[1];
      const updatedCue = cueUpdateMessage[2];

      const split = updatedCue.indexOf(' ');

      const updatedCueNumber = split > 0 ? updatedCue.substring(0, split).trim() : updatedCue.trim();
      if (device.data.cueLists[cueListName] !== undefined) {
        Object.entries(device.data.cueLists[cueListName].cues).forEach(([cueName, cueData]) => {
          cueData.active = cueData.number === updatedCueNumber;
        });
      }
    }
  }
  device.draw();
};

// TODO(jwetzell): keep alive? refresh cue list info?
exports.heartbeat = function heartbeat(device) {
  device.send('get cue list\n');
};
