exports.config = {
  defaultName: 'Art-Net',
  connectionType: 'UDPsocket',
  defaultPort: 6454,
  mayChangePort: false,
  heartbeatInterval: 5000,
  heartbeatTimeout: 15000,
  searchOptions: {
    type: 'UDPsocket',
    searchBuffer: Buffer.from([0x00]),
    devicePort: 6454,
    listenPort: 6454,
    mayChangePort: false,
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
  if (buf.length < 18) {
    return;
  }
  const universeIndex = buf.readUInt8(14);
  const device = _device;
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
