let _ = require('lodash');
const fs = require('fs');


exports.defaultName = 'ETC Eos';
exports.connectionType = 'osc';
exports.searchOptions = {
  type: 'TCPport',
  searchBuffer: Buffer.from(
    '\xc0/eos/ping\x00\x00\x2c\x00\x00\x00\xc0',
    'ascii'
  ),
  testPort: 3032,
  validateResponse: function (msg, info) {
    return msg.toString().indexOf('/eos/out');
  },
};
exports.defaultPort = 3032;

// "\xc0/eos/ping\x00\x00\x2c\x00\x00\x00\xc0"

exports.ready = function (device) {
  device.send('/eos/get/cuelist/count');
  device.send('/eos/get/version');
  device.send('/eos/subscribe', [{ type: 'i', value: 1 }]);
};

exports.data = function (device, osc) {
  const address = osc.address;
  const p = osc.address.split('/');
  p.shift();

  //console.log(address)

  if (p[1] == 'out' && p[2] == 'show' && p[3] == 'name') {
    device.data.showName = osc.args[0];
    device.data.cuelists = {};
    this.deviceInfoUpdate(device, 'defaultName', osc.args[0]);


  } else if (osc.address == '/eos/out/get/cuelist/count') {
    for (let i = 0; i < osc.args[0]; i++) {
      device.send(`/eos/get/cuelist/index/${i}`);
    }


  } else if (
    p[1] == 'out' &&
    p[2] == 'get' &&
    p[3] == 'cuelist' &&
    p[5] == 'list'
  ) {
    device.data.cuelists[p[4]] = {};
    device.send(`/eos/get/cue/${p[4]}/count`);


  } else if (
    p[1] == 'out' &&
    p[2] == 'get' &&
    p[3] == 'cue' &&
    p[5] == 'count'
  ) {
    for (let i = 0; i < osc.args[0]; i++) {
      device.send(`/eos/get/cue/${p[4]}/index/${i}`);
    }


  } else if (
    p[1] == 'out' &&
    p[2] == 'get' &&
    p[3] == 'cue' &&
    p[7] == 'list'
  ) {
    this.deviceInfoUpdate(device, 'status', 'ok');
    if (device.data.cuelists[p[4]][p[5]] == undefined) {
      device.data.cuelists[p[4]][p[5]] = {};
    }
    device.data.cuelists[p[4]][p[5]][p[6]] = {
      uid: osc.args[1],
      label: osc.args[2],
      uptimeduration: osc.args[3],
      uptimedelay: osc.args[4],
      downtimeduration: osc.args[5],
      downtimedelay: osc.args[6],
      focustimeduration: osc.args[7],
      focustimedelay: osc.args[8],
      colortimeduration: osc.args[9],
      colortimedelay: osc.args[10],
      beamtimeduration: osc.args[11],
      beamtimedelay: osc.args[12],
      mark: osc.args[16],
      block: osc.args[17],
      assert: osc.args[18],
      follow: osc.args[20],
      hang: osc.args[21],
      partcount: osc.args[26],
      scene: osc.args[28],
      duration: Math.max(
        osc.args[3],
        osc.args[5],
        osc.args[7],
        osc.args[9],
        osc.args[11]
      ),
    };

    device.update("cueData", {
      cue: device.data.cuelists[p[4]][p[5]],
      cueNumber: p[5],
      uid: osc.args[1]
    });


  } else if (p[1] == 'out' && p[2] == 'get' && p[3] == 'cue' && p.length == 6) {
    // console.log("cue "+p[4]+" "+p[5]+" deleted")

    // There's no OSC notification of the deletion of a part. It just tells you to update the parent cue and remaining children.
    // So: we should fetch all the parts of a cue somehow every time there's an update to a cue.

    delete device.data.cuelists[p[4]][p[5]];
    device.draw();


  } else if (
    p[1] == 'out' &&
    p[2] == 'get' &&
    p[3] == 'cue' &&
    p[7] == 'actions'
  ) {
    if (osc.args.length == 3) {
      device.data.cuelists[p[4]][p[5]][0].extlinks = osc.args[2];
    }


  } else if (
    p[1] == 'out' &&
    p[2] == 'event' &&
    p[3] == 'cue' &&
    p[6] == 'fire'
  ) {
    device.data.activeCue = p[5];

    device.draw();
    device.update("activeCue", {uid: device.data.cuelists[p[4]][p[5]][0].uid});


  } else if (p[1] == 'out' && p[2] == 'notify' && p[3] == 'cue') {
    const cueList = p[4];
    const listIndex = p[6];
    const listCount = p[7];
    const cueNumber = osc.args[1];
    console.log(cueNumber+" changed")

    device.send(`/eos/get/cue/${cueList}/${cueNumber}`);
    

  } else if (
    p[2] == 'cmd' ||
    p[2] == 'ping' ||
    p[2] == 'user' ||
    p[2] == 'softkey'
  ) {
  } else if (p[3] == 'version') {
    device.data.version = osc.args[0];


  } else {
    // console.log(osc);

  }
  // console.log(p)
};

let cueTemplate = _.template(fs.readFileSync(`./plugins/eos/cue.ejs`));

exports.update = function(device, doc, updateType, data){

  if(updateType == "cueData"){
    $elem = doc.getElementById(data.uid);

    if($elem){
      $elem.outerHTML = cueTemplate({
        q: data.cue,
        cueNumber: data.cueNumber,
        isActive: false
      });

    }else{
      device.draw();

    }

  }else if(updateType == "activeCue"){
    $elem = doc.getElementById(data.uid);
    $elem.scrollIntoView({behavior: "smooth", block: "center"});

  }


}


exports.heartbeat = function (device) {
  device.send('/eos/ping');
};
