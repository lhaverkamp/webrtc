var debug = require('debug')('rtc');

module.exports = function(server, opts) {
	var io = require('socket.io')(server);
	
	// the simple signalling server
	io.on('connection', function(socket) {
		debug(socket.id + ' connected');
		
		function getClients() {
			var room = io.sockets.adapter.rooms[socket.room];
			
			return room && room.sockets ? Object.keys(room.sockets).length : 0;
		}
		
		socket.on('announce', function(data) {
			socket.room = data.room;
			var room = socket.room;

			/*
			if(getClients() >= 2) {
				socket.in(socket.id).emit('peer:reject', { message: 'room is full' });
				
				return;
			}
			*/
			
			debug(room + ' has ' + getClients() + ' clients');
			socket.join(room); // join room
			debug(socket.id + ' joined room ' + room);
			
			socket.in(room).emit('peer:announce', { peerId: socket.id }); // announce to peers
		});
		
		socket.on('update', function(data) {
			socket.room = data.room;
			var room = socket.room;
			
			debug(room + ' has ' + getClients() + ' clients');
			socket.join(room); // join room
			debug(socket.id + ' rejoined room ' + room);
			debug(data);
			
			socket.in(room).emit('peer:update', { newPeerId: socket.id, peerId: data.peerId }); // communicate identifier changes
		});
		
		socket.on('disconnect', function(data) {
			var room = socket.room;
			
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