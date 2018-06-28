var createError = require('http-errors');
var express = require('express');
// 用于解析接收到的数据
var bodyParser = require("body-parser");
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// 导入mysql模块
var mysql = require('mysql');
var dbConfig = require('./db/DBConfig');
var ftpSql = require('./db/ftpSql');
// 使用DBConfig.js的配置信息创建一个MYSQL连接池
var pool = mysql.createPool(dbConfig.mysql);

var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');
var fineUploaderRouter = require('./public/javascripts/nodejs')

var app = express();

// 解决跨域问题
app.all('*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With, Cache-Control, x-user-token");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By", ' 3.2.1')
	res.header("Content-Type", "application/json;charset=utf-8");
	next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({extended: false}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// express.static中间件可以用于托管静态文件的访问,
// 如果静态文件存放在多个目录，则使用多个express.static中间件,
// 访问静态资源时，express.static中间件会根据目录添加的顺序查找所需的文件
app.use(express.static(path.join(__dirname, 'public')));

// app.use('/', indexRouter);
app.use('/', fineUploaderRouter);
// app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
