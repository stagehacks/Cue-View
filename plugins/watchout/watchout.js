exports.defaultName = 'Dataton Watchout';
exports.connectionType = 'TCPsocket';
exports.heartbeatInterval = 500;
exports.searchOptions = {
  type: 'TCPport',
  searchBuffer: Buffer.from('authenticate 1\n', 'ascii'),
  testPort: 3040,
  validateResponse: function (msg, info) {
    return msg.toString().substring(0, 5) == 'Ready';
  },
};
exports.defaultPort = 3040;

exports.ready = function (device) {
  device.send('authenticate 1\n');
};

exports.data = function (device, message) {
  var msg = message.toString();
  if (msg.substring(0, 5) == 'Ready') {
    device.send('getStatus\n');
  }
  if (msg.substring(0, 5) == 'Reply') {
    var arr = msg.split(' ');

    device.data.showName = '';
    var i = 0;
    while (arr[i][arr[i].length - 1] != '"') {
      i++;
      device.data.showName += `${arr[i]} `;
    }
    device.data.showName = device.data.showName.substring(
      1,
      device.data.showName.length - 2
    );

    i--;
    device.data.busy = arr[i + 2];
    device.data.health = arr[i + 3];
    device.data.displayOpen = arr[i + 4];
    device.data.showActive = arr[i + 5];
    device.data.programmerOnline = arr[i + 6];
    device.data.position = Number(arr[i + 7]).toFixed(2);
    device.data.rate = arr[i + 8];
    device.data.standby = arr[i + 9];

    this.deviceInfoUpdate(device, 'defaultName', device.data.showName);
    device.draw();
  }
  // if(msg.substring(0, 5)=="Error"){
  // 	device.data.error = msg.substring(6, 7);
  // }
  //console.log(msg)
};

exports.heartbeat = function (device) {
  device.send('getStatus\n');
};
