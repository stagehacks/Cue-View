exports.config = {
  defaultName: 'X32 Mixer',
  connectionType: 'osc-udp',
  remotePort: 10023,
  mayChangePorts: false,
  heartbeatInterval: 9000,
  heartbeatTimeout: 11000,
  searchOptions: {
    type: 'UDPsocket',
    searchBuffer: Buffer.from([0x2f, 0x78, 0x69, 0x6e, 0x66, 0x6f]),
    devicePort: 10023,
    listenPort: 0,
    validateResponse(msg, info) {
      return msg.toString().includes('/xinfo') === 0;
    },
  },
};

exports.ready = function ready(device) {
  const d = device;
  d.data.X32 = new Console();
  d.send('/xinfo');

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

exports.data = function data(device, oscData) {
  this.deviceInfoUpdate(device, 'status', 'ok');

  const d = device;

  if (oscData.address === '/xinfo') {
    d.data.X32.info.name = oscData.args[1];
    d.data.X32.info.ip = oscData.args[0];
    d.data.X32.info.firmware = oscData.args[3];
    d.data.X32.info.model = oscData.args[2];

    this.deviceInfoUpdate(device, 'defaultName', d.data.X32.info.name);

    d.send('/main/st/config/name');

    for (let i = 0; i <= 32; i++) {
      d.send(`/ch/${i.toString().padStart(2, '0')}/config/name`);
    }
    d.draw();
  } else if (oscData.address.includes('/ch/meters')) {
    const buf = Buffer.from(oscData.args[0]);

    let offset = 4; // skip first 4 bytes they are the length bytes
    for (let i = 0; i < 70; i++) {
      if (i >= 0 && i < 32) {
        // These are channel meters
        d.data.X32.inputs.channels[i].meter = Console.getBehringerDB(buf.readFloatLE(offset));
      }

      offset += 4;
    }
    d.draw();
  } else if (oscData.address.includes('/main/meters')) {
    const buf = Buffer.from(oscData.args[0]);
    let offset = 4; // skip first 4 bytes they are the length bytes

    for (let i = 0; i < 49; i++) {
      if (i === 22) {
        // STEREO LEFT METER
        d.data.X32.main.stereo.meter[0] = Console.getBehringerDB(buf.readFloatLE(offset));
      } else if (i === 23) {
        // STEREO RIGHT METER
        d.data.X32.main.stereo.meter[1] = Console.getBehringerDB(buf.readFloatLE(offset));
      }
      offset += 4;
    }
  } else if (oscData.address.includes('/mix/fader')) {
    const addr = parseAddress(oscData.address);

    if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      d.data.X32.inputs.channels[channel - 1].fader = oscData.args[0];
      d.data.X32.inputs.channels[channel - 1].faderDB = Console.getBehringerDB(oscData.args[0]);
    } else if (addr[0] === 'main') {
      d.data.X32.main.stereo.fader = oscData.args[0];
      d.data.X32.main.stereo.faderDB = Console.getBehringerDB(oscData.args[0]);
    }

    d.draw();
  } else if (oscData.address.includes('/mix/on')) {
    const addr = parseAddress(oscData.address);
    if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      d.data.X32.inputs.channels[channel - 1].mute = oscData.args[0];
      d.send(`/ch/${addr[1]}/mix/fader`);
    } else if (addr[0] === 'main') {
      d.data.X32.main.stereo.mute = oscData.args[0];
      d.send(`/main/${addr[1]}/mix/fader`);
    }
    d.draw();
  } else if (oscData.address.includes('/config/name')) {
    const addr = parseAddress(oscData.address);
    if (addr[0] === 'main') {
      if (addr[1] === 'st') {
        d.data.X32.main.stereo.name = oscData.args[0];
        if (d.data.X32.main.stereo.name === '') {
          d.data.X32.main.stereo.name = 'LR';
        }
        d.send(`/main/${addr[1]}/config/color`);
      }
    } else if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      d.data.X32.inputs.channels[channel - 1].name = oscData.args[0];
      d.send(`/ch/${addr[1]}/config/color`);
    }
    d.draw();
  } else if (oscData.address.includes('/config/color')) {
    const addr = parseAddress(oscData.address);
    if (addr[0] === 'main') {
      d.data.X32.main.stereo.color = oscData.args[0];
      d.send(`/main/${addr[1]}/mix/on`);
    } else if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      d.data.X32.inputs.channels[channel - 1].color = oscData.args[0];
      d.send(`/ch/${addr[1]}/mix/on`);
    }
    d.draw();
  } else {
    // console.log(oscData);
  }
  // console.log(msg)
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
