exports.defaultName = 'Dataton Watchout';
exports.connectionType = 'TCPsocket';
exports.heartbeatInterval = 500;
exports.searchOptions = {
  type: 'TCPport',
  searchBuffer: Buffer.from('authenticate 1\n', 'ascii'),
  testPort: 3040,
  validateResponse (msg, info) {
    return msg.toString().substring(0, 5) === 'Ready';
  },
};
exports.defaultPort = 3040;

exports.ready = function ready(device) {
  device.send('authenticate 1\n');
};

exports.data = function data(device, message) {
  const msg = message.toString();
  const d = device;

  if (msg.substring(0, 5) === 'Ready') {
    d.send('getStatus\n');

  }else if (msg.substring(0, 5) === 'Reply') {
    const arr = msg.split(' ');

    d.data.showName = '';
    let i = 0;
    while (arr[i][arr[i].length - 1] !== '"') {
      i++;
      d.data.showName += `${arr[i]} `;
    }
    d.data.showName = d.data.showName.substring(
      1,
      d.data.showName.length - 2
    );

    i--;
    d.data.busy = arr[i + 2];
    d.data.health = arr[i + 3];
    d.data.displayOpen = arr[i + 4];
    d.data.showActive = arr[i + 5];
    d.data.programmerOnline = arr[i + 6];
    d.data.position = Number(arr[i + 7]).toFixed(2);
    d.data.rate = arr[i + 8];
    d.data.standby = arr[i + 9];

    this.deviceInfoUpdate(d, 'defaultName', d.data.showName);
    d.draw();
  }
  // if(msg.substring(0, 5)=="Error"){
  // 	device.data.error = msg.substring(6, 7);
  // }
  // console.log(msg)
};

exports.heartbeat = function heartbeat(device) {
  device.send('getStatus\n');
};
