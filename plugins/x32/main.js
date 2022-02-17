exports.defaultName = 'X32 Mixer';
exports.connectionType = 'UDPsocket';
exports.heartbeatInterval = 10000;
exports.searchOptions = {
  type: 'UDPsocket',
  searchBuffer: Buffer.from([0x2f, 0x78, 0x69, 0x6e, 0x66, 0x6f]),
  devicePort: 10023,
  listenPort: 0,
  validateResponse (msg, info) {
    return msg.toString().indexOf('/xinfo') === 0;
  },
};
exports.defaultPort = 10023;

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
  d.data.stereoName = "LR";
  d.data.stereoColor = 7;

  d.send(Buffer.from('/xinfo'));

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

  //replace one or more nulls with new line then split on that
  const msg = buf.toString().replace(/(\0+)/gm, '\n').split('\n');

  const d = device;

  if (msg[0] === '/xinfo') {
    this.deviceInfoUpdate(device, 'defaultName', msg[3]);
    d.data.name = msg[3];
    d.data.ip = msg[2];
    d.data.firmware = msg[5];
    d.data.model = msg[4];

    d.send(Buffer.from('/main/st/config/name\u0000\u0000\u0000\u0000'));

    for (let i = 0; i <= 32; i++) {
      d.send(
        Buffer.from(
          `/ch/${i
            .toString()
            .padStart(2, '0')}/config/name\u0000\u0000\u0000\u0000`
        )
      );
    }
    d.draw();
  } else if (msg[0] === '/meters/0') {
    // console.log(msg)
  } else if (msg[0].indexOf('/mix/fader') >= 0) {
    const addr = parseAddress(msg[0]);
    const channel = Number(addr[1]);

    if (addr[0] === 'ch') {
      d.data.channelFaders[channel - 1] = buf.readFloatBE(24);
      d.data.channelFadersDB[channel - 1] = convertToDBTheBehringerWay(
        buf.readFloatBE(24)
      );
    } else if (addr[0] === 'main') {
      d.data.stereoFader = buf.readFloatBE(24);
      d.data.stereoFaderDB = convertToDBTheBehringerWay(
        buf.readFloatBE(24)
      );
    }

    d.draw();
  } else if (msg[0].indexOf('/mix/on') >= 0) {
    const addr = parseAddress(msg[0]);
    const channel = Number(addr[1]);

    if (addr[0] === 'ch') {
      d.data.channelMutes[channel - 1] = buf[23];
      d.send(
        Buffer.from(`/ch/${addr[1]}/mix/fader\u0000\u0000\u0000\u0000`)
      );
    } else if (addr[0] === 'main') {
      d.data.stereoMute = buf.slice(-1)[0] ;
      d.send(
        Buffer.from(`/main/${addr[1]}/mix/fader\u0000\u0000\u0000\u0000`)
      );
    }
    d.draw();
    
  } else if (msg[0].indexOf('/config/name') > 0) {
    const addr = parseAddress(msg[0]);
    if(addr[0] === "main"){
      if(addr[1] === "st"){
        d.data.stereoName = msg[2]
        if(d.data.stereoName === ""){
          d.data.stereoName = "LR";
        }
        d.send(
          Buffer.from(`/main/${addr[1]}/config/color\u0000\u0000\u0000\u0000`)
        );
      }
    } else if (addr[0] === "ch"){
      const channel = Number(addr[1]);
      d.data.channelNames[channel - 1] = msg[2];
      d.send(
        Buffer.from(`/ch/${addr[1]}/config/color\u0000\u0000\u0000\u0000`)
      );
    }
    d.draw();
  } else if (msg[0].indexOf('/config/color') > 0) {
    const addr = parseAddress(msg[0]);
    if (addr[0] === "main"){
      d.data.stereoColor = Buffer.from(msg[2]).readInt8();
      d.send(Buffer.from(`/main/${addr[1]}/mix/on\u0000\u0000\u0000\u0000`));
      
    } else if (addr[0] === "ch"){
      const channel = Number(addr[1]);
      d.data.channelColors[channel - 1] = buf.readInt8(27);
      d.send(Buffer.from(`/ch/${addr[1]}/mix/on\u0000\u0000\u0000\u0000`));
    }
    d.draw();
  } else {
    // console.log(msg)
  }
  // console.log(msg)
};

exports.heartbeat = function heartbeat(device) {
  device.send(Buffer.from('/xremote'));
};
