document.onclick = function(e){
	window.closePopovers();
}

window.init();


document.getElementById("search-button").onclick = function(e){
    window.searchAll();
}
document.getElementById("add-device-button").onclick = function(e){
	//e.stopPropagation();
    //document.getElementById("add-device-popover").style.display = "block";
}



window.closePopovers = function(){
	//document.getElementById("add-device-popover").style.display = "none";
}



