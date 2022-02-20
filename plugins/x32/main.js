exports.defaultName = 'X32 Mixer';
exports.connectionType = 'UDPsocket';
exports.heartbeatInterval = 10000;
exports.searchOptions = {
  type: 'UDPsocket',
  searchBuffer: Buffer.from([0x2f, 0x78, 0x69, 0x6e, 0x66, 0x6f]),
  devicePort: 10023,
  listenPort: 0,
  validateResponse(msg, info) {
    return msg.toString().indexOf('/xinfo') === 0;
  },
};
exports.defaultPort = 10023;

exports.ready = function ready(device) {
  const d = device;
  d.data.X32 = new Console();

  d.send(Buffer.from('/xinfo'));

  // device.send(Buffer.from("/subscribe\x00,si\x00/-stat/solosw/01\x001"));
};

function parseAddress(msg) {
  const addr = msg.split('/');
  addr.shift();
  return addr;
}

exports.data = function data(device, buf) {
  this.deviceInfoUpdate(device, 'status', 'ok');

  // replace one or more nulls with new line then split on that
  const msg = buf.toString().replace(/(\0+)/gm, '\n').split('\n');

  const d = device;

  if (msg[0] === '/xinfo') {
    d.data.X32.info.name = msg[3];
    d.data.X32.info.ip = msg[2];
    d.data.X32.info.firmware = msg[5];
    d.data.X32.info.model = msg[4];

    this.deviceInfoUpdate(device, 'defaultName', d.data.X32.info.name);

    d.send(Buffer.from('/main/st/config/name\x00\x00\x00\x00'));

    for (let i = 0; i <= 32; i++) {
      d.send(
        Buffer.from(
          `/ch/${i.toString().padStart(2, '0')}/config/name\x00\x00\x00\x00`
        )
      );
    }
    d.draw();
  } else if (msg[0].includes('meters/0')) {
    let offset = 24;
    for (let i = 0; i < 70; i++) {
      if (i >= 0 && i < 32) {
        // These are channel meters
        d.data.X32.inputs.channels[i].meter = Console.getBehringerDB(
          buf.readFloatLE(offset)
        );
      }

      offset += 4;
    }
    d.draw();
  } else if (msg[0].includes('meters/2')) {
    let offset = 24;

    for (let i = 0; i < 49; i++) {
      if (i === 22) {
        // STEREO LEFT METER
        d.data.X32.main.stereo.meter[0] = Console.getBehringerDB(
          buf.readFloatLE(offset)
        );
      } else if (i === 23) {
        // STEREO RIGHT METER
        d.data.X32.main.stereo.meter[1] = Console.getBehringerDB(
          buf.readFloatLE(offset)
        );
      }
      offset += 4;
    }
  } else if (msg[0].indexOf('/mix/fader') >= 0) {
    const addr = parseAddress(msg[0]);
    const channel = Number(addr[1]);

    if (addr[0] === 'ch') {
      d.data.X32.inputs.channels[channel - 1].fader = buf.readFloatBE(24);
      d.data.X32.inputs.channels[channel - 1].faderDB = Console.getBehringerDB(
        buf.readFloatBE(24)
      );
    } else if (addr[0] === 'main') {
      d.data.X32.main.stereo.fader = buf.readFloatBE(24);
      d.data.X32.main.stereo.faderDB = Console.getBehringerDB(
        buf.readFloatBE(24)
      );
    }

    d.draw();
  } else if (msg[0].indexOf('/mix/on') >= 0) {
    const addr = parseAddress(msg[0]);
    const channel = Number(addr[1]);

    if (addr[0] === 'ch') {
      d.data.X32.inputs.channels[channel - 1].mute = buf[23];
      d.send(Buffer.from(`/ch/${addr[1]}/mix/fader\x00\x00\x00\x00`));
    } else if (addr[0] === 'main') {
      d.data.X32.main.stereo.mute = buf.slice(-1)[0];
      d.send(Buffer.from(`/main/${addr[1]}/mix/fader\x00\x00\x00\x00`));
    }
    d.draw();
  } else if (msg[0].indexOf('/config/name') > 0) {
    const addr = parseAddress(msg[0]);
    if (addr[0] === 'main') {
      if (addr[1] === 'st') {
        d.data.X32.main.stereo.name = msg[2];
        if (d.data.X32.main.stereo.name === '') {
          d.data.X32.main.stereo.name = 'LR';
        }
        d.send(Buffer.from(`/main/${addr[1]}/config/color\x00\x00\x00\x00`));
      }
    } else if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      d.data.X32.inputs.channels[channel - 1].name = msg[2];
      d.send(Buffer.from(`/ch/${addr[1]}/config/color\x00\x00\x00\x00`));
    }
    d.draw();
  } else if (msg[0].indexOf('/config/color') > 0) {
    const addr = parseAddress(msg[0]);
    if (addr[0] === 'main') {
      d.data.X32.main.stereo.color = Buffer.from(msg[2]).readInt8();
      d.send(Buffer.from(`/main/${addr[1]}/mix/on\x00\x00\x00\x00`));
    } else if (addr[0] === 'ch') {
      const channel = Number(addr[1]);
      d.data.X32.inputs.channels[channel - 1].color = buf.readInt8(27);
      d.send(Buffer.from(`/ch/${addr[1]}/mix/on\x00\x00\x00\x00`));
    }
    d.draw();
  } else {
    // console.log(msg)
  }
  // console.log(msg)
};

exports.heartbeat = function heartbeat(device) {
  device.send(Buffer.from('/xremote'));

  // subscribe to meter groups
  device.send(
    Buffer.from(
      '/batchsubscribe\x00,ssiii\x00\x00meters/0\x00\x00\x00\x00/meters/0\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01'
    )
  );
  device.send(
    Buffer.from(
      '/batchsubscribe\x00,ssiii\x00\x00meters/2\x00\x00\x00\x00/meters/2\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01'
    )
  );
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
