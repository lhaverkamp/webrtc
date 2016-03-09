// Set RTC options.
var rtcOpts = {
	// simple constraints for the defaults
	constraints: {
		video: true,
		audio: true
	},
	
	// specify the location of the signalling server
	signaller: 'wss://' + location.hostname + ':8443',
    
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

// Enable/Disable Audio Tracks
function toggleAudio(event) {
	var video = document.querySelector(rtcOpts.localContainer).querySelector("video");
	if(video) {
		video.removeAttribute("muted");
	}
	
	var mediaStreams = rtc.getLocalStreams();
	if(mediaStreams) {
		for(var i=0;i<mediaStreams.length;i++) {
			var audioTracks = mediaStreams[i].getAudioTracks();
			
			if(audioTracks[0]) {
				audioTracks[0].enabled = !audioTracks[0].enabled;
			}
		}
	}

	var icon = event.currentTarget.querySelector("i"); 
	icon.classList.toggle("fa-microphone");
	icon.classList.toggle("fa-microphone-slash");
}

// Enable/Disable Video Trcaks
function toggleVideo(event) {
	var mediaStreams = rtc.getLocalStreams();
	if(mediaStreams) {
		for(var i=0;i<mediaStreams.length;i++) {
			var videoTracks = mediaStreams[i].getVideoTracks();
			
			if(videoTracks[0]) {
				videoTracks[0].enabled = !videoTracks[0].enabled;
			}
		}
	}

	var icon = event.currentTarget.querySelector("i"); 
	icon.classList.toggle("fa-eye");
	icon.classList.toggle("fa-eye-slash");
}

document.getElementById("audio").addEventListener("click", toggleAudio);
document.getElementById("video").addEventListener("click", toggleVideo);
