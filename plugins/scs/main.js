exports.config = {
  defaultName: 'Show Cue Systems',
  connectionType: 'osc',
  defaultPort: 58100,
  mayChangePorts: true,
  heartbeatInterval: 5000,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from('/status', 'ascii'),
    testPort: 58100,
    validateResponse(msg, info) {
      return msg.toString().includes('/status');
    },
  },
  fields: [],
};

const typeMap = {
  A: 'Video/Image',
  E: 'Memo',
  F: 'Audio File',
  G: 'GoTo Cue',
  H: 'Multi-File Cue',
  I: 'Live Input',
  J: 'Enable/Disable',
  K: 'Lighting',
  L: 'Level Change',
  M: 'Control Send',
  N: 'Note',
  P: 'Playlist',
  Q: 'Call Cue',
  R: 'Run Program',
  S: 'SFR',
  T: 'Set Position',
  U: 'MIDI Time Code',
};

const versionMap = {
  10: 'LITE',
  20: 'STD',
  30: 'PRO',
  40: 'PLUS',
  45: 'DEMO',
  50: 'PLAT',
};

const activationMap = {
  man: 'Manual',
  'm+c': 'Manual w/ Confirmation',
  auto: 'Auto-start',
  'a+c': 'Auto-start w/ Confirmation',
  callq: 'Call Cue',
  hot: 'Hotkey (Trigger)',
  hktg: 'Hotkey (Toggle)',
  hknt: 'Hotkey (Note)',
  time: 'Time-Based',
  ext: 'External (Trigger)',
  extg: 'External (Toggle)',
  exnt: 'External (Note)',
  mtc: 'MIDI Time Code',
  ocm: 'On Cue Marker',
};

const stateMap = {
  0: 'Ready',
  1: 'Playing',
  2: 'Paused',
  3: 'Completed',
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data.cues = [];
  device.data.initialized = false;
  device.send('/prod/gettitle');
};

exports.data = function data(_device, oscData) {
  const device = _device;
  this.deviceInfoUpdate(device, 'status', 'ok');
  const messagePath = oscData.address;
  if (messagePath === '/prod/gettitle') {
    const title = oscData.args[0].replaceAll('"', '').trim();
    this.deviceInfoUpdate(device, 'defaultName', title);
    device.send('/info/scsversion');
  } else if (messagePath === '/info/scsversion') {
    const versionInfo = oscData.args;
    const versionNumber = versionInfo[0].toString();
    const versionMajor = versionNumber.substring(0, 2).replace('0', '');
    const versionMinor = versionNumber.substring(2, 4).replace('0', '');
    const versionPatch = versionNumber.substring(4, 6).replace('0', '');
    const versionString = `${versionMajor}.${versionMinor}.${versionPatch}`;

    const versionType = versionMap[versionInfo[1]];
    device.data.version = {
      number: versionString,
      type: versionType,
    };
    device.send('/info/finalcue');
  } else if (messagePath === '/info/finalcue') {
    const cueCount = oscData.args[0];
    if (cueCount !== device.data.cues.length) {
      device.data.initialized = false;
      device.data.cues = new Array(cueCount).fill(0).map(() => ({
        label: '',
        page: '',
        description: '',
        type: { code: '', display: '' },
        state: '',
        activation: { code: '', display: '' },
        file_info: '',
        length: '',
        colors: ['', ''],
      }));
      device.send('/cue/getitemsn', [
        { type: 'i', value: 1 },
        { type: 's', value: 'QNTCLSPARZ' },
      ]);
    }
  } else if (messagePath === '/info/getcue') {
    const cueLabelInfo = oscData.args;
    const cueNumber = cueLabelInfo[0];
    const cueLabel = cueLabelInfo[1].replaceAll('"', '');

    device.data.cues[cueNumber - 1].label = cueLabel;
    device.draw();
  } else if (messagePath === '/cue/getpage') {
    const pageInfo = oscData.args;
    const cueLabel = pageInfo[0].replaceAll('"', '');
    const cueIndex = device.data.cues.map((cue) => cue.label).indexOf(cueLabel);
    device.data.cues[cueIndex].page = pageInfo[1].replaceAll('"', '');
    if (cueIndex < device.data.cues.length - 1) {
      device.send('/cue/getpage', [{ type: 's', value: device.data.cues[cueIndex + 1].label }]);
    } else {
      device.draw();
      device.data.initialized = true;
      device.send('/status');
    }
  } else if (messagePath === '/cue/getname') {
    const nameInfo = oscData.args;
    const cueLabel = nameInfo[0].replaceAll('"', '');
    const cueIndex = device.data.cues.map((cue) => cue.label).indexOf(cueLabel);

    device.data.cues[cueIndex].description = nameInfo[1].replaceAll('"', '');
    device.draw();
  } else if (messagePath === '/cue/gettype') {
    const typeInfo = oscData.args;
    const cueLabel = typeInfo[0].replaceAll('"', '');
    const cueIndex = device.data.cues.map((cue) => cue.label).indexOf(cueLabel);

    device.data.cues[cueIndex].type = {
      code: typeInfo[1].replaceAll('"', ''),
      display: typeMap[typeInfo[1].replaceAll('"', '')],
    };
    device.draw();
  } else if (messagePath === '/cue/getitemsn') {
    const itemParts = oscData.args;
    if (itemParts.length === 12) {
      const cueIndex = itemParts[0] - 1;
      device.data.cues[cueIndex].label = itemParts[2];
      device.data.cues[cueIndex].description = itemParts[3];
      device.data.cues[cueIndex].type = {
        code: itemParts[4],
        display: typeMap[itemParts[4]],
      };
      device.data.cues[cueIndex].colors = itemParts[5].split(', ');
      device.data.cues[cueIndex].length = millisToString(itemParts[6]);
      device.data.cues[cueIndex].state = stateMap[itemParts[7]];
      device.data.cues[cueIndex].position = itemParts[8];
      device.data.cues[cueIndex].activation = {
        code: itemParts[9],
        display: activationMap[itemParts[9]],
      };
      device.data.cues[cueIndex].repeat = itemParts[10];
      device.data.cues[cueIndex].loop = itemParts[11];
      device.draw();

      if (!device.data.initialized) {
        if (cueIndex < device.data.cues.length - 1) {
          device.send('/cue/getitemsn', [
            { type: 'i', value: cueIndex + 2 },
            { type: 's', value: 'QNTCLSPARZ' },
          ]);
        } else {
          device.send('/cue/getpage', [{ type: 's', value: device.data.cues[0].label }]);
        }
      }
    } else {
      console.error('bad response from getitems');
    }
  } else if (messagePath === '/cue/statechange') {
    const cueLabel = oscData.args[0];
    const cueIndex = device.data.cues.map((cue) => cue.label).indexOf(cueLabel);
    if (cueIndex !== undefined) {
      device.data.cues[cueIndex].state = stateMap[oscData.args[1]];
      device.draw();
      device.send('/cue/getitemsn', [
        { type: 'i', value: cueIndex + 1 },
        { type: 's', value: 'QNTCLSPARZ' },
      ]);
    }
  } else if (messagePath === '/status') {
    // const status = oscData.args[0];
    device.send('/info/currcue');
  } else if (messagePath === '/connected') {
    device.send('/prod/gettitle');
  } else if (messagePath === '/info/currcue') {
    device.data.currentCue = oscData.args[0];
    device.draw();
  } else if (messagePath === '/info/nextcue') {
    device.data.nextCue = oscData.args[0];
    device.draw();
    device.data.initialized = false;
    device.send('/cue/getitemsn', [
      { type: 'i', value: 1 },
      { type: 's', value: 'QNTCLSPARZ' },
    ]);
  } else {
    console.error(`unhandled message path: ${messagePath}`);
  }
};

function millisToString(duration) {
  const milliseconds = parseInt(duration % 1000, 10);
  let seconds = parseInt((duration / 1000) % 60, 10);
  const minutes = parseInt((duration / (1000 * 60)) % 60, 10);

  if (minutes === 0) {
    return `${seconds}.${milliseconds}`;
  }
  if (seconds === 0) {
    return `0.${milliseconds}`;
  }
  if (seconds < 10) {
    seconds = `0${seconds}`;
  }
  return `${minutes}:${seconds}.${milliseconds}`;
}

exports.heartbeat = function heartbeat(device) {
  device.send('/info/finalcue');
};
