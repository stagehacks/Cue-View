const _ = require('lodash');

exports.defaultName = "Art-Net";
exports.connectionType = 'UDPsocket';
exports.heartbeatInterval = 10000;
exports.searchOptions = {
  type: 'UDPsocket',
  searchBuffer: Buffer.from([65, 114, 116, 45, 78, 101, 116, 0x00, 0x00, 0x20, 0x00, 0x0e, 0x00, 0x00]),
  devicePort: 6454,
  listenPort: 6454,
  validateResponse (msg, info, devices) {
    return msg.toString('utf8', 0, 7) === "Art-Net";
  }
};
exports.defaultPort = 6454;

exports.ready = function ready(device) {
  const d = device;
  d.data.universes = {};
  d.data.orderedUniverses = [];

};

exports.data = function data(device, buf) {
  if(buf.length < 18){
    return
  }
  const univ = buf.readUInt8(14);
  const d = device;
  let u = d.data.universes[univ];

  if(!u){
    d.data.universes[univ] = {};
    u = d.data.universes[univ];
  }

  u.sequence = buf.readUInt8(12);
  u.net = buf.readUInt8(15);
  u.opCode = buf.readUInt8(9);
  u.version = buf.readUInt16BE(10);
  u.slots = Array.prototype.slice.call(buf, 18);
  d.data.ip = d.addresses[0];

  if(!_.includes(d.data.orderedUniverses, univ)){
    d.data.orderedUniverses.push(univ);
    d.data.orderedUniverses.sort();
    u.slotElems = [];
    u.slotElemsSet = false;

    d.draw();
    updateElementsCache(d, d.data.universes, d.data.orderedUniverses);

  }

  device.update("universeData", {
    u: univ,
    universe: u
  });


};


exports.heartbeat = function heartbeat(device) {
  
};



let lastUpdate = Date.now();
exports.update = function update(device, document, updateType, updateData){

  const data = updateData;
  const doc = document;

  if(updateType === "universeData" && data.universe){

    if(Date.now() - lastUpdate > 1000){
      lastUpdate = Date.now();
      updateElementsCache(device, device.data.universes, device.data.orderedUniverses);
    }

    const $elem = doc.getElementById(`universe-${data.u}`);

    if($elem && data.universe.slotElemsSet){

      for(let i = 0; i < 512; i++){
        data.universe.slotElems[i].innerText = data.universe.slots[i];
      }

      doc.getElementById(`universe-${data.u}-sequence`).innerText = data.universe.sequence;


    }else{
      device.draw();
      updateElementsCache(device, device.data.universes, device.data.orderedUniverses);
    }

  }else if(updateType === "elementCache"){

    data.orderedUniverses.forEach(univ => { 
      for(let i = 0; i < 512; i++){
        data.universes[univ].slotElems[i] = doc.getElementById(`${univ}-${i}`);
      }
      data.universes[univ].slotElemsSet = true;
    });

  }
  

}

function updateElementsCache(device, univ, ordered){
  device.update("elementCache", {
    universes: univ,
    orderedUniverses: ordered
  });
}

