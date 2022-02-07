const fs = require('fs');
const DEVICE = require('./device.js');
const VIEW = require('./view.js');
const _ = require('lodash');

const allPlugins = {};
module.exports.all = allPlugins;

module.exports.init = function (callback) {
  console.log(`Loading plugin files... ${__dirname}/../plugins`);

  fs.readdir(`${__dirname}/../plugins`, (err, files) => {
    for (let i in files) {
      const plugin = files[i];

      if (plugin[0] != '.') {
        
        console.log(`${i} ${plugin}`);
        allPlugins[plugin] = require(`${__dirname}/../plugins/${plugin}/main.js`);

        let p = allPlugins[plugin];

        p.deviceInfoUpdate = function (device, param, value) {
          DEVICE.infoUpdate(device, param, value);
        };
        p.draw = function (device) {
          VIEW.draw(device);
        };

        p.template = _.template(
          fs.readFileSync(
            `${__dirname}/../plugins/${plugin}/template.ejs`,
            'utf8'
          )
        );


        if (p.heartbeatTimeout == undefined || p.heartbeatTimeout < 50) {
          if(p.heartbeatInterval){
            p.heartbeatTimeout = p.heartbeatInterval*1.5;
          }else{
            p.heartbeatTimeout = 10000;
          }
        }

        if (p.heartbeatInterval == undefined || p.heartbeatInterval < 50) {
          p.heartbeatInterval = 5000;
        }

      }
    }
    callback();
  });
};
