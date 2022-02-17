/* eslint-disable global-require */
const fs = require('fs');
const _ = require('lodash');

const DEVICE = require('./device.js');
const VIEW = require('./view.js');

const allPlugins = {};
module.exports.all = allPlugins;

module.exports.init = function init(callback) {
  console.log(`Loading plugin files... ${__dirname}/../plugins`);

  fs.readdir(`${__dirname}/../plugins`, (err, files) => {
    
    files.forEach((plugin)=>{
      if (plugin[0] !== '.') {
        
        console.log(`${plugin} started`);

        // eslint-disable-next-line import/no-dynamic-require
        allPlugins[plugin] = require(`${__dirname}/../plugins/${plugin}/main.js`);

        const p = allPlugins[plugin];

        p.deviceInfoUpdate = function deviceInfoUpdate(device, param, value) {
          DEVICE.infoUpdate(device, param, value);
        };
        p.draw = (device) => {
          VIEW.draw(device);
        };

        p.template = _.template(
          fs.readFileSync(
            `${__dirname}/../plugins/${plugin}/template.ejs`,
            'utf8'
          )
        );

        p.info = _.template(
          fs.readFileSync(
            `${__dirname}/../plugins/${plugin}/info.html`,
            'utf8'
          )
        );


        if (p.heartbeatTimeout === undefined || p.heartbeatTimeout < 50) {
          if(p.heartbeatInterval){
            p.heartbeatTimeout = p.heartbeatInterval * 1.5;
          }else{
            p.heartbeatTimeout = 10000;
          }
        }

        if (p.heartbeatInterval === undefined || p.heartbeatInterval < 50) {
          p.heartbeatInterval = 5000;
        }

      }
    });

    callback();

  });
};
