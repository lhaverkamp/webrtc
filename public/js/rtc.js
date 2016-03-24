var defaultConfig = {
	// simple constraints for the defaults
	constraints: {
		video: { frameRate: 10 },
		audio: true
	},
		
	// specify the location of the signalling server
	signaller: 'wss://' + location.hostname + ':8443',
	    
    // room defined by default
	room: null,
		
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
	localContainer: '.video-container',
		
	// the selector that will be used to identify the remote video container
	remoteContainer: '.video-container',
	
	// styling options
	options: {
		controls: {
			audio: { 
				enabled: 'fa-microphone',
				disabled: 'fa-microphone-slash'
			},
			video: {
				enabled: 'fa-eye',
				disabled: 'fa-eye-slash'
			},
			frameRate: {
				min: 10,
				max: 60,
				step: 10
			}
		}
	}
};

/**
 * This is the Rtc class that encapsulates all of the WebRTC logic.  It takes
 * in a config object that will determine basic options on how the service
 * will be initialized.
 * 
 * @param config an array of configuration options
 */
var Rtc = function(config) {
	// identifier
	this.id = null;
	// reference to localStream
	this.localStream = null;
	// array of connected peers
	this.peers = [];
	// array of channels
	this.channels = [];
	
	// connect to the signaling server
	var signaller = this.connect(config);
	
	// if we have constraints, then capture video
	if(config.constraints) {
		this.localVideo(signaller, config);
	}
};

/**
 * This method connects to the signalling server and sets up handling of each
 * of the signals that are handled on the client.
 */
Rtc.prototype.connect = function(config) {
	// create signaling server
	var socket = io(config.signaller);
	
	// handle socket events
	socket.on('connect', this.connected(socket, config));
	socket.on('reconnect', this.reconnect(socket, config));
	
	// implement signals
	socket.on('peer:announce', this.call(socket, config));
	socket.on('peer:update', this.update(socket, config));
	socket.on('peer:call', this.answer(socket, config));
	socket.on('peer:accept', this.accept(socket, config));
	socket.on('peer:ice', this.addIceCandidate(socket, config));
	socket.on('peer:disconnect', this.removeRemoteVideos(socket, config));

	return socket;
};

Rtc.prototype.connected = function(socket, config) {
	var _this = this;
	
	return function(data) {
		_this.id = socket.id;
	}
};

Rtc.prototype.reconnect = function(socket, config) {
	var _this = this;
	
	return function(data) {
		socket.emit('update', { room: config.room, peerId: _this.id });
		_this.id = socket.id; // store new id
	}
};

/**
 * This method creates an RTCPeerConnection that can be used for communication
 * with a remote user.
 * 
 * @param peerId the identifier of the peer we are connecting too
 * @param socket the signalling server used for initial peer communications
 * @param config the RTCConfiguration properties 
 * 
 * @return an RTCPeerConnection object
 */
Rtc.prototype.createPeerConnection = function(peerId, socket, config) {
	// TODO var pc = new RTCPeerConnection( { iceServers: ((config || {}).ice || []) } );
	var pc = new RTCPeerConnection(null);
	pc.onicecandidate = this.icecandidate(peerId, socket);
	pc.onaddstream = this.remoteVideo(peerId, config);
	
	// add the local stream
	if(this.localStream) {
		pc.addStream(this.localStream);
	}
	
	// add the connection to the peer list
	this.peers[peerId] = pc;
	
	if(((config || {}).channels || {}).chat) {
		// create a data channel for chat based communication
		var dc = pc.createDataChannel(null);
		// dc.onopen =
		dc.onmessage = this.message(config);
		// dc.onbufferedamountlow =
		// dc.onclose = 
		// dc.onerror
		
		this.channels[peerId] = dc;
	}
	
	return pc;
};

/**
 * This function generates is the event handling method for the peer:announce 
 * signal.  The client is initiating a call to a remote peer.
 * 
 * 1.  creates an RTCPeerConnection object
 * 2.  creates an SDP offer
 * 3.  sets the local description associated with the connection
 * 4.  sends the offer via the signalling server
 * 
 * @param socket the signalling server connection
 * @param config configuration options
 * 
 * @return the signal handling function
 */
Rtc.prototype.call = function(socket, config) {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(data) {
		// create RTCPeerConnection
		var pc = _this.createPeerConnection(data.peerId, socket, config);
		
		// TODO aPromise = pc.createOffer([options]);
		new Promise(function(resolve, reject) {
			console.log('createOffer');
			pc.createOffer(resolve, reject); // successCallback, failureCallback[, options]
		}).then(function(offer) {
			new Promise(function(resolve, reject) {
				console.log('setLocalDescription');
				pc.setLocalDescription(offer, resolve, reject); // sessionDescription, successCallback, failureCallback
			}).then(function() {
				// call the peer
				socket.emit('peer:call', { 'from': socket.id, 'to': data.peerId, 'sdp' : pc.localDescription });
			}).catch(_this.handleError);
		}).catch(_this.handleError);
	}
};

Rtc.prototype.update = function(socket, config) {
	var _this = this;
	
	return function(data) {
		console.log(data);
		// a possible alternative may be to use the 
		// RTCPeerConnection.peerIdentity property, although this would need
		// to be submitted to the signalling server
		var peerId = "/#" + data.peerId; // client and server have different ids
		var newPeerId = data.newPeerId;
		
		var peer = _this.peers[peerId];
		delete _this.peers[peerId];
		_this.peers[newPeerId] = peer;
		
		var channel = _this.channels[peerId];
		delete _this.channels[peerId];
		_this.channels[newPeerId] = peer;
		
		var node = document.querySelector('[data-peer="' + peerId + '"]');
		node.setAttribute('data-peer', newPeerId);
	}
};

/**
 * This function generates the event handling method for the peer:call signal.
 * The client is responding to a call offer from a remote peer.
 * 
 * 1.  creates an RTCPeerConnection object
 * 2.  sets the remote description associated with the connection
 * 3.  creates an answer to the SDP offer
 * 4.  sets the local description associated with the connection
 * 5.  sends the answer via the signalling server
 * 
 * @param socket the signalling server connection
 * @praam config configuration options
 * 
 * @return the signal handling function
 */
Rtc.prototype.answer = function(socket, config) {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(data) {
		var pc = _this.createPeerConnection(data.peerId, socket, config);
		
		new Promise(function(resolve, reject) {
			console.log('setRemoteDescription');
			pc.setRemoteDescription(new RTCSessionDescription(data.sdp), resolve, reject); // sessionDescription, successCallback, errorCallback
		}).then(new function() {
			console.log('createAnswer');
			pc.createAnswer(function(answer) {
				new Promise(function(resolve, reject) {
					console.log('setLocalDescription');
					pc.setLocalDescription(answer, resolve, reject); // sessionDescription, successCallback, failureCallback
				}).then(function() {
					// accept the call
					socket.emit('peer:accept', { 'from': socket.id, 'to': data.peerId, 'sdp' : answer });
				}).catch(_this.handleError);
			}, _this.handleError);
		}).catch(_this.handleError);
	}
};

/**
 * This functions generates the event handling method for the peer:accept
 * signal.  The client has received an answer to an offer from a remote peer.
 * 
 * 1.  sets the remote description associated with the connection
 * 
 * @param socket the signalling server connection
 * @param config configuration options
 * 
 * @return the signal handling function
 */
Rtc.prototype.accept = function(socket, config) {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(data) {
		// locates the RTCPeerConnection used when the offer was created
		var pc = _this.peers[data.peerId];
		
		if(pc) {
			new Promise(function(resolve, reject) {
				console.log('setRemoteDescription');
				pc.setRemoteDescription(new RTCSessionDescription(data.sdp), resolve, reject); // sessionDescription, successCallback, errorCallback
			}).catch(_this.handleError);
		} else {
			_this.handleError("missing RTCPeerConnection for peer " + data.peerId);
		}
	}
};

/**
 * This function generates the event handling method for the onicecandidate
 * event handler of an RTCPeerConnection.
 * 
 * @param @peerId the identifier of the remote peer
 * @param @socket the signalling server connection
 * 
 * @return the event handling function
 */
Rtc.prototype.icecandidate = function(peerId, socket) {
	// closure to ensure the correct scope for the event listener
	return function(event) {
		if(event.candidate) {
			// sent to peer
			socket.emit('peer:candidate', { 'from': socket.id, 'to': peerId, 'candidate' : event.candidate });
		}
	}
};

/**
 * This function generates the event handling method for the peer:ice signal.
 * 
 * @return the signal handling function
 */
Rtc.prototype.addIceCandidate = function() {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(data) {
		var pc = _this.peers[data.peerId];

		if(pc) {
			var candidate = new RTCIceCandidate(data.candidate);
			
			console.log('addIceCandidate');
			// This should return a promise, however during testing, it appears
			// that it doesn't hence the no-error handling version being used
			// TODO pc.addIceCandidate(candidate).catch(this.handleError);
			pc.addIceCandidate(candidate);
		} else {
			_this.handleError("missing RTCPeerConnection for peer " + data.peerId);
		}
	}
};

/**
 * This function captures the local stream.
 * 
 * @param constraints the constraints used for getUserMedia
 * @param options additional configuration options
 * 
 * @return a Promise object
 */
Rtc.prototype.capture = function(constraints, options) {
	return navigator.mediaDevices.getUserMedia(constraints);
};

/**
 * This function attaches a stream to a DOM element and returns the DOM element
 * to which it was attached.
 * 
 * @param stream the stream to attach
 * @param options an array of options that contains information about if the
 * stream should be muted or an existing element should be used.
 * 
 * @return the Element to which the video was attached
 */
Rtc.prototype.attach = function(stream, options) {
	var URL = typeof window != 'undefined' && window.URL;

	// allows for one parameter to be passed in
	if(typeof options == 'undefined') {
		options = {};
	}

	function applyModifications(el, options) {
		if((options || {}).muted) {
			el.muted = true;
			el.setAttribute('muted', '');
		}

		if((options || {}).mirror) {
	    	el.setAttribute('data-mirrored', true);
		}

		return el;
	}
	
	function attachToElement(stream, options) {
		var autoplay = (options || {}).autoplay;
		var elType = 'audio';
		var el = (options || {}).el || (options || {}).target;

		// check the stream is valid
		var isValid = stream && typeof stream.getVideoTracks == 'function';

		// determine the element type
		if(isValid && stream.getVideoTracks().length > 0) {
			elType = 'video';
		}

		// if we have been passed an "unplayable" target create a new element
		if(el && typeof el.play != 'function') {
			el = null;
		}

		// prepare the element
		el = el || document.createElement(elType);

		// attach the stream
		if(URL && URL.createObjectURL) {
			el.src = URL.createObjectURL(stream);
	    } else if(el.srcObject) {
	    	el.srcObject = stream;
	    } else if(el.mozSrcObject) {
	    	el.mozSrcObject = stream;
	    }

	    if(autoplay === undefined || autoplay) {
	    	el.setAttribute('autoplay', '');
	    	el.play();
	    }

	    return applyModifications(el, options);
	}
	
	return attachToElement(stream, options);
};

/**
 * This function attaches a stream to a DOM element and returns the DOM element
 * to which it was attached.
 * 
 * @param stream the stream to attach
 * @param options an array of options
 * 
 * @return the Element to which the video was attached
 */
Rtc.prototype.attachControls = function(stream, options) {
	var _this = this;
	
	// allows for one parameter to be passed in
	if(typeof options == 'undefined') {
		options = defaultConfig.options.controls;
	}
	
	function attachToElement(stream, options) {
		var audio = (options || defaultConfig.options.controls).audio;
		var video = (options || defaultConfig.options.controls).video;
		var frameRate = (options || defaultConfig.options.controls).frameRate;
		
		// <div class="video-controls">...</div>
		var el = document.createElement('div');
		el.classList.add('video-controls'); // TODO configurable
		
		if(audio) {
			var i = document.createElement("i");
			i.classList.add('fa', 'fa-2x', (audio || {}).enabled || defaultConfig.options.audio.enabled);

			var button = document.createElement("button");
			button.classList.add('button', 'audio-button'); // TODO configurable
			button.appendChild(i);
			button.addEventListener('click', _this.toggleAudio(stream, options));
			
			el.appendChild(button);
		}
		
		if(video) {
			var i = document.createElement("i");
			i.classList.add('fa', 'fa-2x', (video || {}).enabled || defaultConfig.options.video.enabled);
			
			var button = document.createElement("button");
			button.classList.add('button', 'video-button'); // TODO configurable
			button.appendChild(i);
			button.addEventListener('click', _this.toggleVideo(stream, options));
			
			el.appendChild(button);
		}
		
		// it appears that Chrome doesn't support applyConstraints to change
		// the frameRate on the fly
		if(frameRate && typeof window.MediaStreamTrack.prototype.applyConstraints == 'function') {
			var slider = document.createElement("input");
			slider.setAttribute('type', 'range');
			slider.setAttribute('min', (frameRate || {}).min || defaultConfig.options.frameRate.min);
			slider.setAttribute('max', (frameRate || {}).max || defaultConfig.options.frameRate.max);
			slider.setAttribute('step', (frameRate || {}).step || defaultConfig.options.frameRate.step);
			slider.classList.add('slider', 'slider-frame-rate'); // TODO configurable
			slider.addEventListener('change', _this.toggleFrameRate(stream, options));
			
			el.appendChild(slider);
		}
		
		return el;
	}

	return attachToElement(stream, options);
};

/**
 * This function attaches the local stream to a DOM element and returns the DOM
 * element to which it was attached.  The local stream is set to be muted.
 * 
 * @param stream the stream to attach
 * @param options an array of options
 * 
 * @return the Element to which the video was attached
 */
Rtc.prototype.attachLocal = function(stream, options) {
	// allows for one parameter to be passed in
	if(typeof options == 'undefined') {
		options = {};
	}
	
	return this.attach(stream, { muted: true, mirror: true });
}

/**
 * This function captures the local video, displays it on the page, and 
 * starts the conference.
 * 
 * @param socket the signalling server connection
 * @param config configuration options
 */
Rtc.prototype.localVideo = function(socket, config) {
	var _this = this;
	
	this.capture(config.constraints, config.options)
	.then(function(stream) {
		// store reference to local stream
		_this.localStream = stream;
		
		for(var i=0;i<_this.peers.length;i++) {
			var peer = _this.peers[i];
			peer.addStream(stream); // set local stream
		}
		
		// announce we are ready for conference
		socket.emit('announce', { room: config.room });
		
		return stream;
	}).then(function(stream) {
		var video = _this.attachLocal(stream, config.options);
		video.classList.add('video', 'local-video'); // TODO configurable
		
		var controls = _this.attachControls(stream, (config.options || defaultConfig.options).controls);
		
		var videoStreamContainer = document.createElement('div');
		videoStreamContainer.classList.add('video-stream-container'); // TODO configurable
		videoStreamContainer.appendChild(video);
		videoStreamContainer.appendChild(controls);

		var localContainer = document.querySelector((config || {}).localContainer || defaultConfig.localContainer);
		localContainer.insertBefore(videoStreamContainer, localContainer.childNodes[0]);
		
		return localContainer;
	}).catch(this.handleError);
};

/**
 * This function generates the event handler for onaddstream of the
 * RTCPeerConnection object.
 * 
 * @param @peerId the identifier of the remote peer
 * @param @socket the signalling server connection
 * 
 * @return the event handling function
 */
Rtc.prototype.remoteVideo = function(peerId, config) {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(event) {
		var stream = event.stream;
		
		var video = _this.attach(stream, config.options);
		video.classList.add('video', 'remote-video'); // TODO configurable
		
		// override for remote audio
		var opts = { audio: { enabled: 'fa-volume-up', disabled: 'fa-volume-off' } }; // TODO configurable
		opts = Object.assign({}, ((config || defaultConfig).options || defaultConfig.options).controls, { controls: opts });
		var controls = _this.attachControls(stream, opts.controls);
		
		var videoStreamContainer = document.createElement('div');
		videoStreamContainer.setAttribute('data-peer', peerId);
		videoStreamContainer.classList.add('video-stream-container'); // TODO configurable
		videoStreamContainer.appendChild(video);
		videoStreamContainer.appendChild(controls);
		
		var remoteContainer = document.querySelector((config || {}).remoteContainer || R_VIDEO);
		remoteContainer.appendChild(videoStreamContainer);
	}
};

/**
 * This function generates the event handler for the peer:disconnect signal.  
 * It removes the remote video element and removes the remote peer from the 
 * peer list.
 * 
 * @return the signal handling function
 */
Rtc.prototype.removeRemoteVideos = function() {
	var _this = this;
	
	return function(data) {
		console.log('removeRemoteVideos');
		var peerId = data.peerId;
		var nodes = document.querySelectorAll('[data-peer="' + peerId + '"]');
		
		// remove from remote video container
		for(var i=0;i<nodes.length;i++) {
			var el = nodes[i];
			el.parentNode.removeChild(el);
		}
		
		// remove from peer list
		delete _this.peers[peerId];
	}
};

Rtc.prototype.message = function(config) {
	var _this = this;
	
	return function(event) {
		var div = document.createElement('div');
		div.classList.add('message');
		div.textContent = event.data;
		
		var messageContainer = document.querySelector('.message-container'); // TODO configurable
		messageContainer.appendChild(div);
	}
};

/**
 * The generic error handler for the Rtc object.  It simply logs messages to
 * the console.
 */
Rtc.prototype.handleError = function(err) {
	console.log(err);
	console.log(err.stack);
};

/**
 * This function creates the event handler for the click event associated with
 * muting and unmuting audio.
 * 
 * @param stream the stream to manipulate
 * @param options the configuration options to use
 * 
 * @return the event handling function
 */
Rtc.prototype.toggleAudio = function(stream, options) {
	var _this = this;
	var audio = (options || {}).audio;
	
	return function(event) {
		if(stream) {
			var audioTracks = stream.getAudioTracks();
		
			if(audioTracks[0]) {
				audioTracks[0].enabled = !audioTracks[0].enabled;
	
				var icon = event.currentTarget.querySelector("i"); 
				icon.classList.toggle((audio || {}).enabled || defaultConfig.options.audio.enabled);
				icon.classList.toggle((audio || {}).disabled || defaultConfig.options.audio.disabled);
				// fa-stack-1 fa-stack-2 fa-ban
			}
		}
	}
};

/**
 * This method creates the event handler for the click event associated with
 * enabling and disabling the video stream.
 * 
 * @param stream the stream to manipulate
 * @param options the configuration options to use
 * 
 * @return the event handling function
 */
Rtc.prototype.toggleVideo = function(stream, options) {
	var _this = this;
	var video = (options || {}).video;
	
	return function(event) {
		if(stream) {
			var videoTracks = stream.getVideoTracks();
			
			if(videoTracks[0]) {
				videoTracks[0].enabled = !videoTracks[0].enabled;
	
				var icon = event.currentTarget.querySelector("i");
				icon.classList.toggle((video || {}).enabled || defaultConfig.options.video.enabled);
				icon.classList.toggle((video || {}).disabled || defaultConfig.options.video.disabled);
			}
		}
	}
};

Rtc.prototype.toggleFrameRate = function(stream, options) {
	var _this = this;
	var opts = (options || {}).frameRate;
	
	return function(event) {
		if(stream) {
			var videoTracks = stream.getVideoTracks();
			
			if(videoTracks[0]) {
				videoTracks[0].applyConstraints({ frameRate: event.currentTarget.value })
				.catch(this.handleError);
			}
		}
	}
};

Rtc.prototype.sendMessage = function(stream, options) {
	var _this = this;
	
	return function(event) {
		var input = document.querySelector('.chat-message');
		var message = input.value;
		input.value = null;
		
		if(message) {
			for(var i=0;i<_this.channels.length;i++) {
				var channel = _this.channels[i];
				channel.send(message);
			}
	
			var span = document.createElement('span');
			span.textContent = 'You:';
			
			var text = document.createTextNode(message);
			
			var div = document.createElement('div');
			div.classList.add('message');
			div.appendChild(span);
			div.appendChild(text);
	
			var messageContainer = document.querySelector('.message-container');
			messageContainer.appendChild(div);
		}
	}
};

var rtc = new Rtc(rtcOpts);

document.querySelector('.send-button').addEventListener('click', rtc.sendMessage(null, rtcOpts));
