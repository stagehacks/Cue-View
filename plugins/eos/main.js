const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Cue = require('./cue');

exports.defaultName = 'ETC Eos';
exports.connectionType = 'osc';
exports.searchOptions = {
  type: 'TCPport',
  searchBuffer: Buffer.from(
    '\xc0/eos/ping\x00\x00\x2c\x00\x00\x00\xc0',
    'ascii'
  ),
  testPort: 3032,
  validateResponse(msg, info) {
    return msg.toString().indexOf('/eos/out');
  },
};
exports.defaultPort = 3032;

exports.ready = function ready(device) {
  const d = device;
  d.data.EOS = new EOS();

  d.send('/eos/get/cuelist/count');
  d.send('/eos/get/version');
  d.send('/eos/subscribe', [{ type: 'i', value: 1 }]);
};

exports.data = function data(device, osc) {
  const p = osc.address.split('/');
  const d = device;
  p.shift();

  // console.log(osc.address)

  if (match(p, ['eos', 'out', 'show', 'name'])) {
    d.data.EOS.showName = osc.args[0];
    d.data.EOS.cueLists = {};
    this.deviceInfoUpdate(device, 'defaultName', osc.args[0]);
  } else if (match(p, ['eos', 'out', 'get', 'cuelist', 'count'])) {
    for (let i = 0; i < osc.args[0]; i++) {
      d.send(`/eos/get/cuelist/index/${i}`);
    }
  } else if (
    match(p, ['eos', 'out', 'get', 'cuelist', '*', 'list', '*', '*'])
  ) {
    d.data.EOS.cueLists[p[4]] = {};
    d.send(`/eos/get/cue/${p[4]}/count`);
  } else if (match(p, ['eos', 'out', 'get', 'cue', '*', 'count'])) {
    for (let i = 0; i < osc.args[0]; i++) {
      device.send(`/eos/get/cue/${p[4]}/index/${i}`);
    }
  } else if (
    match(p, ['eos', 'out', 'get', 'cue', '*', '*', '*', 'list', '*', '*'])
  ) {
    this.deviceInfoUpdate(device, 'status', 'ok');
    if (d.data.EOS.cueLists[p[4]][p[5]] === undefined) {
      d.data.EOS.cueLists[p[4]][p[5]] = {};
    }
    d.data.EOS.cueLists[p[4]][p[5]][p[6]] = new Cue(osc.args);

    device.update('cueData', {
      cue: device.data.EOS.cueLists[p[4]][p[5]],
      cueNumber: p[5],
      uid: osc.args[1],
    });
  } else if (match(p, ['eos', 'out', 'get', 'cue', '*', '*'])) {
    // There's no OSC notification of the deletion of a part. It just tells you to update the parent cue and remaining children.
    // So: we should fetch all the parts of a cue somehow every time there's an update to a cue.
    delete d.data.EOS.cueLists[p[4]][p[5]];
    d.draw();
  } else if (
    match(p, [
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
      d.data.EOS.cueLists[p[4]][p[5]][0].extLinks = osc.args[2];
    }
  } else if (match(p, ['eos', 'out', 'event', 'cue', '*', '*', 'fire'])) {
    d.data.EOS.activeCue = p[5];
    d.draw();
    d.update('activeCue', { uid: device.data.EOS.cueLists[p[4]][p[5]][0].uid });
  } else if (match(p, ['eos', 'out', 'notify', 'cue', '*', '*', '*', '*'])) {
    const cueList = p[4];
    const cueNumber = osc.args[1];
    d.send(`/eos/get/cue/${cueList}/${cueNumber}`);
  } else if (match(p, ['eos', 'out', 'get', 'version'])) {
    d.data.EOS.version = osc.args[0];
  } else {
    // console.log(osc);
  }
  // console.log(p)
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

function match(osc, array) {
  let out = true;
  if (osc.length !== array.length) {
    return false;
  }
  array.forEach((m, i) => {
    if (osc[i] !== m && m !== '*') {
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
