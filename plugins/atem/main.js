const { TransitionStyle, TransitionSelection } = require('atem-connection/dist/enums');

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
    device.update('inputs', device.data);
    device.update('fadeToBlack', device.data);
    device.update(`transitionPosition`, device.data);
    device.update('downstreamKeyers', device.data);
    device.update('upstreamKeyers', device.data);
    device.update('transitionProperties', device.data);
  }, 1000);
  setTimeout(() => {
    clearInterval(interval);
  }, 4000);
};

exports.update = function update(device, _document, updateType, data) {
  const document = _document;
  if (updateType.includes('transitionPosition')) {
    for (let i = 0; i < data.video.mixEffects.length; i++) {
      const mixEffect = data.video.mixEffects[i];
      const tbarId = `me-${i}-tbar-div`;
      if (document.getElementById(tbarId)) {
        document.getElementById(tbarId).style.height = `${mixEffect.transitionPosition.handlePosition / 100}%`;
      }
      // TODO: format in 0:00 format
      document.getElementById(`me-${i}-transition-rate`).textContent =
        `00${mixEffect.transitionPosition.remainingFrames}`.slice(-2);
    }
  } else if (updateType.includes('downstreamKeyers')) {
    for (let i = 0; i < data.video.downstreamKeyers.length; i++) {
      const dsk = data.video.downstreamKeyers[i];
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

      document.getElementById(`dsk-${i}-rate`).textContent = `00${dsk.remainingFrames}`.slice(-2);
    }
  } else if (updateType.includes('fadeToBlack')) {
    for (let i = 0; i < data.video.mixEffects.length; i++) {
      const fadeToBlack = data.video.mixEffects[i].fadeToBlack;
      const ftbRateId = `me-${i}-ftb-rate`;
      const ftbId = `me-${i}-ftb`;

      // TODO: format in 0:00 format
      document.getElementById(ftbRateId).textContent = `00${fadeToBlack.remainingFrames}`.slice(-2);

      if (fadeToBlack.inTransition || fadeToBlack.isFullyBlack) {
        document.getElementById(ftbId).classList.add('atem-red');
      } else {
        document.getElementById(ftbId).classList.remove('atem-red');
      }
    }
  } else if (
    updateType.includes('programInput') ||
    updateType.includes('previewInput') ||
    updateType.includes('inputs')
  ) {
    for (let i = 0; i < data.video.mixEffects.length; i++) {
      const mixEffect = data.video.mixEffects[0];
      Object.keys(device.data.inputs)
        .map((key) => Number(key))
        .forEach((inputId) => {
          if (mixEffect.programInput === inputId) {
            document.getElementById(`me-${i}-program-input-${inputId}`).classList.add('atem-red');
          } else {
            document.getElementById(`me-${i}-program-input-${inputId}`).classList.remove('atem-red');
          }

          if (mixEffect.previewInput === inputId) {
            document.getElementById(`me-${i}-preview-input-${inputId}`).classList.add('atem-green');
          } else {
            document.getElementById(`me-${i}-preview-input-${inputId}`).classList.remove('atem-green');
          }
        });
    }
  } else if (updateType.includes('transitionProperties')) {
    for (let i = 0; i < data.video.mixEffects.length; i++) {
      const transitionProperties = data.video.mixEffects[i].transitionProperties;
      Object.keys(TransitionStyle)
        .filter((key) => !isNaN(Number(key)))
        .map((key) => Number(key))
        .forEach((style) => {
          if (style === transitionProperties.style) {
            document.getElementById(`me-${i}-transition-style-${style}`).classList.add('atem-yellow');
          } else {
            document.getElementById(`me-${i}-transition-style-${style}`).classList.remove('atem-yellow');
          }
          if (style === transitionProperties.nextStyle) {
            document.getElementById(`me-${i}-transition-style-${style}`).classList.add('atem-yellow');
          } else {
            document.getElementById(`me-${i}-transition-style-${style}`).classList.remove('atem-yellow');
          }
        });

      Object.keys(TransitionSelection)
        .filter((key) => !isNaN(Number(key)))
        .map((key) => Number(key))
        .forEach((selection) => {
          if (transitionProperties.selection.includes(selection)) {
            document.getElementById(`me-${i}-transition-selection-${selection}`).classList.add('atem-yellow');
          } else {
            document.getElementById(`me-${i}-transition-selection-${selection}`).classList.remove('atem-yellow');
          }

          if (transitionProperties.nextSelection.includes(selection)) {
            document.getElementById(`me-${i}-transition-selection-${selection}`).classList.add('atem-yellow');
          } else {
            document.getElementById(`me-${i}-transition-selection-${selection}`).classList.remove('atem-yellow');
          }
        });
    }
  } else if (updateType.includes('upstreamKeyers')) {
    for (let i = 0; i < data.video.mixEffects.length; i++) {
      const upstreamKeyers = data.video.mixEffects[i].upstreamKeyers;
      upstreamKeyers.forEach((upstreamKeyer) => {
        if (upstreamKeyer.onAir) {
          document.getElementById(`me-${i}-key-${upstreamKeyer.upstreamKeyerId + 1}-onair`).classList.add('atem-red');
        } else {
          document
            .getElementById(`me-${i}-key-${upstreamKeyer.upstreamKeyerId + 1}-onair`)
            .classList.remove('atem-red');
        }
      });
    }
  } else {
    console.log('unhandled update');
    console.log(updateType);
    console.log(device.data);
  }
};

exports.data = function data(_device, msg) {
  const device = _device;
  this.deviceInfoUpdate(device, 'status', 'ok');
  device.data = msg.state;

  msg.pathToChange.forEach((path) => {
    device.update(path, device.data);
  });
};
