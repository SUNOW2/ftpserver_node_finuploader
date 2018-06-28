/**
 * Created by 徐旭 on 2018/6/25
 */
// express框架
let express = require('express');
let router = express.Router();

// 数据库配置
let mysql = require('mysql');
let dbConfig = require('../../db/DBConfig');
let ftpSql = require('../../db/ftpSql');
let pool = mysql.createPool(dbConfig.mysql);
let
	// express = require("express"),
	fs = require("fs"),
	rimraf = require("rimraf"),
	mkdirp = require("mkdirp"),
	multiparty = require('multiparty'),
	// app = express(),

	// paths/constants
	fileInputName = process.env.FILE_INPUT_NAME || "qqfile",
	// publicDir = process.env.PUBLIC_DIR,
	// nodeModulesDir = process.env.NODE_MODULES_DIR,
	// uploadedFilesPath = process.env.UPLOADED_FILES_DIR,
	chunkDirName = "chunks",
	// port = process.env.SERVER_PORT || 3001,
	maxFileSize = process.env.MAX_FILE_SIZE || 0; // in bytes, 0 for unlimited

let Client = require('ftp');

let publicDir = "/home/yiliao/public/";
let uploadedFilesPath = "/home/yiliao/upload/";
let nodeModulesDir = "/home/yiliao/public/nodeModule/";
let uploadUri = "http://223.2.197.241:80/";

// app.listen(port);

// routes
// app.all('*', function (req, res, next) {
// 	res.header("Access-Control-Allow-Origin", "*");
// 	res.header("Access-Control-Allow-Headers", "X-Requested-With, Cache-Control, x-user-token");
// 	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
// 	res.header("X-Powered-By", ' 3.2.1')
// 	res.header("Content-Type", "application/json;charset=utf-8");
// 	next();
// });
// app.use(express.static(publicDir));
// app.use("/node_modules", express.static(nodeModulesDir));
// app.post("/uploads", onUpload);
// app.delete("/uploads/:uuid", onDeleteFile);

router.post("/uploads", onUpload)


function onUpload(req, res) {
	let form = new multiparty.Form();
	console.log("测试nodeJs上传文件");

	form.parse(req, function (err, fields, files) {
		var partIndex = fields.qqpartindex;

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
	var uuid = fields.qquuid,
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
							uri: uploadUri + file.name[0]
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
		client.put(uploadedFilesPath + uuid + "/" + file.name[0], file.name[0], (err) => {
			console.log("file.name[0]=", file.name[0]);
			if (err) {
				throw err;
			}
			console.log('上传文件成功!');
			client.end();
			uploadEnd(uploadUri + file.name[0], success);
		});
	});
}

function uploadEnd(filePath, success) {
	pool.getConnection((err, connection) => {
		console.log("存入数据库");
		//	获取前端传递的数据
		connection.query(ftpSql.insert, [filePath, new Date().toLocaleString()], (err, result) => {
			console.log("date=", (new Date()).toLocaleString())
			if (result) {
				console.log("存入数据库成功");
				success();
			}
			connection.release();
		});
	})
}

function onChunkedUpload(fields, file, res) {
	var size = parseInt(fields.qqtotalfilesize),
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
					console.log("index=", index);
					console.log("totalParts=", totalParts);
						responseData = {
							success: true,
							result: {
								name: file.name[0],
								uri: uploadUri + file.name[0]
							},
							reset: null,
							error: null
						};
						res.send(responseData);
				}
				else {
					combineChunks(file, uuid, function () {
						console.log("combineCunks uuid=", uuid);
							uploadFileAndFtpServer(function () {
								responseData = {
									success: true,
									result: {
										name: file.name[0],
										uri: uploadUri + file.name[0]
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
	var uuid = req.params.uuid,
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
		var sourceStream, destStream;

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
	var destinationDir = uploadedFilesPath + uuid + "/",
		fileDestination = destinationDir + file.name;
	console.log("destinationDir=" + destinationDir);

	moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function storeChunk(file, uuid, index, numChunks, success, failure) {
	var destinationDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
		chunkFilename = getChunkFilename(index, numChunks),
		fileDestination = destinationDir + chunkFilename;

	moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function combineChunks(file, uuid, success, failure) {
	var chunksDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
		destinationDir = uploadedFilesPath + uuid + "/",
		fileDestination = destinationDir + file.name;

	console.log("chunkDir=", chunksDir);

	fs.readdir(chunksDir, function (err, fileNames) {
		var destFileStream;

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
	var digits = new String(count).length,
		zeros = new Array(digits + 1).join("0");

	return (zeros + index).slice(-digits);
}


// 递归删除文件夹及文件
function deleteAll(path) {
	console.log("path=", path);
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