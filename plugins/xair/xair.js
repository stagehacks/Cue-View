exports.defaultName = 'X Air Mixer';
exports.connectionType = 'UDPsocket';
exports.heartbeatInterval = 10000;
exports.searchOptions = {
  type: 'UDPsocket',
  searchBuffer: Buffer.from([0x2f, 0x78, 0x69, 0x6e, 0x66, 0x6f]),
  devicePort: 10024,
  listenPort: 0,
  validateResponse: function (msg, info) {
    return msg.toString().indexOf('/xinfo') == 0;
  },
};
exports.defaultPort = 10024;

exports.ready = function (device) {
  device.data.channelFaders = new Array(32).fill(0);
  device.data.channelFadersDB = new Array(32).fill(0);
  device.data.channelMutes = new Array(32).fill(0);
  device.data.channelNames = new Array(32).fill('end');
  device.data.channelColors = new Array(32);

  device.data.stereoFader = 0;
  device.data.stereoFaderDB = 0;
  device.data.stereoMute = 0;

  device.send(Buffer.from('/xinfo'));

  // device.send(Buffer.from("\x2f\x62\x61\x74\x63\x68\x73\x75\x62\x73\x63\x72\x69\x62\x65\x00\x2c\x73\x73\x69\x69\x69\x00\x00\x6d\x65\x74\x65\x72\x73\x2f\x30\x00\x00\x00\x00\x2f\x6d\x65\x74\x65\x72\x73\x2f\x30\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01"));
  // device.send(Buffer.from("/batchsubscribe\x00,ssiii\x00\x00meters/0\x00\x00\x00\x00/meters/0\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01"));

  // device.send(Buffer.from("/subscribe\x00,si\x00/-stat/solosw/01\x001"));
};

exports.data = function (device, buf) {
  this.deviceInfoUpdate(device, 'status', 'ok');
  var msg = buf.toString().split('\u0000');

  if (msg[0] == '/xinfo') {
    if (msg[7].length > 0) {
      device.data.name = msg[7];
    } else {
      device.data.name = msg[6];
    }

    device.data.ip = msg[5];
    device.data.firmware = msg[13];
    device.data.model = msg[9];
    this.deviceInfoUpdate(device, 'defaultName', device.data.name);

    device.send(Buffer.from('/lr/mix/fader\u0000\u0000\u0000\u0000'));
    device.send(Buffer.from('/lr/mix/on\u0000\u0000\u0000\u0000'));

    for (var i = 0; i <= 32; i++) {
      device.send(
        Buffer.from(
          `/ch/${i
            .toString()
            .padStart(2, '0')}/config/name\u0000\u0000\u0000\u0000`
        )
      );
    }
    device.draw();
  } else if (msg[0] == '/meters/0') {
    // console.log(msg)
  } else if (msg[0].indexOf('/mix/fader') >= 0) {
    var addr = parseAddress(msg[0]);
    var channel = Number(addr[1]);

    if (addr[0] == 'ch') {
      device.data.channelFaders[channel - 1] = buf.readFloatBE(24);
      device.data.channelFadersDB[channel - 1] = convertToDBTheBehringerWay(
        buf.readFloatBE(24)
      );
    } else if (addr[0] == 'lr') {
      device.data.stereoFader = buf.readFloatBE(20);
      device.data.stereoFaderDB = convertToDBTheBehringerWay(
        buf.readFloatBE(20)
      );
    }

    device.draw();
  } else if (msg[0].indexOf('/mix/on') >= 0) {
    var addr = parseAddress(msg[0]);
    var channel = Number(addr[1]);

    if (addr[0] == 'ch') {
      device.data.channelMutes[channel - 1] = buf[23];
    } else if (addr[0] == 'lr') {
      device.data.stereoMute = buf[19];
    }
    device.draw();
    device.send(
      Buffer.from(`/ch/${addr[1]}/mix/fader\u0000\u0000\u0000\u0000`)
    );
  } else if (msg[0].indexOf('/config/name') > 0) {
    var addr = parseAddress(msg[0]);
    var channel = Number(addr[1]);
    device.data.channelNames[channel - 1] = msg[4];
    device.draw();
    device.send(
      Buffer.from(`/ch/${addr[1]}/config/color\u0000\u0000\u0000\u0000`)
    );
  } else if (msg[0].indexOf('/config/color') > 0) {
    var addr = parseAddress(msg[0]);
    var channel = Number(addr[1]);
    device.data.channelColors[channel - 1] = buf.readInt8(27);
    device.draw();
    device.send(Buffer.from(`/ch/${addr[1]}/mix/on\u0000\u0000\u0000\u0000`));
  } else {
    // console.log(msg)
  }
  // console.log(msg)
};

exports.heartbeat = function (device) {
  device.send(Buffer.from('/xremote'));
};

function parseAddress(msg) {
  var addr = msg.split('/');
  addr.shift();
  return addr;
}

function convertToDBTheBehringerWay(f) {
  if (f >= 0.5) {
    return f * 40 - 30;
  } else if (f >= 0.25) {
    return f * 80 - 50;
  } else if (f >= 0.0625) {
    return f * 160 - 70;
  } else {
    return f * 480 - 90;
  }
}
