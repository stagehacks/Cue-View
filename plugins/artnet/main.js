exports.config = {
  defaultName: 'Art-Net',
  connectionType: 'UDPsocket',
  remotePort: 6454,
  mayChangePorts: false,
  heartbeatInterval: 5000,
  heartbeatTimeout: 15000,
  searchOptions: {
    type: 'UDPsocket',
    searchBuffer: Buffer.from([0x00]),
    devicePort: 6454,
    listenPort: 6454,
    validateResponse(msg, info, devices) {
      return msg.toString('utf8', 0, 7) === 'Art-Net';
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data.universes = {};
  device.data.orderedUniverses = [];
};

exports.data = function data(_device, buf) {
  const device = _device;

  if (buf.length < 18 || buf.slice(0, 7).toString() !== 'Art-Net') {
    return;
  }

  const opCode = buf.readUInt16BE(8);

  if (opCode === 33) {
    sendArtPollReply(device);
    return;
  }

  const universeIndex = buf.readUInt8(14);

  let universe = device.data.universes[universeIndex];

  if (!universe) {
    device.data.universes[universeIndex] = {};
    universe = device.data.universes[universeIndex];
  }

  universe.sequence = buf.readUInt8(12);
  universe.subnet = buf.readUInt8(15);
  universe.opCode = buf.readUInt8(9);
  universe.version = buf.readUInt16BE(10);
  universe.slots = buf.slice(18);
  device.data.ip = device.addresses[0];

  if (!device.data.orderedUniverses.includes(universeIndex)) {
    device.data.orderedUniverses.push(universeIndex);
    device.data.orderedUniverses.sort();
    universe.slotElems = [];
    universe.slotElemsSet = false;

    device.draw();
    device.update('elementCache');
  }

  device.update('universeData', {
    universeIndex,
    universe,
  });
};

exports.heartbeat = function heartbeat(device) {};

let lastUpdate = Date.now();
exports.update = function update(_device, _document, updateType, updateData) {
  const device = _device;
  const data = updateData;
  const document = _document;

  if (updateType === 'universeData' && data.universe) {
    if (Date.now() - lastUpdate > 1000) {
      lastUpdate = Date.now();
      device.update('elementCache');
    }

    const $elem = document.getElementById(`universe-${data.universeIndex}`);

    if ($elem && data.universe.slotElemsSet) {
      for (let i = 0; i < 512; i++) {
        data.universe.slotElems[i].textContent = data.universe.slots[i];
      }

      document.getElementById(`universe-${data.universeIndex}-sequence`).textContent = data.universe.sequence;
    } else {
      device.draw();
      device.update('elementCache');
    }
  } else if (updateType === 'elementCache') {
    device.data.orderedUniverses.forEach((universeIndex) => {
      for (let i = 0; i < 512; i++) {
        device.data.universes[universeIndex].slotElems[i] = document.getElementById(`${universeIndex}-${i}`);
      }
      device.data.universes[universeIndex].slotElemsSet = true;
    });
  }
};

function sendArtPollReply(device) {
  // minimum viable Art-Net packet
  // not to full Art-Net spec
  // https://art-net.org.uk/how-it-works/discovery-packets/artpollreply/

  const interfaces = device.getNetworkInterfaces();

  for (let i = 0; i < Object.keys(interfaces).length; i++) {
    const buf = Buffer.alloc(213);
    buf.write('Art-Net', 0);

    buf.writeInt16LE(0x2100, 8);

    const addr = interfaces[Object.keys(interfaces)[i]][0].address.split('.');

    buf.writeUInt8(addr[0], 10);
    buf.writeUInt8(addr[1], 11);
    buf.writeUInt8(addr[2], 12);
    buf.writeUInt8(addr[3], 13);

    buf.writeInt16LE(6454, 14);

    buf.write('Cue View', 26);

    buf.writeUInt8(4, 173);

    buf.writeUInt8(0xc0, 174);
    buf.writeUInt8(0xc0, 175);
    buf.writeUInt8(0xc0, 176);
    buf.writeUInt8(0xc0, 177);

    buf.writeUInt8(0x80, 178);
    buf.writeUInt8(0x80, 179);
    buf.writeUInt8(0x80, 180);
    buf.writeUInt8(0x80, 181);

    buf.writeUInt8(0x80, 182);
    buf.writeUInt8(0x80, 183);
    buf.writeUInt8(0x80, 184);
    buf.writeUInt8(0x80, 185);

    buf.writeUInt8(0x00, 186);
    buf.writeUInt8(0x01, 187);
    buf.writeUInt8(0x02, 188);
    buf.writeUInt8(0x03, 189);

    device.send(buf);
  }
}
