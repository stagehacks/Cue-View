const fs = require('fs');
const ejs = require('ejs');
const DEVICE = require('./device.js');
const VIEW = require('./view.js');

const allPlugins = {};
module.exports.all = allPlugins;

module.exports.init = function (callback) {
  console.log(`Loading plugin files... ${__dirname}/../plugins`);

  fs.readdir(`${__dirname}/../plugins`, (err, files) => {
    for (let i in files) {
      const plugin = files[i];

      if (plugin[0] != '.') {
        console.log(`${i} ${plugin}`);
        allPlugins[
          plugin
        ] = require(`${__dirname}/../plugins/${plugin}/${plugin}.js`);

        allPlugins[plugin].deviceInfoUpdate = function (device, param, value) {
          DEVICE.infoUpdate(device, param, value);
        };
        allPlugins[plugin].draw = function (device) {
          VIEW.draw(device);
        };

        allPlugins[plugin].template = ejs.compile(
          fs.readFileSync(
            `${__dirname}/../plugins/${plugin}/${plugin}.html`,
            'utf8'
          )
        );

        if (
          allPlugins[plugin].heartbeatInterval == undefined ||
          allPlugins[plugin].heartbeatInterval < 50
        ) {
          allPlugins[plugin].heartbeatInterval = 5000;
        }
      }
    }
    callback();
  });
};
