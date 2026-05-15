const osc = require('osc');

exports.config = {
  defaultName: 'DPA N-Series',
  connectionType: 'osc-tcp',
  defaultPort: 1993,
  mayChangePorts: true,
  heartbeatInterval: 5000,
  heartbeatTimeout: 10000,
  searchOptions: {
    type: 'TCPport',
    // OSC /model message with SLIP framing: END + "/model\0\0" + ",\0\0\0" + END
    searchBuffer: Buffer.from([
      0xc0, 0x2f, 0x6d, 0x6f, 0x64, 0x65, 0x6c, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0xc0,
    ]),
    testPort: 1993,
    validateResponse(msg) {
      const str = msg.toString();
      return str.includes('/model') || str.includes('N-DR');
    },
  },
};

function makeChannel() {
  return {
    name: '–',
    audioLevel: -80,
    txActive: false,
    txName: '',
    battCapacity: null,
    battTimeMin: null,
    battHealth: null,
    rfA: -130,
    rfB: -130,
    warnings: {},
  };
}

function subscribeToAddress(device, address, intervalMs) {
  const msgBlob = osc.writePacket({ address, args: [] });
  device.send('/subscribe', [
    { type: 'i', value: intervalMs },
    { type: 'i', value: 0 },
    { type: 'b', value: msgBlob },
  ]);
}

exports.ready = function ready(_device) {
  const device = _device;
  device.data.model = '';
  device.data.channels = [null, makeChannel(), makeChannel()];
  device.data.warnings = {};

  device.send('/settings/retrieve');
  device.send('/model');

  subscribeToAddress(device, '/ch/1/audiolevel', 100);
  subscribeToAddress(device, '/ch/2/audiolevel', 100);
  subscribeToAddress(device, '/advanced/1/antenna/rfstrength', 200);
  subscribeToAddress(device, '/advanced/2/antenna/rfstrength', 200);
  subscribeToAddress(device, '/ch/1/tx/active', 500);
  subscribeToAddress(device, '/ch/2/tx/active', 500);
  subscribeToAddress(device, '/ch/1/tx/name', 5000);
  subscribeToAddress(device, '/ch/2/tx/name', 5000);
  subscribeToAddress(device, '/ch/1/tx/batterystatus', 1000);
  subscribeToAddress(device, '/ch/2/tx/batterystatus', 1000);
};

exports.data = function data(_device, message) {
  const device = _device;
  this.deviceInfoUpdate(device, 'status', 'ok');

  const { address, args } = message;
  if (!address) return;

  const parts = address.split('/').filter(Boolean);

  if (address === '/model') {
    if (args && args[0]) {
      device.data.model = args[0];
      this.deviceInfoUpdate(device, 'defaultName', args[0]);
    }
  } else if (address === '/heartbeat') {
    device.draw();
  } else if (parts[0] === 'ch' && parts.length >= 3) {
    const chNum = parseInt(parts[1], 10);
    if (chNum < 1 || chNum > 2) return;
    const ch = device.data.channels[chNum];
    const sub = parts.slice(2).join('/');

    if (sub === 'name') {
      ch.name = (args && args[0]) ? args[0] : '–';
      device.draw();
    } else if (sub === 'audiolevel') {
      ch.audioLevel = (args && args[0] !== undefined) ? args[0] / 10 : -80;
      device.update('meterUpdate', { channels: device.data.channels });
    } else if (sub === 'tx/active') {
      ch.txActive = args && args[0] === 1;
      device.draw();
    } else if (sub === 'tx/name') {
      ch.txName = (args && args[0]) ? args[0] : '';
      device.draw();
    } else if (sub === 'tx/batterystatus') {
      if (args) {
        ch.battCapacity = args[0] !== undefined ? args[0] : null;
        ch.battTimeMin = args[1] !== undefined ? args[1] : null;
        ch.battHealth = args[2] !== undefined ? args[2] : null;
      }
      device.draw();
    }
  } else if (parts[0] === 'advanced' && parts[2] === 'antenna' && parts[3] === 'rfstrength') {
    const chNum = parseInt(parts[1], 10);
    if (chNum < 1 || chNum > 2) return;
    const ch = device.data.channels[chNum];
    ch.rfA = (args && args[1] !== undefined) ? args[1] / 10 : -130;
    ch.rfB = (args && args[2] !== undefined) ? args[2] / 10 : -130;
    device.update('meterUpdate', { channels: device.data.channels });
  } else if (parts[0] === 'warning') {
    if (parts.length === 2) {
      device.data.warnings[parts[1]] = args && args[0] === 1;
      device.draw();
    } else if (parts.length === 3) {
      const chNum = parseInt(parts[1], 10);
      if (chNum >= 1 && chNum <= 2) {
        device.data.channels[chNum].warnings[parts[2]] = args && args[0] === 1;
        device.draw();
      }
    }
  }
};

exports.update = function update(device, doc, updateType, data) {
  for (let i = 1; i <= 2; i++) {
    const ch = data.channels[i];

    // Audio level bar: -126 dBFS = empty, 0 dBFS = full
    const audioOverlay = Math.max(0, Math.min(90, (1 - (ch.audioLevel + 126) / 126) * 90));
    const $audio = doc.getElementById(`ch-${i}-audio`);
    if ($audio) $audio.style.height = `${audioOverlay}px`;
    const $audioText = doc.getElementById(`ch-${i}-audio-text`);
    if ($audioText) $audioText.textContent = `${ch.audioLevel}`;

    // RF bars: -130 to -50 dBm range (80 dBm span)
    const rfANorm = Math.max(0, Math.min(1, (ch.rfA + 130) / 80));
    const rfBNorm = Math.max(0, Math.min(1, (ch.rfB + 130) / 80));
    const $rfA = doc.getElementById(`ch-${i}-rfa`);
    if ($rfA) $rfA.style.height = `${(1 - rfANorm) * 90}px`;
    const $rfB = doc.getElementById(`ch-${i}-rfb`);
    if ($rfB) $rfB.style.height = `${(1 - rfBNorm) * 90}px`;
  }
};

exports.heartbeat = function heartbeat(device) {
  device.send('/settings/retrieve');
};
