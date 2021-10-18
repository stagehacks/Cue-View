let fs = require('fs');
let DEVICE = require("./device.js");
let VIEW = require("./view.js");


var allPlugins = {};
module.exports.all = allPlugins;

module.exports.init = function(callback){

	console.log("Loading Plugin Files...")

	fs.readdir("./plugins", function(err, files){
		for(var i in files){
			var plugin = files[i];			

			if(plugin[0]!="."){
				allPlugins[plugin] = require(process.cwd()+"/plugins/"+plugin+"/"+plugin+".js");

				allPlugins[plugin].deviceInfoUpdate = function(device, param, value){
					DEVICE.infoUpdate(device, param, value)
				}
				allPlugins[plugin].draw = function(device){
					VIEW.draw(device);
				}

				allPlugins[plugin].template = ejs.compile(fs.readFileSync(process.cwd()+"/plugins/"+plugin+"/"+plugin+".html", 'utf8'));
				
				if(allPlugins[plugin].heartbeatInterval==undefined || allPlugins[plugin].heartbeatInterval<50){
					allPlugins[plugin].heartbeatInterval = 5000;
				}
			}
		}
		callback();
	});
}