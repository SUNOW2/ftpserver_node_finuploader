/**
 * Created by 徐旭 on 2018/6/25
 */
let
	// express框架
	express = require('express'),
	router = express.Router(),
	url = require('url');
	// 数据库配置
	mysql = require('mysql'),
	dbConfig = require('../../db/DBConfig'),
	ftpSql = require('../../db/ftpSql'),
	pool = mysql.createPool(dbConfig.mysql),
	fs = require("fs"),
	rimraf = require("rimraf"),
	mkdirp = require("mkdirp"),
	Client = require('ftp'),
	multiparty = require('multiparty'),

	fileInputName = process.env.FILE_INPUT_NAME || "qqfile",
	chunkDirName = "chunks",
	maxFileSize = process.env.MAX_FILE_SIZE || 0,
	publicDir = "/home/yiliao/public/",
	uploadedFilesPath = "/home/yiliao/upload/",
	nodeModulesDir = "/home/yiliao/public/nodeModule/",
	downloadFilesPath = "/home/yiliao/ftp/",
	uploadUri = "http://223.2.197.241:80/";

// 上传文件接口
router.post("/uploads", onUpload);
// 下载文件接口,根据id下载文件
router.get("/download", downLoad);

function downLoad(req, res) {
	let getUriObj = url.parse(req.url, true);
	querySql((data) => {
		res.download(downloadFilesPath + data.uuid + "_" + data.fileName, data.fileName, (err) => {
			if (err) {
				console.log("err", err);
			} else {
				console.log("ok");
			}
		});
	}, getUriObj)
}

function querySql(success, getUriObj) {
	pool.getConnection((err, connection) => {
		connection.query(ftpSql.getFtpById, getUriObj.query.id, (err, result) => {
			if(result[0].file_path != '') {
				let data = {
					fileName: result[0].file_path,
					uuid: result[0].uuid
				}
				success(data);
			}
			connection.release();
		})
	});
}

function onUpload(req, res) {
	let form = new multiparty.Form();
	console.log("测试nodeJs上传文件");

	form.parse(req, function (err, fields, files) {
		let partIndex = fields.qqpartindex;

		// text/plain is required to ensure support for IE9 and older
		res.set("Content-Type", "text/plain");

		if (partIndex == null) {
			onSimpleUpload(fields, files[fileInputName][0], res);
		}
		else {
			onChunkedUpload(fields, files[fileInputName][0], res);
		}
	});
}

function onSimpleUpload(fields, file, res) {
	let uuid = fields.qquuid,
		responseData = {
			success: false
		};

	file.name = fields.qqfilename;

	if (isValid(file.size)) {
		moveUploadedFile(file, uuid, function () {
				uploadFileAndFtpServer(function () {
					responseData = {
						success: true,
						result: {
							name: file.name[0],
							uri: uploadUri + uuid[0].replace('_', '+') + '_' + file.name[0]
						},
						reset: null,
						error: null
					};
					deleteAll(uploadedFilesPath + uuid);
					res.send(responseData);
				}, file, uuid);
			},
			function () {
				responseData.error = "Problem copying the file!";
				res.send(responseData);
			},
		);
	}
	else {
		failWithTooBigFile(responseData, res);
	}
}

function uploadFileAndFtpServer(success, file, uuid) {
	let client = new Client();
	let options = {
		host: '223.2.197.241',
		port: 2121,
		user: 'admin',
		password: 'admin'
	};
	client.connect(options);
	client.on('ready', () => {
		client.put(uploadedFilesPath + uuid + "/" + file.name[0], uuid[0].replace('_', '+') + '_' + file.name[0], (err) => {
			if (err) {
				throw err;
			}
			console.log('上传文件成功!');
			client.end();
			uploadEnd(uuid, file.name[0], success);
		});
	});
}

function uploadEnd(uuid, filePath, success) {
	pool.getConnection((err, connection) => {
		console.log("数据库操作");
		//	获取前端传递的数据
		connection.query(ftpSql.insert, [filePath, new Date().toLocaleString(), uuid[0]], (err, result) => {
			if (result) {
				console.log("存入数据库成功");
				success();
			}
			connection.release();
		});
	})
}

function onChunkedUpload(fields, file, res) {
	let size = parseInt(fields.qqtotalfilesize),
		uuid = fields.qquuid,
		index = fields.qqpartindex,
		totalParts = parseInt(fields.qqtotalparts),
		responseData = {
			success: false
		};
	console.log("这是大文件下载");

	file.name = fields.qqfilename;

	if (isValid(size)) {
		storeChunk(file, uuid, index, totalParts, function () {
				if (index < totalParts - 1) {
					responseData = {
						success: true,
						result: {
							name: file.name[0],
							uri: uploadUri + uuid[0].replace('_', '+') + '_' + file.name[0]
						},
						reset: null,
						error: null
					};
					res.send(responseData);
				}
				else {
					combineChunks(file, uuid, function () {
							uploadFileAndFtpServer(function () {
								responseData = {
									success: true,
									result: {
										name: file.name[0],
										uri: uploadUri + uuid[0].replace('_', '+') + '_' + file.name[0]
									},
									reset: null,
									error: null
								};
								deleteAll(uploadedFilesPath + uuid);
								res.send(responseData);
							}, file, uuid);
						},
						function () {
							responseData.error = "Problem conbining the chunks!";
							res.send(responseData);
						});
				}
			},
			function (reset) {
				responseData.error = "Problem storing the chunk!";
				res.send(responseData);
			});
	}
	else {
		failWithTooBigFile(responseData, res);
	}
}

function failWithTooBigFile(responseData, res) {
	responseData.error = "Too big!";
	responseData.preventRetry = true;
	res.send(responseData);
}

function onDeleteFile(req, res) {
	let uuid = req.params.uuid,
		dirToDelete = uploadedFilesPath + uuid;

	rimraf(dirToDelete, function (error) {
		if (error) {
			console.error("Problem deleting file! " + error);
			res.status(500);
		}

		res.send();
	});
}

function isValid(size) {
	return maxFileSize === 0 || size < maxFileSize;
}

function moveFile(destinationDir, sourceFile, destinationFile, success, failure) {
	mkdirp(destinationDir, function (error) {
		let sourceStream, destStream;

		if (error) {
			console.error("Problem creating directory " + destinationDir + ": " + error);
			failure();
		}
		else {
			sourceStream = fs.createReadStream(sourceFile);
			destStream = fs.createWriteStream(destinationFile);

			sourceStream
				.on("error", function (error) {
					console.error("Problem copying file: " + error.stack);
					destStream.end();
					failure();
				})
				.on("end", function () {
					destStream.end();
					success();
				})
				.pipe(destStream);
		}
	});
}

function moveUploadedFile(file, uuid, success, failure) {
	let destinationDir = uploadedFilesPath + uuid + "/",
		fileDestination = destinationDir + file.name;
	console.log("destinationDir=" + destinationDir);

	moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function storeChunk(file, uuid, index, numChunks, success, failure) {
	let destinationDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
		chunkFilename = getChunkFilename(index, numChunks),
		fileDestination = destinationDir + chunkFilename;

	moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function combineChunks(file, uuid, success, failure) {
	let chunksDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
		destinationDir = uploadedFilesPath + uuid + "/",
		fileDestination = destinationDir + file.name;

	console.log("chunkDir=", chunksDir);

	fs.readdir(chunksDir, function (err, fileNames) {
		let destFileStream;

		if (err) {
			console.error("Problem listing chunks! " + err);
			failure();
		}
		else {
			fileNames.sort();
			destFileStream = fs.createWriteStream(fileDestination, {flags: "a"});

			appendToStream(destFileStream, chunksDir, fileNames, 0, function () {
					rimraf(chunksDir, function (rimrafError) {
						if (rimrafError) {
							console.log("Problem deleting chunks dir! " + rimrafError);
						}
					});
					success();
				},
				failure);
		}
	});
}

function appendToStream(destStream, srcDir, srcFilesnames, index, success, failure) {
	if (index < srcFilesnames.length) {
		fs.createReadStream(srcDir + srcFilesnames[index])
			.on("end", function () {
				appendToStream(destStream, srcDir, srcFilesnames, index + 1, success, failure);
			})
			.on("error", function (error) {
				console.error("Problem appending chunk! " + error);
				destStream.end();
				failure();
			})
			.pipe(destStream, {end: false});
	}
	else {
		destStream.end();
		success();
	}
}

function getChunkFilename(index, count) {
	let digits = new String(count).length,
		zeros = new Array(digits + 1).join("0");

	return (zeros + index).slice(-digits);
}


// 递归删除文件夹及文件
function deleteAll(path) {
	console.log("删除临时文件及文件夹");
	let files = [];
	if (fs.existsSync(path)) {
		files = fs.readdirSync(path);
		files.forEach((file, index) => {
			let curPath = path + '/' + file;
			if (fs.statSync(curPath).isDirectory()) {
				deleteAll(curPath);
			} else {
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
}

module.exports = router;