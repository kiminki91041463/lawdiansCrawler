var mysql = require('mysql');
var mysqlConfig = {
    connectionLimit : 5000,
    host : '192.168.0.88',  // 도커로 옮긴후엔 바꿀 것
    user : 'test',
    password : 'lawdiansserver1004@',
    database: 'lawdians_test',
    port: 3306,
    multipleStatements: true,
    supportBigNumbers:true,
    bigNumberStrings:true,
    dateStrings: 'date'
};

var pool = mysql.createPool(mysqlConfig);
//var conn = mysql.createConnection(mysqlConfig);



exports.pool = pool;
//exports.conn = conn;
