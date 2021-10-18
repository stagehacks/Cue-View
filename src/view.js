const { ipcRenderer } = require('electron');
let DEVICE = require("./device.js");
let PLUGINS = require("./plugins.js");
var _ = require('lodash/function');

var pinnedDevices = [];
module.exports.pinnedDevices = pinnedDevices;
let activeDevice = false;



module.exports.init = function(){
	populatePluginLists();
}



drawDeviceInterface = function(id){

	// console.log("DRAW")

	var $deviceDrawArea = document.getElementById("device-"+id+"-draw-area");
	var $devicePinned = document.getElementById("device-"+id+"-pinned");

	if($deviceDrawArea==null){
		return true;
	}

	d = DEVICE.all[id];

	var str = "<html><head>";
	if(d.status=="ok"){
		str+="<link href='./plugins/"+d.type+"/"+d.type+".css' rel='stylesheet' type='text/css'>";
	}
	

	//scrollbar styles are inline to prevent the styles flickering in
	str+="<style>";
	str+="::-webkit-scrollbar {background-color: black;width: 12px;}";
	str+="::-webkit-scrollbar-track {background-color: #2b2b2b;}";
	str+="::-webkit-scrollbar-thumb {background-color: #6b6b6b;border-radius: 16px;border: 3px solid #2b2b2b;}";
	str+="::-webkit-scrollbar-button {display:none;}";
	str+="body{visibility: hidden;}";
	str+="</style>";
	str+="<link href='src/defaultPlugin.css' rel='stylesheet' type='text/css'>";
	str+="</head><body>";

	if(d.status=="ok"){
		try{
			str += PLUGINS.all[d.type].template({data: d.data, listName: d.displayName || d.defaultName});
		}catch(err){
			console.log(err)
			str += "<h3>Plugin Template Error</h3>";
		}
	}else{
		str+="<header><h1>"+(d.displayName || d.defaultName)+"</h1></header>";
		str+="<div class='not-responding'>";
		str+="<h2><em>"+d.type+"</em> is not responding to requests for data.</h2>";
		str+="<h3>IP <em>"+d.addresses[0]+"</em></h3>";
		str+="<h3>Port <em>"+d.port+"</em></h3></div>";
	}
	
	str+="</body></html>";

		
	$deviceDrawArea.setAttribute("class", d.type+" draw-area");
	$deviceDrawArea.contentWindow.document.open();
	$deviceDrawArea.contentWindow.document.write(str);


	if(d.pinIndex){
		$devicePinned.style.display = "block";
	}else{
		$devicePinned.style.display = "none";
	}
}

module.exports.draw = function(device){
	if(device==undefined){
		return true;
	}
	drawDeviceInterface(device.id)
}




module.exports.addDeviceToList = function(device){
	var d = device;
	var addressStr = d.addresses[0] || "";
	for(var i=1; i<d.addresses.length; i++){
		addressStr+=", "+d.addresses[i];
	}
	var html = "";
	if(d.status=="ok"){
		html += "<div class='status material-icons green'>done</div>";
	}else if(d.status=="refresh"){
		html += "<div class='status material-icons'>refresh</div>";
	}else{
		html+="<div class='status material-icons red'>clear</div>";
	}
	html+="<div class='type'><img height='18px' src='plugins/"+d.type+"/icon.png'></div>";
	html+="<div class='name'>"+(d.displayName || d.defaultName)+"</div>";

	let elem = document.getElementById(d.id);
	if(elem==null){
		document.getElementById("device-list").insertAdjacentHTML("beforeend", "<a class='device' id='"+d.id+"'>"+html+"</a>");
	}else{
		elem.innerHTML = html;
	}
}
module.exports.removeDeviceFromList = function(device){
	var d = device;
	document.getElementById(device.id).remove();
}



switchDevice = function(id){

	if(activeDevice && activeDevice.pinIndex==false){
		document.getElementById("device-"+activeDevice.id).remove();
		activeDevice = false;
	}
	activeDevice = DEVICE.all[id];


	var cols = 1;
	if(pinnedDevices.length>0){
		cols+=pinnedDevices.length;
	}
	if(pinnedDevices.indexOf(activeDevice)>=0 || id==undefined){
		cols--;
	}

	document.getElementById("all-devices").style.gridTemplateColumns = "repeat("+(cols)+", 1fr)";

	if(id==undefined){
		//document.getElementById('refresh-device-button').style.opacity = 0.2;
		document.getElementById('refresh-device-button').disabled = true;
		document.getElementById('device-settings-table').style.display = "none";
		return true;
	}else{
		document.getElementById('refresh-device-button').disabled = false;
		//document.getElementById('refresh-device-button').style.opacity = 1;
	}


	var i = DEVICE.all[id].id;

	var $deviceWrapper = document.getElementById("device-"+i);
	if(!$deviceWrapper){
		var html = '<div class="col device-wrapper" id="device-'+i+'">'
		+'<img id="device-'+i+'-pinned" class="device-pin" src="src/img/outline_push_pin_white_18dp.png">'
		+'<iframe id="device-'+i+'-draw-area" class="draw-area"></iframe>'
		+'<div id="device-'+i+'-settings"></div></div>';
		document.getElementById("all-devices").insertAdjacentHTML("afterbegin", html);

		$deviceWrapper = document.getElementById("device-"+i);
	}

    switchClass(document.getElementById(id), "active-device");
    drawDeviceInterface(id);
    switchClass(document.getElementById("device-"+id), "active-device-outline");



    document.getElementById('device-settings-table').style.display = "block";
    document.getElementById('device-settings-plugin-dropdown').value=activeDevice.type;
    document.getElementById("device-settings-name").value = activeDevice.displayName || activeDevice.defaultName || "";
    document.getElementById("device-settings-ip").value = activeDevice.addresses[0] || "";
    document.getElementById("device-settings-port").value = activeDevice.port || "";
    document.getElementById("device-settings-pin").checked = activeDevice.pinIndex;


    ipcRenderer.send("enableDeviceDropdown", "");
    ipcRenderer.send("setDevicePin", !DEVICE.all[id].pinIndex==false);
   
}
module.exports.switchDevice = switchDevice;


module.exports.getActiveDevice = function(){
	return activeDevice;
}

module.exports.pinActiveDevice = function(){
	if(activeDevice==undefined){
		return true;
	}
	if(pinnedDevices.indexOf(DEVICE.all[activeDevice.id])==-1){
		pinnedDevices.push(DEVICE.all[activeDevice.id]);
	}
	DEVICE.changeActivePinIndex(true);
}

module.exports.unpinActiveDevice = function(){
	if(activeDevice==undefined){
		return true;
	}
	pinnedDevices.splice(pinnedDevices.indexOf(DEVICE.all[activeDevice.id]), 1);
	DEVICE.changeActivePinIndex(false);
}

module.exports.pinDevice = function(device){
	pinnedDevices.push(device)
	DEVICE.changePinIndex(device, true);
}
module.exports.unpinDevice = function(device){
	pinnedDevices.push(device)
	DEVICE.changePinIndex(device, false);
}

module.exports.resetPinned = function(){
	pinnedDevices.length = 0;
	activeDevice = false;
	//switchDevice();
	try{
		document.querySelector("#device-list .active-device").classList.remove("active-device");
	}catch(err){}
	document.getElementById("all-devices").innerHTML = "";
}

module.exports.getPinnedDevices = function(){
	return pinnedDevices;
}


module.exports.toggleSlotButtons = function(slotIndex){
	if(slotIndex==1){
		document.getElementById("save-slot-1").classList.add("active");
		document.getElementById("save-slot-2").classList.remove("active");
		document.getElementById("save-slot-3").classList.remove("active");
	}else if(slotIndex==2){
		document.getElementById("save-slot-1").classList.remove("active");
		document.getElementById("save-slot-2").classList.add("active");
		document.getElementById("save-slot-3").classList.remove("active");
	}else if(slotIndex==3){
		document.getElementById("save-slot-1").classList.remove("active");
		document.getElementById("save-slot-2").classList.remove("active");
		document.getElementById("save-slot-3").classList.add("active");
	}
}

module.exports.selectPreviousDevice = function(){
	if(activeDevice==undefined){
		return true;
	}
	var keys = Object.keys(DEVICE.all);
	var prevIndex = Math.max(0, keys.indexOf(activeDevice.id)-1);
	switchDevice(keys[prevIndex])
}
module.exports.selectNextDevice = function(){
	if(activeDevice==undefined){
		return true;
	}
	var keys = Object.keys(DEVICE.all);
	var prevIndex = Math.min(keys.length-1, keys.indexOf(activeDevice.id)+1);
	switchDevice(keys[prevIndex])
}



populatePluginLists = function(){

	var typeSelect = "";
	var addSelect = '<option value="" disabled selected hidden>+</option>';

	for(const pluginType in PLUGINS.all){
		var plugin = PLUGINS.all[pluginType];

		addSelect+="<option value='"+pluginType+"'>"+plugin.defaultName+"</option>";
		typeSelect+="<option value='"+pluginType+"'>"+plugin.defaultName+"</option>";
	}

	document.getElementById("device-settings-plugin-dropdown").innerHTML = typeSelect;
	document.getElementById("add-device-button").innerHTML = addSelect;
}

function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};
