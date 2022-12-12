const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Cue = require('./cue');

exports.config = {
  defaultName: 'ETC Eos',
  connectionType: 'osc',
  defaultPort: 3032,
  mayChangePort: false,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from(
      '\xc0/eos/ping\x00\x00\x2c\x00\x00\x00\xc0',
      'ascii'
    ),
    testPort: 3032,
    validateResponse(msg, info) {
      return msg.toString().indexOf('/eos/out');
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data.EOS = new EOS();
  device.send('/eos/get/cuelist/count');
  device.send('/eos/get/version');
  device.send('/eos/subscribe', [{ type: 'i', value: 1 }]);
};

exports.data = function data(_device, osc) {
  const device = _device;

  const addressParts = osc.address.split('/');
  addressParts.shift();

  if (match(addressParts, ['eos', 'out', 'show', 'name'])) {
    device.data.EOS.showName = osc.args[0];
    device.data.EOS.cueLists = {};
    this.deviceInfoUpdate(device, 'defaultName', osc.args[0]);
  } else if (match(addressParts, ['eos', 'out', 'get', 'cuelist', 'count'])) {
    for (let i = 0; i < osc.args[0]; i++) {
      device.send(`/eos/get/cuelist/index/${i}`);
    }
  } else if (
    match(addressParts, ['eos', 'out', 'get', 'cuelist', '*', 'list', '*', '*'])
  ) {
    device.data.EOS.cueLists[addressParts[4]] = {};
    device.send(`/eos/get/cue/${addressParts[4]}/count`);
  } else if (match(addressParts, ['eos', 'out', 'get', 'cue', '*', 'count'])) {
    for (let i = 0; i < osc.args[0]; i++) {
      device.send(`/eos/get/cue/${addressParts[4]}/index/${i}`);
    }
  } else if (
    match(addressParts, [
      'eos',
      'out',
      'get',
      'cue',
      '*',
      '*',
      '*',
      'list',
      '*',
      '*',
    ])
  ) {
    this.deviceInfoUpdate(device, 'status', 'ok');
    if (
      device.data.EOS.cueLists[addressParts[4]][addressParts[5]] === undefined
    ) {
      device.data.EOS.cueLists[addressParts[4]][addressParts[5]] = {};
    }
    device.data.EOS.cueLists[addressParts[4]][addressParts[5]][
      addressParts[6]
    ] = new Cue(osc.args);

    device.update('cueData', {
      cue: device.data.EOS.cueLists[addressParts[4]][addressParts[5]],
      cueNumber: addressParts[5],
      uid: osc.args[1],
    });
  } else if (match(addressParts, ['eos', 'out', 'get', 'cue', '*', '*'])) {
    // There's no OSC notification of the deletion of a part. It just tells you to update the parent cue and remaining children.
    // So: we should fetch all the parts of a cue somehow every time there's an update to a cue.
    delete device.data.EOS.cueLists[addressParts[4]][addressParts[5]];
    device.draw();
  } else if (
    match(addressParts, [
      'eos',
      'out',
      'get',
      'cue',
      '*',
      '*',
      '*',
      'actions',
      'list',
      '*',
      '*',
    ])
  ) {
    if (osc.args.length === 3) {
      device.data.EOS.cueLists[addressParts[4]][addressParts[5]][0].extLinks =
        osc.args[2];
    }
  } else if (
    match(addressParts, ['eos', 'out', 'event', 'cue', '*', '*', 'fire'])
  ) {
    device.data.EOS.activeCue = addressParts[5];
    device.draw();
    device.update('activeCue', {
      uid: device.data.EOS.cueLists[addressParts[4]][addressParts[5]][0].uid,
    });
  } else if (
    match(addressParts, ['eos', 'out', 'notify', 'cue', '*', '*', '*', '*'])
  ) {
    const cueList = addressParts[4];
    const cueNumber = osc.args[1];
    device.send(`/eos/get/cue/${cueList}/${cueNumber}`);
  } else if (match(addressParts, ['eos', 'out', 'get', 'version'])) {
    device.data.EOS.version = osc.args[0];
  } else {
    // console.log(osc);
  }
};

const cueTemplate = _.template(
  fs.readFileSync(path.join(__dirname, `cue.ejs`))
);

exports.update = function update(device, doc, updateType, data) {
  if (updateType === 'cueData') {
    const $elem = doc.getElementById(data.uid);

    if ($elem) {
      $elem.outerHTML = cueTemplate({
        q: data.cue,
        cueNumber: data.cueNumber,
        isActive: false,
      });
    } else {
      device.draw();
    }
  } else if (updateType === 'activeCue') {
    const $elem = doc.getElementById(data.uid);
    $elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

exports.heartbeat = function heartbeat(device) {
  device.send('/eos/ping');
};

function match(testArray, patternArray) {
  let out = true;
  if (testArray.length !== patternArray.length) {
    return false;
  }
  patternArray.forEach((patternPart, i) => {
    if (testArray[i] !== patternPart && patternPart !== '*') {
      out = false;
    }
  });
  return out;
}
class EOS {
  constructor() {
    this.version = '';
    this.showName = '';
    this.cueLists = {};
    this.activeCue = undefined;
  }
}
