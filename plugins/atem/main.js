const { TransitionStyle, TransitionSelection } = require('atem-connection/dist/enums');

let timerFrameRate;

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

  // TODO: this is a little hacky but it works? gotta be a way to hook into device.draw() to trigger update
  setInterval(() => {
    device.update('inputs', device.data);
    device.update('fadeToBlack', device.data);
    device.update(`transitionPosition`, device.data);
    device.update('downstreamKeyers', device.data);
    device.update('upstreamKeyers', device.data);
    device.update('transitionProperties', device.data);
    device.update('deviceInfo', device.data);
  }, 1000);
};

exports.update = function update(device, _document, updateType, data) {
  const document = _document;

  if (updateType.includes('transitionPosition')) {
    for (let i = 0; i < data.video.mixEffects.length; i++) {
      const mixEffect = data.video.mixEffects[i];
      const tbarId = `me-${i}-tbar-div`;
      const tbarHandleId = `me-${i}-tbar-handle-div`;
      if (document.getElementById(tbarId)) {
        document.getElementById(tbarId).style.height = `${mixEffect.transitionPosition.handlePosition / 100}%`;
      }
      if (document.getElementById(tbarHandleId)) {
        document.getElementById(tbarHandleId).style.bottom = `${mixEffect.transitionPosition.handlePosition / 100}%`;
      }
      // TODO: format in 0:00 format
      document.getElementById(`me-${i}-transition-rate`).textContent = framesToTime(
        mixEffect.transitionPosition.remainingFrames
      );

      if (mixEffect.transitionPosition.inTransition) {
        document.getElementById(`me-${i}-auto`).classList.add('atem-red');
      } else {
        document.getElementById(`me-${i}-auto`).classList.remove('atem-red');
      }
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

      document.getElementById(`dsk-${i}-rate`).textContent = framesToTime(dsk.remainingFrames);
    }
  } else if (updateType.includes('fadeToBlack')) {
    for (let i = 0; i < data.video.mixEffects.length; i++) {
      const fadeToBlack = data.video.mixEffects[i].fadeToBlack;
      const ftbRateId = `me-${i}-ftb-rate`;
      const ftbId = `me-${i}-ftb`;

      // TODO: format in 0:00 format
      document.getElementById(ftbRateId).textContent = framesToTime(fadeToBlack.remainingFrames);

      if (fadeToBlack.isFullyBlack) {
        if (document.getElementById(ftbId).classList.contains('atem-red')) {
          document.getElementById(ftbId).classList.remove('atem-red');
        } else {
          document.getElementById(ftbId).classList.add('atem-red');
        }
      } else if (fadeToBlack.inTransition) {
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
            document.getElementById(`me-${i}-input-${inputId}`).classList.add('atem-red');
          } else {
            document.getElementById(`me-${i}-program-input-${inputId}`).classList.remove('atem-red');
            document.getElementById(`me-${i}-input-${inputId}`).classList.remove('atem-red');
          }

          if (mixEffect.previewInput === inputId) {
            document.getElementById(`me-${i}-preview-input-${inputId}`).classList.add('atem-green');
            document.getElementById(`me-${i}-input-${inputId}`).classList.add('atem-green');
          } else {
            document.getElementById(`me-${i}-preview-input-${inputId}`).classList.remove('atem-green');
            document.getElementById(`me-${i}-input-${inputId}`).classList.remove('atem-green');
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
  } else if (updateType.includes('transitionPreview')) {
    for (let i = 0; i < data.video.mixEffects.length; i++) {
      const mixEffect = data.video.mixEffects[i];
      if (mixEffect.transitionPreview) {
        document.getElementById(`me-${i}-transition-preview`).classList.add('atem-red');
      } else {
        document.getElementById(`me-${i}-transition-preview`).classList.remove('atem-red');
      }
    }
  } else if (updateType.includes('deviceInfo')) {
    // videoModes pulled from https://github.com/nrkno/sofie-atem-connection/blob/master/src/enums/index.ts#L238
    if ([27, 26, 23, 25, 19, 13, 11, 7, 5].includes(data.settings.videoMode)) {
      timerFrameRate = 30;
    }
    if ([24, 22, 18, 16, 12, 10, 6, 4].includes(data.settings.videoMode)) {
      // 25 FPS Timers
      timerFrameRate = 25;
      // 25fps timers
    }
    if ([21, 20, 15, 14, 9, 8].includes(data.settings.videoMode)) {
      timerFrameRate = 24;
    }

    if (!device.displayName) {
      this.deviceInfoUpdate(device, 'displayName', data.info.productIdentifier);
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

function framesToTime(total) {
  if (timerFrameRate) {
    const seconds = Math.floor(total / timerFrameRate);
    const frames = total - seconds * timerFrameRate;
    let framesString = String(frames);
    if (frames < 10) {
      framesString = `0${framesString}`;
    } else if (framesString === '0') {
      framesString = '00';
    }
    return `${seconds}:${framesString}`;
  }
  return '0:00';
}
