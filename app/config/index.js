var fs = require('fs'),
	defaults = require('cog/defaults'),
	path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var all = {
	host: process.env.HOST || '127.0.0.1',
	port: process.env.PORT || '8443',
	
	key: './app/config/keys/server.key',
	cert: './app/config/keys/server.crt'
};

var config = defaults(
	{},
	all,
	fs.readFileSync(path.join(__dirname, process.env.NODE_ENV + ".json"))
); 

module.exports = config;