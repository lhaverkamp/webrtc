var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
	res.render('index', { url: req.url });
});
router.post('/join', function(req, res) {
	var room = req.body.room;
	
	res.redirect('/' + room);
});
router.get('/:roomId', function(req, res) {
	res.render('room', { room: req.params.roomId, name: req.params.name });
});

module.exports = router;