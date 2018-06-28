/**
 * Created by 徐旭 on 2018/6/26
 */
module.exports = ftpSql = {
	// insert: 'INSERT INTO ftp_file(id, file_path) VALUES(0,?)',
	insert: 'INSERT INTO ftp_file(id, file_path, date) VALUES(0, ?, ?)',
	queryAll: 'SELECT * FROM ftp_file',
	getFtpById: 'SELECT * FROM ftp_file WHERE id = ?'
};