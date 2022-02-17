const _ = require('lodash');

exports.defaultName = 'sACN';
exports.connectionType = 'multicast';
exports.defaultPort = 5568;
exports.heartbeatInterval = 5000;
exports.searchOptions = {
  type: "multicast",
  address: getMulticastGroup(1),
  port: 5568,
  validateResponse (msg, info) {
    return msg.toString('utf8', 4, 13) === "ASC-E1.17";
  },
};
exports.defaultPort = 5568;

exports.ready = function ready(device) {

  const d = device;
  d.data.universes = {};
  d.data.source = "Unknown Source";
  d.data.orderedUniverses = [];

  // device.draw();
  for(let i = 1; i <= 16; i++){
    d.connection.addMembership(getMulticastGroup(i));
  }
  
};


exports.data = function data(device, buf) {

  const univ = buf.readUInt16BE(113);
  const d = device;

  let u = d.data.universes[univ];

  if(!u){
    d.data.universes[univ] = {};
    u = d.data.universes[univ];
  }

  u.sequence = buf.readUInt8(111);
  u.priority = buf.readUInt8(108);
  u.cid = buf.toString('hex', 22, 38);
  u.slots = Array.prototype.slice.call(buf, 126);
  if(buf.readUInt8(125) !== 0){
    u.startCode = buf.readUInt8(125);
  }


  d.data.source = buf.toString('utf8', 44, 108);
  d.displayName = `${d.data.source} sACN`;
  d.data.ip = d.addresses[0];

  if(!_.includes(d.data.orderedUniverses, univ)){
    d.data.orderedUniverses.push(univ);
    d.data.orderedUniverses.sort();
    u.slotElems = [];
    u.slotElemsSet = false;

    d.draw();
    updateElementsCache(d, d.data.universes, d.data.orderedUniverses);

  }

  d.update("universeData", {
    u: univ,
    universe: u,
    startCode: u.startCode
  });

};


exports.heartbeat = function heartbeat(device) {
 
};



let lastUpdate = Date.now();
exports.update = function update(device, doc, updateType, updateData){

  const d = device;
  const data = updateData;

  if(updateType === "universeData" && data.universe){

    if(Date.now() - lastUpdate > 1000){
      lastUpdate = Date.now();
      updateElementsCache(d, d.data.universes, d.data.orderedUniverses);
    }

    const $elem = doc.getElementById(`universe-${data.u}`);

    if($elem && data.universe.slotElemsSet){

      if(data.universe.priority > 0){
        for(let i = 0; i < 512; i++){
          data.universe.slotElems[i].innerText = data.universe.slots[i];
        }

        const $code = doc.getElementById(`universe-${data.u}-code`);
        if(data.startCode === 0xDD){
          $code.innerText = "Net3"
        }else if(data.startCode === 0x17){
          $code.innerText = "Text"
        }else if(data.startCode === 0xCF){
          $code.innerText = "SIP"
        }else if(data.startCode === 0xCC){
          $code.innerText = "RDM"
        }

      }

    }else{
      d.draw();
      updateElementsCache(d, d.data.universes, d.data.orderedUniverses);
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







// From https://github.com/hhromic/e131-node/blob/master/lib/e131.js
function getMulticastGroup(universe) {
  if (universe < 1 || universe > 63999) {
    throw new RangeError('universe should be in the range [1-63999]');
  }
  return `239.255.${universe >> 8}.${universe & 0xff}`;
  
}