var debug = require('debug')('switchboard');

module.exports = function(server, opts) {
	var WebSocketsServer = require('ws').Server;
	var wss = new WebSocketsServer({ server: server });
	var board = require('rtc-switch')(opts);
	var connections = [];

	wss.on('connection', function connection(ws) {
		var peer = board.connect();

		// add the socket to the connection list
		connections.push(ws);
		
		ws.on('message', peer.process);
		peer.on('data', function(data) {
			if(ws.readyState === 1) {
				debug('<== %s %s', peer.id, data);
				ws.send(data, function(err) {
					// if err is not defined the send has been completed,
					// otherwise the err object will indicate what failed
					if(err) {
						console.log(err);
					}
				});
			}
		});

		ws.on('close', function() {
			// trigger the peer leave
			peer.leave();

			// splice out the connection
			connections = connections.filter(function(conn) {
				return conn !== ws;
			});
		});
	});

	// add a reset helper
	board.reset = function() {
		connections.splice(0).forEach(function(conn) {
			conn.close();
		});
	};

	return board;
}