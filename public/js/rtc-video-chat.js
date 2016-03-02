// Set RTC options.
var rtcOpts = {
	// simple constraints for the defaults
	constraints: {
		video: true,
		audio: true
	},
	
	// specify the location of the signalling server
    //signaller: 'https://switchboard.rtc.io',
   	//signaller: 'https://localhost:8443',
	signaller: 'https://192.168.1.225:3000',
    
    // room defined by default
	room: 'test-room',
	
	// specify ice servers or a generator function to create ice servers
	ice: [],
	
	// any data channels that we want to create for the conference by default
	// a chat channel is created, but other channels can be added also
	// additional options can be supplied to customize the data channel config
	// see: <https://w3c.github.io/webrtc-pc/#idl-def-RTCDataChannelInit>
	channels: {
		chat: true
	},
	
	// the selector that will be used to identify the local video container
	localContainer: '#l-video',
	
	// the selector that will be used to identify the remote video container
	remoteContainer: '#r-video',
	
	// should we attempt to load any plugins?
	plugins: [],
	
	// common options overrides that are used across the rtc.io packages
	options: {}
};

// call RTC module
var rtc = RTC(rtcOpts);

// A contenteditable element to show our messages
var messageWindow = document.getElementById('messages');

// Bind to events happening on the data channel
function bindDataChannelEvents(id, channel, attributes, connection) {
  // Receive message
  channel.onmessage = function (evt) {
    messageWindow.innerHTML = evt.data;
  };

  // Send message
  messageWindow.onkeyup = function () {
    channel.send(this.innerHTML);
  };
}

// Start working with the established session
function init(session) {
  session.createDataChannel('chat');
  session.on('channel:opened:chat', bindDataChannelEvents);
  
  // connected
  // disconnected
  // local:announce
  // peer:filter
  // peer:connected
  // peer:announce
  // peer:update
  // message:<command>
  session.on('call:started', callStarted);
  session.on('call:ended', callEnded);
}

// Detect when RTC has established a session
rtc.on('ready', init);
