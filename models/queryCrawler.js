var db_conn = require('./dbConn');
var pool = db_conn.pool;
var db_conn_lawdians = require('./dbConn_lawdians');
var pool_lawdians = db_conn_lawdians.pool;
// 크롤링데이터 DB upsert
exports.crawlingDataInsert = crawlingDataInsert;
function crawlingDataInsert(datas, tableNum, callback) {
    var isSuccess = false;
    var sql = ''
    for (var i = 0; i < datas.length; i++) {
        sql += 'INSERT INTO crawler_data' + tableNum + '(part,platform,location,hospital_name,event_title,linkUrl,imageUrl,price,fname,icon_image,icon_image_m,unique_key_column) ' +
            'VALUES ("' + datas[i].part + '",' + datas[i].type + ',"' + datas[i].location + '","' + datas[i].hospitalName + '","' + datas[i].title + '","' + datas[i].linkUrl + '","' + datas[i].imageUrl + '","' + datas[i].price + '","' + datas[i].fname + '","' + datas[i].icon_image + '","' + datas[i].icon_image_m + '","'+datas[i].unique_key_column+'") ' +
            'ON DUPLICATE KEY UPDATE reg_date = now(), platform = ' + datas[i].type + ',location = "' + datas[i].location + '", hospital_name = "' + datas[i].hospitalName + '",event_title ="' + datas[i].title + '",linkUrl="' + datas[i].linkUrl + '",price = "' + datas[i].price + '",fname ="' + datas[i].fname + '",icon_image ="' + datas[i].icon_image + '",icon_image_m = "' + datas[i].icon_image_m + '",unique_key_column = "'+datas[i].unique_key_column+'";';
    }
    pool.getConnection(function (err, conn) {
        if (err) console.error(err, 'err');
        conn.beginTransaction(function (err) {
            if (err) {
                throw err;
            } else {
                conn.query(sql, function (err, result) {
                    if (err) {
                        return conn.rollback(function () {
                            throw err;
                        });
                    } else {
                        conn.commit(function (err) {
                            if (err) {
                                return conn.rollback(function () {
                                    throw err;
                                });
                            } else {
                                conn.release();
                                isSuccess = true;
                                callback(isSuccess);
                            }
                        })
                    }
                })
            }
        })
    })
}

//로디언즈 안심병원 목록 가져오기
exports.getSafetyHospital = getSafetyHospital;
function getSafetyHospital(tableNum, callback) {
    var dbNamesql = '';
    if (tableNum == 1) {
        dbNamesql = 'crawler_data1';
    } else {
        dbNamesql = 'crawler_data2';
    }
    var contentsObj = { contents: '', isSuccess: false };
    var sql = "SELECT hospital_name FROM hospital where is_safety = 1";
    var safetyEventSql = 'select crawler_data_no from ' + dbNamesql + ' where 1=2 ';
    var updateSql = '';
    pool.getConnection(function(err,conn2){ //크롤러 DB
        if (err) console.error('err', err);
        pool_lawdians.getConnection(function (err, conn) {  //로디언즈 DB
            if (err) console.error('err', err);
            conn2.beginTransaction(function (err) {
                if (err) {
                    throw err;
                } else {
                    conn.query(sql, function (err, results) {         // 안심병원 목록 호출
                        if (err) {
                            console.error('err', err);
                            callback(contentsObj);
                            conn2.release();
                            conn.release();
                        } else {
                            if (results.length > 0) {
                                for (var i = 0; i < results.length; i++) {
                                    var processHospitalName = results[i].hospital_name.replace(/ /gi, "");
                                    if (processHospitalName.indexOf('성형외과') != -1) {
                                        safetyEventSql += " or hospital_name LIKE \'%" + processHospitalName.replace('성형외과', '') + "%\' ";
                                    } else {
                                        safetyEventSql += " or hospital_name = \'" + processHospitalName + "\' ";
                                    }
                                }
                                //console.log(safetyEventSql);        // 이벤트 내역중 안심병원 이벤트 찾기
                                conn2.query(safetyEventSql, function (err, results2) {   //안심병원이 진행하는 타 크롤링 이벤트 data_no
                                    //console.log(results2);
                                    if (err) {
                                        console.error('err', err);
                                        callback(contentsObj);
                                        conn2.release();
                                        conn.release();
                                    } else {
                                        if (results2.length > 0) {
                                            for (var j = 0; j < results2.length; j++) {
                                                updateSql += 'update ' + dbNamesql + ' set is_safety =1 where crawler_data_no = ' + results2[j].crawler_data_no + ' ;';
                                            }
                                            //console.log(updateSql);
                                            conn2.query(updateSql, function (err, result3) {    //해당 이벤트들을 안심병원 진행이벤트로 변경
                                                if (err) {
                                                    console.error(err, 'err');
                                                    conn2.rollback();
                                                    conn.release();
                                                } else {
                                                    //console.log(result3);
                                                    conn2.commit(function (err) {
                                                        if (err) {
                                                            return conn2.rollback(function () {
                                                                throw err;
                                                            });
                                                        } else {
                                                            contentsObj.isSuccess = true;
                                                            callback(contentsObj);
                                                            conn2.release();
                                                            conn.release();
                                                        }
                                                    })
                                                }
                                            });
                                        } else {
                                            callback(contentsObj);
                                            conn2.release();
                                            conn.release();
                                        }
    
                                    }
                                })
                            } else {
                                callback(contentsObj);
                                conn2.release();
                                conn.release();
                            }
    
                        }
                    });
                }
            })
        });
    })
}



//로디언즈 이벤트 DATA select
exports.lawdiansDataSelect = lawdiansDataSelect;
function lawdiansDataSelect(callback) {
    var contentsObj = { contents: '', isSuccess: false };
    console.log('로디언즈 db select에 들어옴');
    sql = "SELECT h.operation,b.hospital_name,a.hospital_event_no,a.hospital_event_cost, a.hospital_event_name, c.division_city_name, d.division_area_name,e.fname FROM hospital_event a LEFT JOIN hospital b ON b.hospital_no = a.hospital_no LEFT JOIN division_city c ON c.division_city_code_no = b.division_city_area_no LEFT JOIN division_area d ON d.division_area_code_no = b.division_district_area_no LEFT JOIN hospital_event_file e ON e.hospital_event_no = a.hospital_event_no LEFT JOIN hospital_file f ON f.hospital_no = b.hospital_no LEFT JOIN (SELECT hospital_account_id, hospital_no FROM hospital_account WHERE job_group_auth_manage_no = 3 LIMIT 1) g  ON g.hospital_no = b.hospital_no JOIN operation_code h ON a.op_part = h.operation_code WHERE a.is_exposure <> 0 AND e.status = 'list' AND a.approval_status = 1 AND a.start_exposure_period <= now() AND a.end_exposure_period >= now() GROUP BY a.hospital_event_no";
    pool_lawdians.getConnection(function (err, conn) {
        if (err) console.error('err', err);
        conn.query(sql, function (err, results) {
            if (err) {
                console.error('err', err);
                callback(contentsObj);
                conn.release();
            } else {
                contentsObj.contents = results;
                contentsObj.isSuccess = true;
                callback(contentsObj);
                conn.release();
            }
        });
    });
}

// 로디언즈 이벤트 DATA DB upsert
exports.lawdiansDataInsert = lawdiansDataInsert;
function lawdiansDataInsert(datas, tableNum, callback) {
    var isSuccess = false;
    var sql = ''
    for (var i = 0; i < datas.length; i++) {
        sql += 'INSERT INTO crawler_data' + tableNum + '(part,platform,location,hospital_name,event_title,linkUrl,imageUrl,price,hospital_event_no,icon_image,icon_image_m,fname,is_safety,unique_key_column) ' +
            'VALUES ("' + datas[i].part + '",' + datas[i].type + ',"' + datas[i].location + '","' + datas[i].hospitalName + '","' + datas[i].title + '","' + datas[i].linkUrl + '","' + datas[i].imageUrl + '",' + datas[i].price + ',' + datas[i].hospital_event_no + ',"' + datas[i].icon_image + '","' + datas[i].icon_image_m + '","' + datas[i].fname + '",'+1+',"'+datas[i].unique_key_column+'") '+
            'ON DUPLICATE KEY UPDATE reg_date = now(), platform = ' + datas[i].type + ',location = "' + datas[i].location + '", hospital_name = "' + datas[i].hospitalName + '",event_title ="' + datas[i].title + '",linkUrl="' + datas[i].linkUrl + '",price = "' + datas[i].price + '",fname ="' + datas[i].fname + '",icon_image ="' + datas[i].icon_image + '",icon_image_m = "' + datas[i].icon_image_m + '",unique_key_column = "'+datas[i].unique_key_column+'";';
    }
    pool.getConnection(function (err, conn) {
        if (err) console.error(err, 'err');
        conn.beginTransaction(function (err) {
            if (err) {
                throw err;
            } else {
                conn.query(sql, function (err, result) {
                    if (err) {
                        return conn.rollback(function () {
                            throw err;
                        });
                    } else {
                        conn.commit(function (err) {
                            if (err) {
                                return conn.rollback(function () {
                                    throw err;
                                });
                            } else {
                                conn.release();
                                isSuccess = true;
                                callback(isSuccess);
                            }
                        })
                    }
                })
            }
        })
    })
}

// crawler start DB truncate
exports.startTruncateTable = startTruncateTable;
function startTruncateTable(newTableNum, callback) {
    
    var isSuccess = false;
    var sql = 'truncate table crawler_data' + newTableNum
    pool.getConnection(function (err, conn) {
        if (err) console.error(err, 'err');
        conn.beginTransaction(function (err) {
            if (err) {
                throw err;
            } else {
                conn.query(sql, function (err, result) {
                    if (err) {
                        return conn.rollback(function () {
                            throw err;
                        });
                    } else {
                        console.log(result);
                        conn.commit(function (err) {
                            if (err) {
                                return conn.rollback(function () {
                                    throw err;
                                });
                            } else {
                                conn.release();
                                isSuccess = true;
                                callback(isSuccess);
                            }
                        })
                    }
                });
            }
        })
    })
}

// crawler DB truncate
exports.truncateTable = truncateTable;
function truncateTable(tableNum, callback) {
    var newTableNum;
    if (tableNum == 1) {
        newTableNum = 2;
    } else {
        newTableNum = 1;
    }
    var isSuccess = false;
    var sql = 'truncate table crawler_data' + tableNum
    var updateSql = 'update newTableNum set tableNum=' + newTableNum
    //console.log(sql);
    pool.getConnection(function (err, conn) {
        if (err) console.error(err, 'err');
        conn.beginTransaction(function (err) {
            if (err) {
                throw err;
            } else {
                conn.query(updateSql, function (err, result2) {
                    if (err) {
                        return conn.rollback(function () {
                            throw err;
                        });
                    } else {
                        conn.query(sql, function (err, result) {
                            if (err) {
                                return conn.rollback(function () {
                                    throw err;
                                });
                            } else {
                                console.log('crawler_data' + tableNum + ' 비우고 newTableNum' + newTableNum + '로 변경');
                                console.log(result);
                                console.log(result2);
                                conn.commit(function (err) {
                                    if (err) {
                                        return conn.rollback(function () {
                                            throw err;
                                        });
                                    } else {
                                        conn.release();
                                        isSuccess = true;
                                        callback(isSuccess);
                                    }
                                })
                            }
                        });
                    }
                })
            }
        })
    })
}

//현재 가리키고있는 테이블no 가져오기
exports.getCurrentTable = getCurrentTable;
function getCurrentTable(callback){
    var sql = 'select tableNum from newTableNum';
    var contentsObj = {isSuccess : false, result : ''};
    pool.getConnection(function(err,conn){
        if(err)console.error(err,'err');
        conn.query(sql,function(err,result){
            if (err) {
                console.error('err', err);
                callback(contentsObj);
                conn.release();
            } else {
                contentsObj.result = result[0];
                contentsObj.isSuccess = true;
                callback(contentsObj);
                conn.release();
            }
        });
    })
}

// 전체 병원이름 가져오기
exports.getHospitalName = getHospitalName;
function getHospitalName(newTableNum, callback) {
    var contentsObj = {isSuccess : false, contents : ''}
    var sql = 'select crawler_data_no,hospital_name,location from crawler_data2 where isNull(area) or city = "기타" group by hospital_name';
    pool.getConnection(function (err, conn) {
        if (err) console.error(err, 'err');
        conn.query(sql, function (err, rows) {
            if (err) {
                console.error(err, 'err');
            } else {
                conn.release();
                contentsObj.isSuccess = true;
                contentsObj.contents = rows;
                callback(contentsObj);
            }
        });
    })
}

// 구글 검색 결과 DB 업데이트
exports.reworkLocationData = reworkLocationData;
function reworkLocationData(contentsObj, callback) {
    var obj = {
        isSuccess : false,
        msg : ''
    }
    console.log(contentsObj);
    var updateSql = "";
    var selectSql = "select crawler_data_no from crawler_data2 where hospital_name LIKE '%"+contentsObj.hospital_name+"%'";
    pool.getConnection(function (err, conn) {
        if (err) console.error(err, 'err');
        conn.beginTransaction(function (err) {
            if (err) {
                throw err;
            } else {
                conn.query(selectSql,function(err,rows){
                    if (err) {
                        return conn.rollback(function () {
                            throw err;
                        });
                    } else {
                        if(rows.length>0){
                            for(var i = 0 ; i<rows.length;i++){
                                updateSql += "update crawler_data2 set city = '"+contentsObj.city+"', area = '"+contentsObj.area+"' where crawler_data_no = "+rows[i].crawler_data_no+"; ";
                            }
                            conn.query(updateSql, function (err, result) {
                                if (err) {
                                    return conn.rollback(function () {
                                        throw err;
                                    });
                                } else {
                                    //console.log(result);
                                    conn.commit(function (err) {
                                        if (err) {
                                            return conn.rollback(function () {
                                                throw err;
                                            });
                                        } else {
                                            conn.release();
                                            obj.isSuccess = true;
                                            obj.msg = 'update 완료';
                                            callback(obj);
                                        }
                                    })
                                }
                            })
                        }else{
                            obj.msg = 'contentsObj이 없어서 update 안함';
                            callback(obj);
                        }
                    }
                });
            }
        })
    })

    // if(contentsObjArr.length>0){
    //     contentsObjArr.forEach(function(item){
    //         updateSql += "update crawler_data2 set city = '"+item.city+"', area = '"+item.area+"' where crawler_data_no = "+item.crawler_data_no+"; ";
    //     })
    //     pool.getConnection(function (err, conn) {
    //         if (err) console.error(err, 'err');
    //         conn.beginTransaction(function (err) {
    //             if (err) {
    //                 throw err;
    //             } else {
    //                 console.log(updateSql);
    //                 conn.query(updateSql, function (err, result) {
    //                     if (err) {
    //                         return conn.rollback(function () {
    //                             throw err;
    //                         });
    //                     } else {
    //                         console.log(result);
    //                         conn.commit(function (err) {
    //                             if (err) {
    //                                 return conn.rollback(function () {
    //                                     throw err;
    //                                 });
    //                             } else {
    //                                 conn.release();
    //                                 obj.isSuccess = true;
    //                                 obj.msg = 'update 완료';
    //                                 callback(obj);
    //                             }
    //                         })
    
    //                     }
    //                 })
    //             }
    //         })
    //     })
    // }else{
    //     obj.msg = 'contentsObjArr이 없어서 update 안함';
    //     callback(obj);
    // }
}
