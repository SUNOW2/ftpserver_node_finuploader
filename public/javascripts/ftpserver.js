/**
 * Created by 徐旭 on 2018/6/23
 */

module.exports = function(data) {
	var Client = require('ftp');
	var client = new Client();

	client.on('ready', function () {
		client.put(data.oldPath, data.fileName,  () => {
			if (err) {
				throw err;
			}
			console.log('上传文件成功!');
			client.end();
		});
	});

	var options = {
		host: '192.168.1.100',
		port: 21,
		user: 'admin',
		password: 'admin'
	};

	client.connect(options);
};