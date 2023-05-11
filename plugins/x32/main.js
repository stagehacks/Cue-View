exports.config = {
  defaultName: 'X32 Mixer',
  connectionType: 'osc-udp',
  defaultPort: 10023,
  mayChangePort: false,
  heartbeatInterval: 9000,
  heartbeatTimeout: 11000,
  searchOptions: {
    type: 'UDPsocket',
    searchBuffer: Buffer.from([0x2f, 0x78, 0x69, 0x6e, 0x66, 0x6f]),
    devicePort: 10023,
    listenPort: 0,
    validateResponse(msg, info) {
      return msg.toString().includes('/xinfo');
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data = new Console();
  device.send('/xinfo');

  device.send('/batchsubscribe', [
    { type: 's', value: '/ch/meters' },
    { type: 's', value: '/meters/0' },
    { type: 'i', value: 0 },
    { type: 'i', value: 0 },
    { type: 'i', value: 1 },
  ]);

  device.send('/batchsubscribe', [
    { type: 's', value: '/main/meters' },
    { type: 's', value: '/meters/2' },
    { type: 'i', value: 0 },
    { type: 'i', value: 0 },
    { type: 'i', value: 1 },
  ]);
};

function parseAddress(msg) {
  const addr = msg.split('/');
  addr.shift();
  return addr;
}

exports.data = function data(_device, oscData) {
  this.deviceInfoUpdate(_device, 'status', 'ok');

  const device = _device;

  if (oscData.address === '/xinfo') {
    device.data.info.name = oscData.args[1];
    device.data.info.ip = oscData.args[0];
    device.data.info.firmware = oscData.args[3];
    device.data.info.model = oscData.args[2];

    this.deviceInfoUpdate(_device, 'defaultName', device.data.info.name);

    device.send('/main/st/config/name');

    for (let i = 0; i <= 32; i++) {
      device.send(`/ch/${i.toString().padStart(2, '0')}/config/name`);
    }
    device.draw();
  } else if (oscData.address.includes('/ch/meters')) {
    const buf = Buffer.from(oscData.args[0]);

    let offset = 4; // skip first 4 bytes they are the length bytes
    for (let i = 0; i < 70; i++) {
      if (i >= 0 && i < 32) {
        // These are channel meters
        device.data.inputs.channels[i].meter = Console.getBehringerDB(buf.readFloatLE(offset));
      }

      offset += 4;
    }
    device.draw();
  } else if (oscData.address.includes('/main/meters')) {
    const buf = Buffer.from(oscData.args[0]);
    let offset = 4; // skip first 4 bytes they are the length bytes

    for (let i = 0; i < 49; i++) {
      if (i === 22) {
        // STEREO LEFT METER
        device.data.main.stereo.meter[0] = Console.getBehringerDB(buf.readFloatLE(offset));
      } else if (i === 23) {
        // STEREO RIGHT METER
        device.data.main.stereo.meter[1] = Console.getBehringerDB(buf.readFloatLE(offset));
      }
      offset += 4;
    }
  } else if (oscData.address.includes('/mix/fader')) {
    const addr = parseAddress(oscData.address);

    if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      device.data.inputs.channels[channel - 1].fader = oscData.args[0];
      device.data.inputs.channels[channel - 1].faderDB = Console.getBehringerDB(oscData.args[0]);
    } else if (addr[0] === 'main') {
      device.data.main.stereo.fader = oscData.args[0];
      device.data.main.stereo.faderDB = Console.getBehringerDB(oscData.args[0]);
    }

    device.draw();
  } else if (oscData.address.includes('/mix/on')) {
    const addr = parseAddress(oscData.address);
    if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      device.data.inputs.channels[channel - 1].mute = oscData.args[0];
      device.send(`/ch/${addr[1]}/mix/fader`);
    } else if (addr[0] === 'main') {
      device.data.main.stereo.mute = oscData.args[0];
      device.send(`/main/${addr[1]}/mix/fader`);
    }
    device.draw();
  } else if (oscData.address.includes('/config/name')) {
    const addr = parseAddress(oscData.address);
    if (addr[0] === 'main') {
      if (addr[1] === 'st') {
        device.data.main.stereo.name = oscData.args[0];
        if (device.data.main.stereo.name === '') {
          device.data.main.stereo.name = 'LR';
        }
        device.send(`/main/${addr[1]}/config/color`);
      }
    } else if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      device.data.inputs.channels[channel - 1].name = oscData.args[0];
      device.send(`/ch/${addr[1]}/config/color`);
    }
    device.draw();
  } else if (oscData.address.includes('/config/color')) {
    const addr = parseAddress(oscData.address);
    if (addr[0] === 'main') {
      device.data.main.stereo.color = oscData.args[0];
      device.send(`/main/${addr[1]}/mix/on`);
    } else if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      device.data.inputs.channels[channel - 1].color = oscData.args[0];
      device.send(`/ch/${addr[1]}/mix/on`);
    }
    device.draw();
  }
};

exports.heartbeat = function heartbeat(device) {
  device.send('/xremote');

  device.send('/renew', [{ type: 's', value: '/ch/meters' }]);
  device.send('/renew', [{ type: 's', value: '/main/meters' }]);
};

class Console {
  constructor() {
    this.inputs = {
      channels: new Array(32).fill(0).map(() => ({
        fader: 0,
        faderDB: 0,
        mute: 0,
        name: 'end',
        color: undefined,
        meter: -90,
      })),
    };

    this.main = {
      stereo: {
        fader: 0,
        faderDB: 0,
        mute: 0,
        name: 'LR',
        color: 7,
        meter: new Array(2).fill(-90),
      },
    };

    this.info = {
      name: '',
      ip: '',
      firmware: '',
      model: '',
    };
  }

  static getBehringerDB(level) {
    const f = level;
    if (f >= 0.5) {
      return f * 40 - 30;
    }
    if (f >= 0.25) {
      return f * 80 - 50;
    }
    if (f >= 0.0625) {
      return f * 160 - 70;
    }
    return f * 480 - 90;
  }
}
