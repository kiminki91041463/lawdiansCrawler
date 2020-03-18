var mysql = require('mysql');
var mysqlConfig = {
    connectionLimit : 5000,
    host : '192.168.0.91',
    user : 'root',
    password : '1004',
    database: 'crawler',
    port: 3306,
    multipleStatements: true,
    supportBigNumbers:true,
    bigNumberStrings:true,
    dateStrings: 'date',
};

var pool = mysql.createPool(mysqlConfig);
//var conn = mysql.createConnection(mysqlConfig);



exports.pool = pool;
//exports.conn = conn;
