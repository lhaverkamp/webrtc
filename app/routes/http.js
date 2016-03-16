var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
	res.render('index', { url: req.url });
});
router.post('/join', function(req, res) {
	console.log(req);
	console.log(req.body);
	var room = req.body.room;
	
	res.redirect('/' + room);
});
router.get('/:roomId', function(req, res) {
	res.render('room', { room: req.params.roomId });
});

module.exports = router;