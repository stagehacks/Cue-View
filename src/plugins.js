/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
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
    files.forEach((pluginDir) => {
      if (pluginDir[0] !== '.') {
        allPlugins[pluginDir] = require(path.join(pluginDirectoryPath, `/${pluginDir}/main.js`));

        const plugin = allPlugins[pluginDir];

        plugin.deviceInfoUpdate = function deviceInfoUpdate(device, param, value) {
          DEVICE.infoUpdate(device, param, value);
        };
        plugin.draw = (device) => {
          VIEW.draw(device);
        };

        plugin.template = _.template(
          fs.readFileSync(path.join(pluginDirectoryPath, `/${pluginDir}/template.ejs`), 'utf8')
        );

        plugin.info = _.template(fs.readFileSync(path.join(pluginDirectoryPath, `/${pluginDir}/info.html`), 'utf8'));

        plugin.heartbeatTimeout = plugin.config.heartbeatTimeout;
        plugin.heartbeatInterval = plugin.config.heartbeatInterval;

        console.log(`${pluginDir} loaded`);
      }
    });

    callback();
  });
};
