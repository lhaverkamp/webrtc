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
