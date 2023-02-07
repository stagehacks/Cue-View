exports.config = {
  defaultName: 'ATEM',
  connectionType: 'atem',
  defaultPort: 9910,
  mayChangePort: false,
  searchOptions: {
    type: 'UDPScan',
    searchBuffer: Buffer.from([
      0x10, 0x14, 0x53, 0xab, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3a, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00,
    ]),
    listenPort: 0,
    devicePort: 9910,
    validateResponse(msg, info) {
      // This is a tad bit hacky but works from what I can see.
      return Buffer.compare(msg.slice(0, 4), Buffer.from([16, 20, 83, 171])) === 0;
    },
  },
};

exports.ready = function ready(_device) {
  console.log('atem ready');
  const device = _device;
  device.data = device.connection.state;
  device.draw();

  // TODO: this is a little hacky but it works? gotta be better way to get initial update going
  const interval = setInterval(() => {
    device.update('inputs', device.data.video.mixEffects);
    device.update('fadeToBlack', device.data.video.mixEffects);
    device.update(`transitionPosition`, device.data.video.mixEffects);
    device.update('downstreamKeyers', device.data.video.downstreamKeyers);
  }, 1000);
  setTimeout(() => {
    clearInterval(interval);
  }, 4000);
};

exports.update = function update(device, _document, updateType, data) {
  const document = _document;
  switch (updateType) {
    case 'downstreamKeyers':
      for (let i = 0; i < data.length; i++) {
        const dsk = data[i];

        if (dsk.isAuto) {
          document.getElementById(`dsk-${i}-auto`).classList.add('atem-red');
        } else {
          document.getElementById(`dsk-${i}-auto`).classList.remove('atem-red');
        }

        if (dsk.onAir) {
          document.getElementById(`dsk-${i}-onair`).classList.add('atem-red');
        } else {
          document.getElementById(`dsk-${i}-onair`).classList.remove('atem-red');
        }

        if (dsk.properties.tie) {
          document.getElementById(`dsk-${i}-tie`).classList.add('atem-yellow');
        } else {
          document.getElementById(`dsk-${i}-tie`).classList.remove('atem-yellow');
        }

        if (dsk.remainingFrames === dsk.properties.rate) {
          document.getElementById(`dsk-${i}-rate`).textContent = '1:00';
        } else {
          // TODO: format in 0:00 format
          document.getElementById(`dsk-${i}-rate`).textContent = `00${dsk.remainingFrames}`.slice(-2);
        }
      }
      break;
    case 'transitionPosition':
      for (let i = 0; i < data.length; i++) {
        const tbarId = `me-${i}-tbar-pos`;
        if (document.getElementById(tbarId)) {
          document.getElementById(tbarId).value = data[i].transitionPosition.handlePosition;
        }
      }
      break;
    case 'fadeToBlack':
      for (let i = 0; i < data.length; i++) {
        const fadeToBlack = data[i].fadeToBlack;
        const ftbRateId = `me-${i}-ftb-rate`;
        const ftbId = `me-${i}-ftb`;
        if (fadeToBlack.remainingFrames === fadeToBlack.rate) {
          document.getElementById(ftbRateId).textContent = '1:00';
        } else {
          // TODO: format in 0:00 format
          document.getElementById(ftbRateId).textContent = `00${fadeToBlack.remainingFrames}`.slice(-2);
        }

        if (fadeToBlack.inTransition || fadeToBlack.isFullyBlack) {
          document.getElementById(ftbId).classList.add('atem-red');
        } else {
          document.getElementById(ftbId).classList.remove('atem-red');
        }
      }
      break;
    case 'inputs':
      for (let i = 0; i < data.length; i++) {
        const programInputs = device.connection.listVisibleInputs('program', i);
        const previewInputs = device.connection.listVisibleInputs('preview', i);

        Object.entries(device.data.inputs).forEach(([inputId, input]) => {
          if (programInputs.includes(Number(inputId))) {
            document.getElementById(`me-${i}-program-input-${inputId}`).classList.add('atem-red');
          } else {
            document.getElementById(`me-${i}-program-input-${inputId}`).classList.remove('atem-red');
          }

          if (previewInputs.includes(Number(inputId))) {
            document.getElementById(`me-${i}-preview-input-${inputId}`).classList.add('atem-green');
          } else {
            document.getElementById(`me-${i}-preview-input-${inputId}`).classList.remove('atem-green');
          }
        });
      }
      break;
    default:
      break;
  }
};

exports.data = function data(_device, msg) {
  const device = _device;
  this.deviceInfoUpdate(device, 'status', 'ok');
  device.data = msg.state;

  msg.pathToChange.forEach((path) => {
    if (path.includes('transitionPosition')) {
      device.update(`transitionPosition`, device.data.video.mixEffects);
    } else if (path.includes('downstreamKeyers')) {
      device.update('downstreamKeyers', device.data.video.downstreamKeyers);
    } else if (path.includes('fadeToBlack')) {
      device.update('fadeToBlack', device.data.video.mixEffects);
    } else if (path.includes('programInput')) {
      device.update('inputs', device.data.video.mixEffects);
    } else if (path.includes('previewInput')) {
      device.update('inputs', device.data.video.mixEffects);
    } else {
      console.log(path);
      console.log(device.data);
    }
  });
};
