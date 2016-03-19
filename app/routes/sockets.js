var debug = require('debug')('rtc');

module.exports = function(server, opts) {
	var io = require('socket.io')(server);
	
	var clients = [];

	// the simple signalling server
	io.on('connection', function(socket) {
		var room;
		
		debug(socket.id + ' connected');
		
		socket.on('join', function(data) {
			room = data.room;
			
			socket.join(room); // join room
			debug(socket.id + ' joined room ' + room);
			socket.in(room).emit('peer:announce', { peerId: socket.id }); // announce to peers
		});

		socket.on('disconnect', function(data) {
			debug(socket.id + ' left room ' + room);
			socket.in(room).emit('peer:disconnect', { peerId: socket.id }); // announce to peers
		});
		
		// Peer to Peer Communications
		socket.on('peer:call', function(data) {
			debug('peer:call from ' + socket.id + ' to ' + data.to);
			socket.broadcast.to(data.to).emit('peer:call', { peerId: socket.id, sdp: data.sdp }); // send offer
		});
		
		socket.on('peer:accept', function(data) {
			debug('peer:accept from ' + socket.id + ' to ' + data.to);
			socket.broadcast.to(data.to).emit('peer:accept', { peerId: socket.id, sdp: data.sdp }); // accept offer
		});
		
		socket.on('peer:candidate', function(data) {
			socket.broadcast.to(data.to).emit('peer:ice', { peerId: socket.id, candidate: data.candidate }); // ice candidate
		});
	});
}