![Latest Release Build Status](https://img.shields.io/github/workflow/status/stagehacks/Cue-View/release?label=release%20build&logo=github)
# Cue View

A dashboard for everything in your show.

![Screen Shot 2021-10-26 at 11 57 21 PM](https://user-images.githubusercontent.com/919746/138997636-dfca293a-7c98-459d-85a3-405c9b11ce8a.png)

## Features

- Tons of supported equipment
- Auto discover devices on the network
- Live updating
- Configurable layout

## Supported Devices

- QLab 4
- ETC Eos Consoles
- Watchout
- PJLink Projectors
- X32 Audio Consoles
- XAir Audio Consoles
- Art-Net Universes
- sACN Universes

#### Future Devices

- Spikemark (not possible until additional OSC methods are added)
- ATEM Video Mixers
- Epson Pro series Projectors
- DiGiCo Consoles
- d&b DS100, amps
- Hog
- Meyer Galileo Processors

# Plugins

A Cue View "plugin" is a system for communicating with a type of device, for example QLab or Watchout. It consists of a JS file that describes how to communicate with the device, an HTML template for displaying the device's data, and a CSS file to style the HTML.

### plugin.js

```js
exports.config = {
	defaultName: 'Example Plugin',
	connectionType: 'osc' or 'TCPsocket' or 'UDPsocket',
	searchOptions: {
		type: 'Bonjour',
		bonjourNane: 'device'
	},
	searchOptions: {
		type: 'UDPsocket',
		searchBuffer: Buffer.from([0x00, 0x01, 0x02]),
		devicePort: 1234, // port the device receives messages on
		listenPort: 2345, // port Cue View should listen for responses on
		validateResponse: function(msg, info){
			// if this function returns true, Cue View adds the responding IP address to the list
		}
	},
	searchOptions: {
		type: 'TCPport',
		searchBuffer: Buffer.from('are you there'),
		testPort: 1234, // port the device receives messages on
		validateResponse: function(msg, info){
			// if this function returns true, Cue View adds the responding IP address to the list
		}
	},
	defaultPort: 1234, // only available for TCPsocket and UDPsocket devices
	heartbeatInterval: 5000 // how frequently, in ms, to send the heartbeat message
}

exports.ready = function (device){
	// runs when Cue View identifies a new device. send all data requests here
	device.send(); // method for sending a message to the device requesting more info. arguments change based on connectionType

	device.send(`/this/is/osc`); // osc
	device.send(`/this/is/osc`, [{ type: 'i', value: 20 }, { type: 's', value: 'foo' }]); // osc with arguments

	device.send(`hello`); // UDPsocket and TCPsocket

}

exports.data = function (device, buf){
	// runs when Cue View receives a message from the device.
	device.draw(); // flag for QLab to update the device's view
	device.send();
}

exports.heartbeat = function (device){
	// runs every n milliseconds, defined by exports.heartbeatInterval
	devide.send();
}
```
