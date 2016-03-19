// allows us to skip the adapter.js dependency
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;

var Rtc = function(config) {
	this.peers = [];
	
	// if we have constraints, then capture video
	if(config.constraints) {
		this.localVideo(config);
	}

	// connect to the signaling server
	this.connect(config);
};

Rtc.prototype.connect = function(config) {
	// create signaling server
	var socket = io(config.signaller);
	
	socket.on('connect', this.join(socket, config));
	socket.on('peer:announce', this.call(socket, config));
	socket.on('peer:call', this.answer(socket, config));
	socket.on('peer:accept', this.accept(socket, config));
	socket.on('peer:ice', this.addIceCandidate);
	socket.on('peer:disconnect', this.removeRemoteVideos);
	
	// TODO RTCDataChannel
	/*
	Object.keys(config.channels || {}).forEach(function(name) {
		var channelConfig = config.channels[name];
		
		//TODO conference.createDataChannel(name, channelConfig === true ? null : channelConfig);
	});
	*/
};

Rtc.prototype.join = function(socket, config) {
	// closure to ensure the correct scope for the event listener
	return function(data) {
		console.log('join');
		socket.emit('join', { room: config.room });
	}
};

Rtc.prototype.createPeerConnection = function(peerId, socket, config) {
	// TODO var pc = new RTCPeerConnection( { iceServers: ((config || {}).ice || []) } );
	var pc = new RTCPeerConnection(null);
	pc.onicecandidate = this.icecandidate(peerId, socket);
	pc.onaddstream = this.remoteVideo(peerId, config);
	
	this.peers[peerId] = pc;
	
	return pc;
};

Rtc.prototype.call = function(socket, config) {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(data) {
		var pc = _this.createPeerConnection(data.peerId, socket, config);
		
		_this.capture(config.constraints, config.options)
		.then(function(stream) {
			pc.addStream(stream);

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
		}).catch(_this.handleError);
	}
};

Rtc.prototype.answer = function(socket, config) {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(data) {
		var pc = _this.createPeerConnection(data.peerId, socket, config);
		
		_this.capture(config.constraints, config.options)
		.then(function(stream) {
			pc.addStream(stream);

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
		}).catch(_this.handleError);
	}
};

Rtc.prototype.accept = function(socket, config) {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(data) {
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

Rtc.prototype.icecandidate = function(peerId, socket) {
	// closure to ensure the correct scope for the event listener
	return function(event) {
		if(event.candidate) {
			// sent to peer
			socket.emit('peer:candidate', { 'from': socket.id, 'to': peerId, 'candidate' : event.candidate });
		}
	}
};

Rtc.prototype.addIceCandidate = function() {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(data) {
		var pc = this.peers[data.peerId];

		if(pc) {
			var candidate = new RTCIceCandidate(data.candidate);
			
			console.log('addIceCandidate');
			pc.addIceCandidate(candidate).catch(this.handleError);
		} else {
			_this.handleError("missing RTCPeerConnection for peer " + data.peerId);
		}
	}
};

Rtc.prototype.capture = function(constraints, options) {
	return new Promise(function(resolve, reject) {
		navigator.getUserMedia(constraints, resolve, reject);
	});
};

Rtc.prototype.attach = function(stream, options) {
	var URL = typeof window != 'undefined' && window.URL;

	// allows for one parameters to be passed in
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
	    } else if (el.srcObject) {
	    	el.srcObject = stream;
	    } else if (el.mozSrcObject) {
	    	el.mozSrcObject = stream;
	    }

	    if(autoplay === undefined || autoplay) {
	    	el.setAttribute('autoplay', '');
	    	el.play();
	    }

	    return applyModifications(el, options);
	}

	return attachToElement(stream, options);
}

Rtc.prototype.attachLocal = function(stream, options) {
	if(typeof options == 'undefined') {
		options = {};
	}
	
	// by default we mute the local video until someone joins the conference
	var opts = Object.assign({}, options, { muted: true, mirror: true });
	
	return this.attach(stream, opts);
}

Rtc.prototype.localVideo = function(config) {
	var _this = this;
	
	// capture, attach, render-local, start-conference
	this.capture(config.constraints, config.options)
	.then(function(stream) {
		window.localStream = stream;
		
		return stream;
	}).then(function(stream) {
		return _this.attachLocal(stream, config.options);
	}).then(function(el) {
		el.classList.add('rtc', 'local-video');
		
		var node = document.querySelector((config || {}).localContainer || L_VIDEO);
		node.appendChild(el);
	}).catch(this.handleError);
};

Rtc.prototype.remoteVideo = function(peerId, config) {
	var _this = this;
	
	// closure to ensure the correct scope for the event listener
	return function(event) {
		var stream = event.stream;
		
		Promise.resolve(_this.attach(stream, config))
		.then(function(el) {
			el.classList.add('rtc', 'remote-video');
			el.setAttribute('data-peer', peerId);
			
			var node = document.querySelector((config || {}).remoteContainer || R_VIDEO);
			node.appendChild(el);
		}).catch(_this.handleError);
	}
};

Rtc.prototype.removeRemoteVideos = function(data) {
	console.log('removeRemoteVideos');
	var id = data.peerId;
	var nodes = document.querySelectorAll('[data-peer="' + id + '"]');
	
	for(var i=0;i<nodes.length;i++) {
		var el = nodes[i];
		el.parentNode.removeChild(el);
	}
};

Rtc.prototype.handleError = function(err) {
	console.log(err);
	console.log(err.stack);
};

Rtc.prototype.toggleAudio = function(event) {
	if(window.stream) {
		var audioTracks = window.stream.getAudioTracks();
	
		if(audioTracks[0]) {
			audioTracks[0].enabled = !audioTracks[0].enabled;

			var icon = event.currentTarget.querySelector("i"); 
			icon.classList.toggle("fa-microphone");
			icon.classList.toggle("fa-microphone-slash");
		}
	}
};

Rtc.prototype.toggleVideo = function(event) {
	if(window.stream) {
		var videoTracks = window.stream.getVideoTracks();
		
		if(videoTracks[0]) {
			videoTracks[0].enabled = !videoTracks[0].enabled;

			var icon = event.currentTarget.querySelector("i"); 
			icon.classList.toggle("fa-eye");
			icon.classList.toggle("fa-eye-slash");
		}
	}
};

var rtc = new Rtc(rtcOpts);

document.getElementById("audio").addEventListener("click", rtc.toggleAudio);
document.getElementById("video").addEventListener("click", rtc.toggleVideo);