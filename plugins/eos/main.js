const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Cue = require('./cue');

exports.config = {
  defaultName: 'ETC Eos',
  connectionType: 'osc',
  defaultPort: 3037,
  mayChangePorts: true,
  heartbeatInterval: 5000,
  heartbeatTimeout: 6000,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from('\xc0/eos/ping\x00\x00\x2c\x00\x00\x00\xc0', 'ascii'),
    testPort: 3037,
    validateResponse(msg, info) {
      return msg.toString().includes('/eos/out');
    },
  },
  fields: [
    {
      key: 'cueListFilter',
      label: 'Q List',
      type: 'numberinput',
      value: '',
      action(_device) {
        const device = _device;
        device.data.cueListFilter = device.fields.cueListFilter;
        if (device.data.EOS) {
          subscribeToCueList(device);
        }
        device.draw();
      },
    },
  ],
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data.EOS = new EOS();
  device.templates = {
    cue: _.template(fs.readFileSync(path.join(__dirname, `cue.ejs`))),
  };
  device.data.cueListFilter = device.fields.cueListFilter;
  device.data.EOS.progressCueList = resolveConfiguredCueList(device);

  device.send('/eos/get/cuelist/count');
  device.send('/eos/get/version');
  device.send('/eos/subscribe', [{ type: 'i', value: 1 }]);

  // subscribe to the selected cue list specifically
  subscribeToCueList(device);
};

exports.data = function data(_device, osc) {
  const device = _device;
  this.deviceInfoUpdate(device, 'status', 'ok');

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
  } else if (match(addressParts, ['eos', 'out', 'get', 'cuelist', '*', 'list', '*', '*'])) {
    device.data.EOS.cueLists[addressParts[4]] = {};
    device.send(`/eos/get/cue/${addressParts[4]}/count`);
  } else if (match(addressParts, ['eos', 'out', 'get', 'cue', '*', 'count'])) {
    for (let i = 0; i < osc.args[0]; i++) {
      device.send(`/eos/get/cue/${addressParts[4]}/index/${i}`);
    }
  } else if (match(addressParts, ['eos', 'out', 'get', 'cue', '*', '*', '*', 'list', '*', '*'])) {
    if (device.data.EOS.cueLists[addressParts[4]] === undefined) {
      device.data.EOS.cueLists[addressParts[4]] = {};
      device.send(`/eos/get/cue/${addressParts[4]}/count`);
    }
    if (device.data.EOS.cueLists[addressParts[4]][addressParts[5]] === undefined) {
      device.data.EOS.cueLists[addressParts[4]][addressParts[5]] = {};
    }
    device.data.EOS.cueLists[addressParts[4]][addressParts[5]][addressParts[6]] = new Cue(osc.args);

    device.update('cueData', {
      cue: device.data.EOS.cueLists[addressParts[4]][addressParts[5]],
      cueListNumber: addressParts[4],
      cueNumber: addressParts[5],
      uid: osc.args[1],
    });
  } else if (match(addressParts, ['eos', 'out', 'get', 'cue', '*', '*'])) {
    // There's no OSC notification of the deletion of a part. It just tells you to update the parent cue and remaining children.
    // So: we should fetch all the parts of a cue somehow every time there's an update to a cue.
    delete device.data.EOS.cueLists[addressParts[4]][addressParts[5]];
    device.draw();
  } else if (match(addressParts, ['eos', 'out', 'get', 'cue', '*', '*', '*', 'actions', 'list', '*', '*'])) {
    if (osc.args.length === 3) {
      device.data.EOS.cueLists[addressParts[4]][addressParts[5]][0].extLinks = osc.args[2];
    }
  } else if (match(addressParts, ['eos', 'out', 'cuelist', '8001', '1'])) {
    const cueListNumber = resolveConfiguredCueList(device);
    const cueNumber = cueNumberValue(osc.args[1]);
    const totalMs = nonNegativeInt(osc.args[6]);
    const cueRemainingMs = nonNegativeInt(osc.args[7]);
    const previousCueNumber = cueNumberValue(device.data.EOS.activeCueByList[cueListNumber]);

    if (cueNumber !== undefined) {
      device.data.EOS.activeCueByList[cueListNumber] = cueNumber;
      device.data.EOS.activeCue = cueNumber;
    }

    if (cueNumber !== undefined || cueRemainingMs !== null || totalMs !== null) {
      const progress = device.data.EOS.progressByList[cueListNumber] || {};
      if (cueNumber !== undefined) {
        progress.cueNumber = cueNumber;
      }
      if (cueRemainingMs !== null) {
        progress.cueRemainingMs = cueRemainingMs;
      }
      if (totalMs !== null) {
        progress.totalMs = totalMs;
      }
      device.data.EOS.progressByList[cueListNumber] = progress;
    }

    if (previousCueNumber !== undefined && previousCueNumber !== cueNumber) {
      device.update('cueState', {
        cueListNumber,
        cueNumber: previousCueNumber,
      });
    }

    if (cueNumber !== undefined) {
      device.update('cueState', {
        cueListNumber,
        cueNumber,
      });
    }
  } else if (match(addressParts, ['eos', 'out', 'cuelist', '8001'])) {
    const cueListNumber = resolveConfiguredCueList(device);
    const followHangRemainingMs = nonNegativeInt(osc.args[2]);
    if (followHangRemainingMs !== null) {
      const progress = device.data.EOS.progressByList[cueListNumber] || {};
      const activeCueForList = cueNumberValue(device.data.EOS.activeCueByList[cueListNumber]);
      if (progress.cueNumber === undefined && activeCueForList !== undefined) {
        progress.cueNumber = activeCueForList;
      }
      progress.followHangRemainingMs = followHangRemainingMs;
      device.data.EOS.progressByList[cueListNumber] = progress;
      if (progress.cueNumber !== undefined) {
        device.update('cueState', {
          cueListNumber,
          cueNumber: progress.cueNumber,
        });
      }
    }
  } else if (match(addressParts, ['eos', 'out', 'event', 'cue', '*', '*', 'fire'])) {
    const cueListNumber = cueNumberValue(addressParts[4]);
    const cueNumber = cueNumberValue(addressParts[5]);
    const previousCueNumber = cueNumberValue(device.data.EOS.activeCueByList[cueListNumber]);

    device.data.EOS.activeCue = cueNumber;
    device.data.EOS.activeCueByList[cueListNumber] = cueNumber;
    device.data.EOS.progressByList[cueListNumber] = {
      cueNumber,
      cueRemainingMs: null,
      followHangRemainingMs: null,
      totalMs: null,
    };

    if (previousCueNumber !== undefined && previousCueNumber !== cueNumber) {
      device.update('cueState', {
        cueListNumber,
        cueNumber: previousCueNumber,
      });
    }
    device.update('cueState', {
      cueListNumber,
      cueNumber,
    });

    const cues = device.data.EOS.cueLists[addressParts[4]][addressParts[5]];
    if (cues) {
      device.update('activeCue', {
        uid: cues[0].uid,
      });
    }
  } else if (match(addressParts, ['eos', 'out', 'notify', 'cue', '*', '*', '*', '*'])) {
    const cueList = addressParts[4];
    const cueNumber = osc.args[1];
    device.send(`/eos/get/cue/${cueList}/${cueNumber}`);
  } else if (match(addressParts, ['eos', 'out', 'get', 'version'])) {
    device.data.EOS.version = osc.args[0];
  } else {
    // console.log(osc);
  }
};

exports.update = function update(device, doc, updateType, data) {
  if (updateType === 'cueData') {
    const $elem = doc.getElementById(data.uid);
    const cueState = cueRenderState(device, data.cueListNumber, data.cueNumber);
    if ($elem) {
      $elem.outerHTML = device.templates.cue({
        q: data.cue,
        cueNumber: data.cueNumber,
        isActive: cueState.isComplete,
        isComplete: cueState.isComplete,
        isRunning: cueState.isRunning,
        remainingDuration: cueState.remainingDuration,
        followHangRemainingDuration: cueState.followHangRemainingDuration,
      });
    } else {
      device.draw();
    }
  } else if (updateType === 'cueState') {
    const cueListNumber = cueNumberValue(data.cueListNumber);
    const cueNumber = cueNumberValue(data.cueNumber);
    const cues = device.data.EOS.cueLists?.[cueListNumber]?.[cueNumber];
    if (!cues || !cues[0]) {
      device.draw();
      return;
    }
    const $elem = doc.getElementById(cues[0].uid);
    if ($elem) {
      const cueState = cueRenderState(device, cueListNumber, cueNumber);
      $elem.outerHTML = device.templates.cue({
        q: cues,
        cueNumber,
        isActive: cueState.isComplete,
        isComplete: cueState.isComplete,
        isRunning: cueState.isRunning,
        remainingDuration: cueState.remainingDuration,
        followHangRemainingDuration: cueState.followHangRemainingDuration,
      });
    } else {
      device.draw();
    }
  } else if (updateType === 'activeCue') {
    const $elem = doc.getElementById(data.uid);
    if ($elem) {
      $elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
};

exports.heartbeat = function heartbeat(device) {
  device.send('/eos/ping');
};

function resolveConfiguredCueList(device) {
  const cueListFilter = cueNumberValue(device.data.cueListFilter);
  return cueListFilter || '1';
}

function subscribeToCueList(device) {
  const cueListNumber = resolveConfiguredCueList(device);
  const eosState = device.data.EOS;
  eosState.progressCueList = cueListNumber;
  device.send(`/eos/cuelist/8001/config/${cueListNumber}/0/0`);
}

function cueRenderState(device, cueListNumber, cueNumber) {
  const list = cueNumberValue(cueListNumber);
  const cue = cueNumberValue(cueNumber);
  const progress = device.data.EOS.progressByList[list];
  const activeCue = cueNumberValue(device.data.EOS.activeCueByList[list]);
  const cueRemainingMs = progress?.cueRemainingMs;
  const followHangRemainingMs = progress?.followHangRemainingMs;
  const isComplete = cue === activeCue;
  const isRunning =
    isComplete &&
    progress !== undefined &&
    cue === cueNumberValue(progress.cueNumber) &&
    cueRemainingMs !== null &&
    cueRemainingMs > 0;
  const hasFollowHangCountdown = isComplete && followHangRemainingMs !== null && followHangRemainingMs > 0;

  return {
    isRunning,
    isComplete,
    remainingDuration: isRunning ? cueRemainingMs : null,
    followHangRemainingDuration: hasFollowHangCountdown ? followHangRemainingMs : null,
  };
}

function cueNumberValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return `${value}`.trim();
}

function nonNegativeInt(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(0, Math.round(numericValue));
}

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
    this.activeCueByList = {};
    this.progressByList = {};
    this.progressCueList = '1';
  }
}
