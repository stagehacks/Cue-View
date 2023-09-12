const { Decoder } = require('@jwetzell/posistagenet');

exports.config = {
  defaultName: 'PosiStageNet',
  connectionType: 'multicast',
  port: 56565,
  remotePort: 56565,
  mayChangePorts: false,
  heartbeatInterval: 5000,
  heartbeatTimeout: 15000,
  searchOptions: {
    type: 'multicast',
    address: `236.10.10.10`,
    port: 56565,
    validateResponse(msg, info) {
      // TODO(jwetzell): find a way to check that this is a posistagenet message
      return true;
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data = {};
  const networkInterfaces = device.getNetworkInterfaces();

  Object.keys(networkInterfaces).forEach((networkInterfaceID) => {
    const networkInterface = networkInterfaces[networkInterfaceID];
    device.connection.addMembership(`236.10.10.10`, networkInterface[0].address);
  });
};

exports.data = function data(_device, buf, info) {
  const device = _device;

  if (!device.decoders) {
    device.decoders = {};
  }

  if (!device.decoders[info.address]) {
    device.decoders[info.address] = new Decoder();
  }

  device.decoders[info.address].decode(buf);

  Object.keys(device.decoders).forEach((address) => {
    if (!device.data[address]) {
      device.data[address] = {
        data: device.decoders[address].data,
        info: device.decoders[address].info,
      };
    }
  });
  device.draw();
};

exports.heartbeat = function heartbeat(device) {};

exports.update = function update(_device, doc, updateType, updateData) {};
