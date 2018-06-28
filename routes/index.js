let express = require('express');
let router = express.Router();
let Client = require('ftp');
let client = new Client();
let ftpServer = require('../public/javascripts/ftpserver');
let mysql = require('mysql');
let dbConfig = require('../db/DBConfig');
let ftpSql = require('../db/ftpSql');
let pool = mysql.createPool(dbConfig.mysql);

router.post('/ftpServerUpload', (req, res, next) => {
	let data = {
		oldPath: req.body.oldPath,
		fileName: req.body.fileName
	};

	return ftpServer(data, req, res);

	// let options = {
	// 	host: '192.168.1.100',
	// 	port: 21,
	// 	user: 'admin',
	// 	password: 'admin'
	// };
	//
	// client.connect(options);
	//
	// client.on('ready', () => {
	// 	console.log("data=", data);
	// 	client.put(data.oldPath, data.fileName, (err) => {
	// 		if (err) {
	// 			throw err;
	// 			return res.send("文件上传失败");
	// 		}
	// 		console.log('上传文件成功!');
	// 		client.end();
	// 		res.send(data);
	// 	});
	// });
});


router.post("/addFtp", (req, res) => {
	console.log("req=", req.body);
// 从连接池获取连接
	pool.getConnection((err, connection) => {
		console.log("haha");
	//	获取前端传递的数据
		connection.query(ftpSql.insert, [req.body.id, req.body.filePath], (err, result) => {
			if (result) {
				res.send({
					msg: '成功'
				})
			}
			connection.release();
		});
	})
});



module.exports = router;