/**
 * Created by 徐旭 on 2018/6/26
 */
module.exports = {
	mysql: {
		host: '223.2.197.241',
		user: 'root',
		password: 'nsi-dev',
		database: 'fastdfs',
		port: 3306,
		//强制日期类型，需要配合mysql数据库使用，另外，mysql模块默认编码是utf-8
		dateStrings: 'DATETIME'
	}
};