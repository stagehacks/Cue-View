exports.config = {
  defaultName: 'Livestream Studio',
  connectionType: 'TCPsocket',
  remotePort: 9923,
  mayChangePort: false,
  searchOptions: {
    type: 'TCPport',
    searchBuffer: Buffer.from(''),
    testPort: 9923,
    validateResponse(msg, info) {
      return msg.toString().startsWith('ILCC:');
    },
  },
};

exports.ready = function ready(_device) {
  console.log('livestream studio ready');
  const device = _device;
  device.draw();

  setInterval(() => {
    device.update('inputs', device.data);
    device.update('fadeToBlack', device.data);
  }, 1000);
};

exports.update = function update(device, _document, updateType, data) {
  const document = _document;
  if (updateType === 'programInput' || updateType === 'previewInput' || updateType === 'inputs') {
    device.data.inputs.forEach((input) => {
      if (device.data.program === input.number) {
        document.getElementById(`program-input-${input.number}`).classList.add('lss-red');
        document.getElementById(`input-${input.number}`).classList.add('lss-red');
      } else {
        document.getElementById(`program-input-${input.number}`).classList.remove('lss-red');
        document.getElementById(`input-${input.number}`).classList.remove('lss-red');
      }

      if (device.data.preview === input.number) {
        document.getElementById(`preview-input-${input.number}`).classList.add('lss-green');
        document.getElementById(`input-${input.number}`).classList.add('lss-green');
      } else {
        document.getElementById(`preview-input-${input.number}`).classList.remove('lss-green');
        document.getElementById(`input-${input.number}`).classList.remove('lss-green');
      }
    });
  } else if (updateType === 'fadeToBlack') {
    const ftbId = 'ftb';

    if (device.data.fadeToBlack) {
      if (document.getElementById(ftbId).classList.contains('lss-red')) {
        document.getElementById(ftbId).classList.remove('lss-red');
      } else {
        document.getElementById(ftbId).classList.add('lss-red');
      }
    } else {
      document.getElementById(ftbId).classList.remove('lss-red');
    }
  } else if (updateType === 'tbar') {
    const tbarId = `tbar-div`;
    const tbarHandleId = `tbar-handle-div`;
    if (document.getElementById(tbarId)) {
      document.getElementById(tbarId).style.height = `${device.data.tBar.percent}%`;
    }
    if (document.getElementById(tbarHandleId)) {
      document.getElementById(tbarHandleId).style.bottom = `${device.data.tBar.percent}%`;
    }

    if (device.data.tBar.status === 'Automatic') {
      document.getElementById(`auto`).classList.add('lss-red');
    } else {
      document.getElementById(`auto`).classList.remove('lss-red');
    }
  } else if (updateType === 'cut') {
    document.getElementById('cut').classList.add('lss-red');
    setTimeout(() => {
      document.getElementById('cut').classList.remove('lss-red');
    }, 250);
  }
};

exports.data = function data(_device, msg) {
  const device = _device;

  this.deviceInfoUpdate(device, 'status', 'ok');

  const packets = msg.toString().split('\n');

  packets.forEach((packet) => {
    const packetParts = packet.split(':');
    const packetType = packetParts[0];
    if (packetType === 'ILC') {
      if (device.data.inputs === undefined) {
        device.data.inputs = [];
      }
      device.data.inputs[packetParts[1]] = {
        number: Number.parseInt(packetParts[1], 10) + 1,
        name: packetParts[2].replaceAll('"', ''),
        audio: {
          level: parseFloat(packetParts[3]) / 1000,
          gain: parseFloat(packetParts[4]) / 1000,
          mute: packetParts[5] === '1',
          solo: packetParts[6] === '1',
          programLock: packetParts[7] === '1',
        },
        type: packetParts[8],
      };
      device.draw();
      device.update('inputs', device.data);
    } else if (packetType === 'ILCC') {
      if (device.data.inputCount !== undefined) {
        device.data.inputs = [];
      }
      device.data.inputCount = Number.parseInt(packetParts[1], 10);
    } else if (packetType === 'PmIS') {
      device.data.program = Number.parseInt(packetParts[1], 10) + 1;
      device.update('programInput', device.data);
    } else if (packetType === 'PwIS') {
      device.data.preview = Number.parseInt(packetParts[1], 10) + 1;
      device.update('previewInput', device.data);
    } else if (packetType === 'Cut') {
      [device.data.preview, device.data.program] = [device.data.program, device.data.preview];
      device.update('cut');
      device.update('program', device.data);
    } else if (packetType === 'FOut') {
      device.data.fadeToBlack = true;
      device.update('fadeToBlack', device.data);
    } else if (packetType === 'FIn') {
      device.data.fadeToBlack = false;
      device.update('fadeToBlack', device.data);
    } else if (packetType === 'TrASp' || packetType === 'TrMSp') {
      if (device.data.tBar === undefined) {
        device.data.tBar = {};
      }
      device.data.tBar.status = packetType === 'TrASp' ? 'Automatic' : 'Manual';
      device.data.tBar.percent = Number.parseInt(packetParts[1], 10) / 10;
      if (device.data.tBar.percent === 0) {
        device.data.tBar.status = 'Stop';
      }
      device.update('tbar', device.data);
    } else if (packetType === 'TrAStart' || packetType === 'TrAStop') {
      device.data.tBar.status = packetType.slice(3);
      if (packetType === 'TrAStop') {
        device.data.tBar.percent = 0;
      }
      device.update('tbar', device.data);
    }
  });
};
