exports.defaultName = 'PJLink Projector';
exports.connectionType = 'TCPsocket';
exports.heartbeatInterval = 5000;
exports.searchOptions = {
  type: 'UDPsocket',
  searchBuffer: Buffer.from([0x25, 0x32, 0x53, 0x52, 0x43, 0x48, 0x0d]),
  devicePort: 4352,
  listenPort: 4352,
  validateResponse: function (msg, info) {
    return msg.toString().indexOf('%2ACKN=') >= 0;
  },
};
exports.defaultPort = 4352;

exports.ready = function (device) {
  //Power status query
  //device.send("%1POWR ?\r");
};
var password = false;

exports.data = function (device, message) {
  this.deviceInfoUpdate(device, 'status', 'ok');
  var msg = message.toString();

  const md5 = require('md5');

  if (msg.substring(0, 8) == 'PJLINK 1') {
    password = md5(`${msg.substring(9, 17)}JBMIAProjectorLink`);
    device.send(
      `${password}%1POWR ?\r%1INPT ?\r%1AVMT ?\r%1ERST ?\r%1LAMP ?\r%1NAME ?\r%1INF1 ?\r%1INF2 ?\r%2SNUM ?\r%2SVER ?\r`
    );
  }
  if (msg.substring(0, 7) == '%1POWR=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%1INPT=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%1AVMT=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%1ERST=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%1LAMP=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%1NAME=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%1INF1=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%1INF2=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%2SNUM=') {
    processPJLink(device, msg, this);
  }
  if (msg.substring(0, 7) == '%2SVER=') {
    processPJLink(device, msg, this);
  }
};

function processPJLink(device, str, that) {
  var arr = str.split('%');
  for (var key in arr) {
    var split = arr[key].split('=');
    var key = split[0];
    var value = split[1];

    switch (key) {
      case '1POWR':
        device.data.power = value;
        break;
      case '1INPT':
        device.data.input = value;
        break;
      case '1AVMT':
        device.data.avmute = value;
        break;
      case '1ERST':
        device.data.fanError = value[0];
        device.data.lampError = value[1];
        device.data.tempError = value[2];
        device.data.coverError = value[3];
        device.data.filterError = value[4];
        device.data.otherError = value[5];
        break;
      case '1LAMP':
        device.data.lamp = value.split(' ');
        break;
      case '1NAME':
        device.data.name = value;
        that.deviceInfoUpdate(device, 'defaultName', device.data.name);
        break;
      case '1INF1':
        device.data.info1 = value;
        break;
      case '1INF2':
        device.data.info2 = value;
        break;
      case '2SNUM':
        device.data.serial = value;
        break;
      case '2SVER':
        device.data.version = value;
        break;
    }
  }
  device.draw();
}

exports.heartbeat = function (device) {
  if (password) {
    device.send(
      `${password}%1POWR ?\r%1INPT ?\r%1AVMT ?\r%1ERST ?\r%1LAMP ?\r%1NAME ?\r%1INF1 ?\r%1INF2 ?\r%2SNUM ?\r%2SVER ?\r`
    );
  }
};
