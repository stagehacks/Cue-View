exports.config = {
  defaultName: 'Show Cue Systems',
  connectionType: 'TCPsocket',
  defaultPort: 58000,
  mayChangePort: true,
  heartbeatInterval: 5000,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from('/_status', 'ascii'),
    testPort: 58000,
    validateResponse(msg, info) {
      return msg.toString().includes('/_status');
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

exports.ready = function ready(_device) {
  const device = _device;
  console.log('Show Cue Systems ready');
  device.data.cues = [];
  device.send(Buffer.from('/_prod/gettitle'));
};

exports.data = function data(_device, message) {
  const device = _device;
  this.deviceInfoUpdate(device, 'status', 'ok');
  const msg = message.toString();
  const messagePath = msg.substring(0, msg.indexOf(' '));
  if (messagePath === '/_prod/gettitle') {
    const title = msg.replace(messagePath, '').replaceAll('"', '').trim();
    this.deviceInfoUpdate(device, 'defaultName', title);
    device.send(Buffer.from('/_info/scsversion'));
  } else if (messagePath === '/_info/scsversion') {
    const versionInfo = msg.replace(messagePath, '').trim().split(' ');
    const versionNumber = versionInfo[0];
    const versionMajor = versionNumber.substring(0, 2).replace('0', '');
    const versionMinor = versionNumber.substring(2, 4).replace('0', '');
    const versionPatch = versionNumber.substring(4, 6).replace('0', '');
    const versionString = `${versionMajor}.${versionMinor}.${versionPatch}`;

    const versionType = versionMap[versionInfo[1]];
    device.data.version = {
      number: versionString,
      type: versionType,
    };
    device.send(Buffer.from('/_info/finalcue', 'ascii'));
  } else if (messagePath === '/_info/finalcue') {
    const cueCount = parseInt(msg.replace(messagePath, '').trim(), 10);
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
    device.send(Buffer.from(`/_cue/getitemsn 1 QNTCLSPARZ`));
  } else if (messagePath === '/_info/getcue') {
    const cueLabelInfo = msg.replace(messagePath, '').trim().split(' ');
    const cueNumber = parseInt(cueLabelInfo[0], 10);
    const cueLabel = cueLabelInfo[1].replaceAll('"', '');

    device.data.cues[cueNumber - 1].label = cueLabel;
    device.draw();
  } else if (messagePath === '/_cue/getpage') {
    const pageInfo = msg.replace(messagePath, '').trim().match(/".*?"/g);
    const cueLabel = pageInfo[0].replaceAll('"', '');
    const cueIndex = device.data.cues.map((cue) => cue.label).indexOf(cueLabel);
    device.data.cues[cueIndex].page = pageInfo[1].replaceAll('"', '');
    if (cueIndex < device.data.cues.length - 1) {
      device.send(Buffer.from(`/_cue/getpage ${device.data.cues[cueIndex + 1].label}`));
    } else {
      // console.log('done loading cue pages');
      device.draw();
      device.send(Buffer.from('/_status'));
    }
  } else if (messagePath === '/_cue/getname') {
    const nameInfo = msg.replace(messagePath, '').trim().match(/".*?"/g);
    const cueLabel = nameInfo[0].replaceAll('"', '');
    const cueIndex = device.data.cues.map((cue) => cue.label).indexOf(cueLabel);

    device.data.cues[cueIndex].description = nameInfo[1].replaceAll('"', '');
    device.draw();
  } else if (messagePath === '/_cue/gettype') {
    const typeInfo = msg.replace(messagePath, '').trim().match(/".*?"/g);
    const cueLabel = typeInfo[0].replaceAll('"', '');
    const cueIndex = device.data.cues.map((cue) => cue.label).indexOf(cueLabel);

    device.data.cues[cueIndex].type = {
      code: typeInfo[1].replaceAll('"', ''),
      display: typeMap[typeInfo[1].replaceAll('"', '')],
    };
    device.draw();
  } else if (messagePath === '/_cue/getitemsn') {
    const itemParts = msg
      .replace(messagePath, '')
      .trim('')
      .match(/".*?"|\d+/g);
    if (itemParts.length === 12) {
      const cueIndex = itemParts[0] - 1;
      device.data.cues[cueIndex].label = sanitizeSCSString(itemParts[2]);
      device.data.cues[cueIndex].description = sanitizeSCSString(itemParts[3]);
      device.data.cues[cueIndex].type = {
        code: sanitizeSCSString(itemParts[4]),
        display: typeMap[sanitizeSCSString(itemParts[4])],
      };
      device.data.cues[cueIndex].colors = sanitizeSCSString(itemParts[5]).split(', ');
      device.data.cues[cueIndex].length = millisToString(itemParts[6]);
      device.data.cues[cueIndex].state = itemParts[7];
      device.data.cues[cueIndex].position = itemParts[8];
      device.data.cues[cueIndex].activation = {
        code: sanitizeSCSString(itemParts[9]),
        display: activationMap[sanitizeSCSString(itemParts[9])],
      };
      device.data.cues[cueIndex].repeat = itemParts[10];
      device.data.cues[cueIndex].loop = itemParts[11];
      device.draw();

      if (cueIndex < device.data.cues.length - 1) {
        device.send(Buffer.from(`/_cue/getitemsn ${cueIndex + 2} QNTCLSPARZ`));
      } else {
        // console.log('done loading cue items');
        device.send(Buffer.from(`/_cue/getpage ${device.data.cues[0].label}`));
      }
    } else {
      console.error('bad response from getitems');
    }
  } else if (messagePath === '/_status') {
    const status = parseInt(msg.split(' ')[1].trim(), 10);
    console.log(`status: ${status}`);
  } else {
    console.error(`unhandled message path: ${messagePath}`);
  }
};

function sanitizeSCSString(string) {
  return string.substring(1, string.length - 1);
}

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

exports.heartbeat = function heartbeat(device) {};
