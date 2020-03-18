var express = require('express');
var router = express.Router();

//var http = require('https');


router.get('/', function (req, res, next) {
  res.render('index', { title: '크롤링완료' });
});


module.exports = router;
