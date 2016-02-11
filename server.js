var express = require('express'),
	fs = require('fs'),
	https = require('https'),
	path = require('path');

var config = require('./app/config');
var app = express();

app.engine('jade', require('jade').__express);
app.set('views', './app/views');
app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));
app.use(require('./app/routes/http'));

var options = {
	key: fs.readFileSync(config.key),
	cert: fs.readFileSync(config.cert)
};

var server = https.createServer(options, app);
server.listen(config.port, config.hostname, function() {
	console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});
