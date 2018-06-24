var express = require('express');
var router = express.Router();
var ftpserver = require('../public/javascripts/ftpserver');

/* GET home page. */
router.get('/', function(req, res, next) {
	console.log("req = " + JSON.stringify(req.body));
  res.render('index', { title: 'Express' });
});

router.post('/test', function (req, res) {
	var data = {
		oldPath: req.body.oldPath,
		fileName: req.body.fileName
	}
	// console.log('data=' + data);
	// console.log('hello=' + data.get('hello'));
	// console.log('hello=' + data['hello']);
	ftpserver(data);
	res.render('index', { title: 'Express' });
});

module.exports = router;