var express = require('express');
var fs = require('fs');
var https = require('https');
var path = require('path');

var bodyParser = require('body-parser');

var config = require('./app/config');
var app = express();

app.engine('jade', require('jade').__express);
// TODO app.set('port', config.port);
app.set('views', './app/views');
app.set('view engine', 'jade');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(require('./app/routes/http'));

var options = {
	key: fs.readFileSync(config.key),
	cert: fs.readFileSync(config.cert)
};

var server = https.createServer(options, app);
server.listen(config.port, config.hostname, function(err) {
	if(err) {
		return console.log('Encountered error starting server: ', err);
	}
	
	console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});

var switchboard = require('./switchboard.js')(server);
switchboard.on('data', function(data, peerId, spark) {
	console.log({ peer: peerId }, 'received: ' + data);
});
