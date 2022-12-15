/* eslint-disable global-require */
const fs = require('fs');
const _ = require('lodash');
const path = require('path');

const DEVICE = require('./device.js');
const VIEW = require('./view.js');

const allPlugins = {};
module.exports.all = allPlugins;

module.exports.init = function init(callback) {
  const pluginDirectoryPath = path.normalize(path.join(__dirname, `../plugins`));

  console.log(`Loading plugin files... ${pluginDirectoryPath}`);

  fs.readdir(pluginDirectoryPath, (err, files) => {
    files.forEach((plugin) => {
      if (plugin[0] !== '.') {
        console.log(`${plugin} started`);

        // eslint-disable-next-line import/no-dynamic-require
        allPlugins[plugin] = require(path.join(
          pluginDirectoryPath,
          `/${plugin}/main.js`
        ));

        const p = allPlugins[plugin];

        p.deviceInfoUpdate = function deviceInfoUpdate(device, param, value) {
          DEVICE.infoUpdate(device, param, value);
        };
        p.draw = (device) => {
          VIEW.draw(device);
        };

        p.template = _.template(
          fs.readFileSync(
            path.join(pluginDirectoryPath, `/${plugin}/template.ejs`),
            'utf8'
          )
        );

        p.info = _.template(
          fs.readFileSync(
            path.join(pluginDirectoryPath, `/${plugin}/info.html`),
            'utf8'
          )
        );

        // if (p.heartbeatTimeout === undefined || p.heartbeatTimeout < 50) {
        if (p.config.heartbeatTimeout) {
          p.heartbeatTimeout = p.config.heartbeatInterval * 1.5;
        } else {
          p.heartbeatTimeout = 10000;
        }
        // }

        if (p.config.heartbeatInterval) {
          p.heartbeatInterval = Math.max(50, p.config.heartbeatInterval);
        } else {
          p.heartbeatInterval = 5000;
        }

        // p.fields = {};
        // if(p.config.fields){
        //   p.config.fields.forEach(field => {
        //     p.fields[field.key] = field.value;
        //   });
        // }

        // if (p.heartbeatInterval === undefined || p.heartbeatInterval < 50) {
        //   p.heartbeatInterval = 5000;
        // }
      }
    });

    callback();
  });
};
