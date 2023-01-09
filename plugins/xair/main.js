exports.config = {
  defaultName: 'X Air Mixer',
  connectionType: 'UDPsocket',
  defaultPort: 10024,
  mayChangePort: false,
  heartbeatInterval: 9000,
  heartbeatTimeout: 15000,
  searchOptions: {
    type: 'UDPsocket',
    searchBuffer: Buffer.from([0x2f, 0x78, 0x69, 0x6e, 0x66, 0x6f]),
    devicePort: 10024,
    listenPort: 0,
    validateResponse(msg, info) {
      return msg.toString().startWith('/xinfo');
    },
  },
};

exports.ready = function ready(device) {
  const d = device;
  d.data.channelFaders = new Array(32).fill(0);
  d.data.channelFadersDB = new Array(32).fill(0);
  d.data.channelMutes = new Array(32).fill(0);
  d.data.channelNames = new Array(32).fill('end');
  d.data.channelColors = new Array(32);

  d.data.stereoFader = 0;
  d.data.stereoFaderDB = 0;
  d.data.stereoMute = 0;

  d.send('/xinfo');

  // device.send(Buffer.from("\x2f\x62\x61\x74\x63\x68\x73\x75\x62\x73\x63\x72\x69\x62\x65\x00\x2c\x73\x73\x69\x69\x69\x00\x00\x6d\x65\x74\x65\x72\x73\x2f\x30\x00\x00\x00\x00\x2f\x6d\x65\x74\x65\x72\x73\x2f\x30\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01"));
  // device.send(Buffer.from("/batchsubscribe\x00,ssiii\x00\x00meters/0\x00\x00\x00\x00/meters/0\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01"));
  // device.send(Buffer.from("/subscribe\x00,si\x00/-stat/solosw/01\x001"));
};

function parseAddress(msg) {
  const addr = msg.split('/');
  addr.shift();
  return addr;
}

function convertToDBTheBehringerWay(f) {
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

exports.data = function data(device, buf) {
  this.deviceInfoUpdate(device, 'status', 'ok');
  const msg = buf.toString().split('\x00');
  const d = device;

  if (msg[0] === '/xinfo') {
    if (msg[7].length > 0) {
      d.data.name = msg[7];
    } else {
      d.data.name = msg[6];
    }

    d.data.ip = msg[5];
    d.data.firmware = msg[13];
    d.data.model = msg[9];
    this.deviceInfoUpdate(d, 'defaultName', d.data.name);

    d.send('/lr/mix/fader\x00\x00\x00\x00');
    d.send('/lr/mix/on\x00\x00\x00\x00');

    for (let i = 0; i <= 32; i++) {
      d.send(Buffer.from(`/ch/${i.toString().padStart(2, '0')}/config/name\x00\x00\x00\x00`));
    }
    d.draw();
  } else if (msg[0] === '/meters/0') {
    // console.log(msg)
  } else if (msg[0].includes('/mix/fader')) {
    const addr = parseAddress(msg[0]);
    const channel = Number(addr[1]);

    if (addr[0] === 'ch') {
      d.data.channelFaders[channel - 1] = buf.readFloatBE(24);
      d.data.channelFadersDB[channel - 1] = convertToDBTheBehringerWay(buf.readFloatBE(24));
    } else if (addr[0] === 'lr') {
      d.data.stereoFader = buf.readFloatBE(20);
      d.data.stereoFaderDB = convertToDBTheBehringerWay(buf.readFloatBE(20));
    }

    d.draw();
  } else if (msg[0].includes('/mix/on')) {
    const addr = parseAddress(msg[0]);
    const channel = Number(addr[1]);

    if (addr[0] === 'ch') {
      d.data.channelMutes[channel - 1] = buf[23];
    } else if (addr[0] === 'lr') {
      d.data.stereoMute = buf[19];
    }
    device.draw();
    device.send(`/ch/${addr[1]}/mix/fader\x00\x00\x00\x00`);
  } else if (msg[0].includes('/config/name')) {
    const addr = parseAddress(msg[0]);
    const channel = Number(addr[1]);
    d.data.channelNames[channel - 1] = msg[4];
    d.draw();
    d.send(`/ch/${addr[1]}/config/color\x00\x00\x00\x00`);
  } else if (msg[0].includes('/config/color')) {
    const addr = parseAddress(msg[0]);
    const channel = Number(addr[1]);
    d.data.channelColors[channel - 1] = buf.readInt8(27);
    d.draw();
    d.send(`/ch/${addr[1]}/mix/on\x00\x00\x00\x00`);
  } else {
    // console.log(msg)
  }
  // console.log(msg)
};

exports.heartbeat = function heartbeat(device) {
  device.send('/xremote');
};
