const _ = require('lodash');
const fs = require('fs');
const path = require('path');

exports.config = {
  defaultName: 'DiGiCo',
  connectionType: 'osc-udp',
  defaultPort: 8000,
  mayChangePort: true,
  heartbeatInterval: 2000,
  heartbeatTimeout: 11000,
  searchOptions: {
    type: 'UDPsocket',
    // send "/Console/Name/?" this is what the iPad sends to check connection
    searchBuffer: Buffer.from([
      0x2f, 0x43, 0x6f, 0x6e, 0x73, 0x6f, 0x6c, 0x65, 0x2f, 0x4e, 0x61, 0x6d, 0x65, 0x2f, 0x3f, 0x00, 0x2c, 0x00, 0x00,
      0x00,
    ]),
    devicePort: 8000,
    listenPort: 9000,
    validateResponse(msg, info) {
      console.log(msg);
      console.log(msg.toString());
      return msg.toString().includes('/Console');
    },
  },
};

exports.ready = function ready(_device) {
  const device = _device;
  device.data = new DiGiCo();
  // This is what the DiGiCo iPad app sends on connection
  device.send('/Console/Name/?');
  device.send('/Console/Session/Filename/?');
  device.send('/Console/Channels/?');
  // device.send('/Console/Input_Channels/modes/?');
  // device.send('/Console/Group_Outputs/modes/?');
  // device.send('/Console/Aux_Outputs/modes/?');
  // device.send('/Console/Multis/?');

  device.send('/Snapshots/Current_Snapshot/?');

  // device.send('/Input_Channels/?'); // no response

  // device.send('/Layout/Layout/Banks/?');

  // console.log(device);

  // These are also sent by the iPad app but aren't queries (?) so may potentially write to console?
  // device.send('/Meters/clear');
  // device.send('/Meters/clear');
};
exports.data = function data(_device, oscData) {
  const device = _device;
  this.deviceInfoUpdate(device, 'status', 'ok');

  const properties = oscData.address.split('/');
  properties.shift();
  setObjectProperty(device.data, properties, oscData.args);

  // console.log(Object.keys(device.data.Control_Groups).length);

  // console.log(properties);
  if (properties[1] === 'Control_Groups') {
    for (let i = 1; i <= device.data.Console.Control_Groups; i++) {
      device.send(`/Control_Groups/${i}/?`);
    }
    console.log('draw');
    device.draw();
  } else if (properties[0] === 'Control_Groups') {
    device.update('updateFader', {
      type: 'Control_Groups',
      channel: properties[1],
    });
  } else if (properties[0] === 'Console' && properties[1] === 'Input_Channels') {
    // console.log(properties);
    // console.log(device.data);
    // device.send(`/Input_Channels/1/?`);
    // device.send(`/Input_Channels/2/?`);
    for (let i = 1; i <= device.data.Console.Input_Channels; i++) {
      device.send(`/Input_Channels/${i}/Channel_Input/name`);
      device.send(`/Input_Channels/${i}/mute/?`);
      device.send(`/Input_Channels/${i}/solo/?`);
      device.send(`/Input_Channels/${i}/fader/?`);
    }
    device.draw();
  } else if (properties[0] === 'Input_Channels') {
    device.update('updateFader', {
      type: 'Input_Channels',
      channel: properties[1],
    });
  } else if (properties[0] === 'Console' && properties[1] === 'Group_Outputs') {
    for (let i = 1; i <= device.data.Console.Group_Outputs; i++) {
      device.send(`/Group_Outputs/${i}/mute/?`);
      device.send(`/Group_Outputs/${i}/solo/?`);
      device.send(`/Group_Outputs/${i}/fader/?`);
      device.send(`/Group_Outputs/${i}/Buss_Trim/name/?`);
    }
    device.draw();
  } else if (properties[0] === 'Group_Outputs') {
    device.update('updateFader', {
      type: 'Group_Outputs',
      channel: properties[1],
    });
  } else if (properties[0] === 'Console' && properties[1] === 'Aux_Outputs') {
    for (let i = 1; i <= device.data.Console.Aux_Outputs; i++) {
      device.send(`/Aux_Outputs/${i}/mute/?`);
      device.send(`/Aux_Outputs/${i}/solo/?`);
      device.send(`/Aux_Outputs/${i}/fader/?`);
      device.send(`/Aux_Outputs/${i}/Buss_Trim/name/?`);
    }
    device.draw();
  } else if (properties[0] === 'Aux_Outputs') {
    device.update('updateFader', {
      type: 'Aux_Outputs',
      channel: properties[1],
    });
  } else if (properties[0] === 'Console' && properties[1] === 'Name') {
    this.deviceInfoUpdate(device, 'defaultName', device.data.Console.Name);
  } else if (properties[0] === 'Snapshots') {
    device.update('updateSnapshot', {
      snapshots: device.data.Snapshots,
    });
  }
};

exports.heartbeat = function heartbeat(device) {
  device.send('/Console/Name/?');
  // device.draw();
  console.log(device.data);
};

class DiGiCo {
  constructor() {
    this.Console = {};
    this.Input_Channels = {};
    this.Aux_Outputs = {};
    this.Control_Groups = {};
    this.Group_Outputs = {};
    this.Matrix_Outputs = {};
    this.Layout = {};
  }
}

/*
 This function takes somethings like this /Console/Session/Filename with a osc args like ['session.ses'] 
 and turns it into a nested object like. An easy way to set properties converting OSC paths to properties
 {
    Console: {
      Session: {
        Filename: 'session.ses'
      }
    }
 }

*/
function setObjectProperty(_object, _properties, value) {
  let object = _object;
  const properties = _properties;

  for (let i = 0; i < properties.length - 1; i++) {
    const property = properties[i];
    if (object[property] === undefined) {
      object[property] = {};
    }
    object = object[property];
  }
  const property = properties[properties.length - 1];
  if (Array.isArray(value)) {
    // if this is an array of length one just set the property to the contents so ['string'] becomes 'string'
    if (value.length === 1) {
      object[property] = value[0];
      return;
    }
  }
  object[property] = value;
}

const faderTemplate = _.template(fs.readFileSync(path.join(__dirname, `/fader.ejs`)));
exports.update = function update(device, doc, updateType, data) {
  if (updateType === 'updateFader') {
    const $elem = doc.getElementById(`${data.type}-${data.channel}`);
    $elem.outerHTML = faderTemplate({
      type: data.type,
      fader: device.data[data.type][data.channel],
      index: data.channel,
    });
  } else if (updateType === 'updateSnapshot') {
    const $elem = doc.getElementById(`snapshot`);
    $elem.textContent = `${data.snapshots.Current_Snapshot}`;
  }
};
