/**
 * Created by 徐旭 on 2018/6/23
 */
let Client = require('ftp');
let Step = require('step');
let client = new Client();

module.exports = ftpServer = (data) => {
	console.log("data=", data);
	// console.log("req=", req.body.oldPath);

	client.on('ready', () => {
		client.put(data.oldPath, data.fileName, (err) => {
			if (err) {
				throw err;
			}
			console.log('上传文件成功!');
			// res.send(data);
			client.end();
		});
	});

	let options = {
		host: '192.168.1.100',
		port: 21,
		user: 'admin',
		password: 'admin'
	};

	client.connect(options);
};