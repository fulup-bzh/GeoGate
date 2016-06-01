/* 
 * Copyright 2014 Fulup Ar Foll.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var mysql   = require('mysql'); // https://www.npmjs.org/package/mysql
var Debug   = require("../lib/_Debug");
var util    = require("util");
var EventEmitter  = require("events").EventEmitter;


var MYSQL_RECONNECT_TIMER=10*1000; // 10s timeout in bewteen two MYSQL reconnects


// ConnectDB is done on at creation time and asynchronously on PROTOCOL_CONNECTION_LOST
var CreateConnection =function (backend) {

    backend.Debug (4, "MySQL creating connection [%s]", backend.uid);
    backend.base = mysql.createConnection(backend.opts);
    backend.count ++;
      
    // register event for asynchronous server errors
    backend.base.on('error', function(err) {
        backend.Debug (1, "MySQL server error=[%s]", err);
        // Sever was restarted or network connection was lost let restart connection
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
             backend.Debug (4, "MySQL connection lost [%s/%d] automatic connect retry in 10s]", backend.uid, backend.count);
             setTimeout(function () {CreateConnection (backend);}, MYSQL_RECONNECT_TIMER);  
             
        } else { 
            throw err;  // server variable configures this)
        };
    });
    
    // force an initial connectiion at object construction time
    backend.base.connect (function(err) {
        if (err) {
             backend.Debug (4, "MySQL connection fail [%s/%d] automatic connect retry in 10s]", backend.uid, backend.count);
             setTimeout(function () {CreateConnection (backend);}, MYSQL_RECONNECT_TIMER);  
            
        } else {
            backend.Debug (5,"MySQL Connect Done [%s]",  backend.uid);
        }
    });
};

// Create MySQL Backend object
function BackendStorage (gateway, opts){
    
    // prepare ourself to make debug possible
    this.debug=opts.mysql.debug || opts.debug;
    this.gateway =gateway;
    this.count=0;  // stat for connection retry
    
    this.opts= {
            host     : opts.mysql.hostname || "localhost",
            user     : opts.mysql.username,
            password : opts.mysql.password,
            database : opts.mysql.basename || opts.username
    };  
    this.uid ="mysql:" + opts.mysql.username + "@" + opts.mysql.hostname + "/" + opts.mysql.basename;
    this.event = new EventEmitter();
    // create initial connection handler to database
    CreateConnection (this);
};

// Import debug method 
BackendStorage.prototype.Debug = Debug;

// Create table in case we start from scratch
// Warning: this create table but not database
BackendStorage.prototype.CheckTablesExits = function () {
    var gateway=this.gateway;

    var sqlQuery= {
         Devices: 'CREATE TABLE IF NOT EXISTS ALL_Devices ('
         + 'id INT NOT NULL AUTO_INCREMENT,'
         + 'devid CHAR(20) NOT NULL,'
         + 'devname CHAR(30) NOT NULL,'
         + 'callsign CHAR(20) NOT NULL,'
         + 'mmsi  CHAR(20) NOT NULL,'
         + 'length SMALLINT NOT NULL,'
         + 'width  SMALLINT NOT NULL,'
         + 'cargo  SMALLINT NOT NULL,'
         + 'model CHAR(20) NOT NULL,'
         + 'track CHAR(20) NOT NULL,'
         + 'alarm CHAR(20) NOT NULL,'
         + 'obd CHAR(20) NOT NULL,'
         + 'date   DATETIME,'
         + 'PRIMARY KEY (id ),'
         + 'UNIQUE INDEX (devid)'
         + ') DEFAULT CHARSET=utf8;'
    };
    
    
    // loop on table creation queries
    for (var table in sqlQuery) {
        this.base.query (sqlQuery[table] , function (err) {
            if (err) {
                gateway.debug (0,"MySQL ERROR","CreateTable", table, err);
                gateway.event.emit ("notice", "MySQL ERROR","CreateTable",table ,err);
            }
        });
    };
};

// Typically would create an entry inside device database table
BackendStorage.prototype.CreateDev = function (devid, data) {
    var self=this;
    this.Debug (3,"Add to MySql device:%s data=%j", devid, data);
    var gateway=this.gateway;

    // each device has 3 dedicated table Track, Alarm, Obg
     var sqlQuery= {
        track:  'CREATE TABLE IF NOT EXISTS T_' + devid + ' ('
        + 'msg     INT,'
        + 'id      INT NOT NULL AUTO_INCREMENT,'
        + 'lat     FLOAT,'
        + 'lon     FLOAT,'
        + 'alt     FLOAT,'
        + 'cog     FLOAT,'
        + 'sog     FLOAT,'
        + 'moved   INT,'
        + 'elapsed INT,'
        + 'acquired_at   BIGINT,'
        + 'valid   INT,'
        + 'gpsdate DATETIME,'
        + 'PRIMARY KEY (id )'
        + ') DEFAULT CHARSET=utf8;'


//       ,odb: 'CREATE TABLE IF NOT EXISTS O_' + devid + ' ('
//         + 'id     INT NOT NULL AUTO_INCREMENT,'
//         + 'trip   INT,'
//         + 'rfuel  INT,'
//         + 'afuel  FLOAT,'
//         + 'dtime  INT,'
//         + 'speed  INT,'
//         + 'pload  FLOAT,'
//         + 'temp   INT,'
//         + 'atp    FLOAT,'
//         + 'rpm    INT,'
//         + 'bat    FLOAT,'
//         + 'diag   INT,'
//         + 'gpsdate DATETIME,'
//         + 'acquired_at   BIGINT,'
//         + 'PRIMARY KEY (id )'
//         + ') DEFAULT CHARSET=utf8;'

    };

    // loop on table creation queries
    for (var table in sqlQuery) {
        this.base.query (sqlQuery[table] , function (err) {
            if (err) {
                self.Debug (0, "MySql Error Creating Table=%s Err=%s", table, err);
                gateway.event.emit ("notice", "MySQL ERROR","CreateTable",table ,err);
            }
        });
    };

    var queryString = "INSERT INTO ALL_Devices set ?";
    var post  = {
             devid : devid.toString()
            ,devname  : data.devname
            ,callsign : data.callsign
            ,model    : data.model
            ,mmsi     : data.mmsi
            ,cargo    : data.cargo
            ,length   : data.length
            ,width    : data.width
            ,track : 'T_' + devid
            ,obd   : 'O_' + devid
            ,alarm : 'A_' + devid
            ,date  : new Date()
    };
    
    // added ALTER TABLE devices ADD UNIQUE INDEX devid (uniqueId);
    sqlQuery = this.base.query(queryString, post);
 
    // on sucess this command is call once per selected row [hopefully only one in this case]
    sqlQuery.on("result", function(result) {
        gateway.event.emit ("notice", "ADD-DEVICE", "in MySQL", result);
    });
 
    sqlQuery.on("error", function(err) {
        self.Debug (0,'MySql Error creating device err=%s', err);
        gateway.event.emit ("notice", "ERROR-DEVICE", "insert MySQL", devid, err);
    });
};

// Typically would create an entry inside device database table
BackendStorage.prototype.RemoveDev = function (devid) {
    this.Debug (3,"Remove entry in DB for device:%s", devid);
    var gateway=this.gateway;

    // each device has 3 dedicated table Track, Alarm, Obg
    var sqlQuery= {
        track: 'DROP TABLE IF EXISTS T_' + devid + ';'
       ,odb:   'DROP TABLE IF EXISTS O_' + devid + ';'
    };

    // loop on table creation queries
    for (var table in sqlQuery) {
        this.base.query (sqlQuery[table] , function (err) {
            if (err) {
                self.debug (0, "MySql Error Dropping Table=%s Err=%s", table, err);
                gateway.event.emit ("notice", "MySQL ERROR","Drop Table",table ,err);
            }
        });
    };

    var queryString = "delete from ALL_Devices where devid =" + devid;
    sqlQuery = this.base.query(queryString);
 
    // on sucess this command is call once per selected row [hopefully only one in this case]
    sqlQuery.on("result", function(result) {
        gateway.event.emit ("notice", "DROP-DEVICE", "in MySQL", devid);
    });
 
    sqlQuery.on("error", function(err) {
        gateway.event.emit ("notice", "ERROR DEVICE", "from to remove MySQL", devid, err);
    });
};


// Query are done asynchronously and function will return before result is knowned
BackendStorage.prototype.LoginDev = function (device) {
    var self=this;
    this.Debug (6,"Login MySQL device:%s devid=%s", device.uid, device.devid);

    // selectQuery = 'SELECT * FROM devices where uniqueId = 359710043551135';
    var queryString = "SELECT * From ALL_Devices WHERE devid = " + device.devid;
    var sqlQuery = this.base.query(queryString);

    // on sucess this command is call once per selected row [hopefully only one in this case]
    sqlQuery.on("result", function (result) {
        self.Debug(9, "sqlResponse %j", result);

        // update active device pool [note device.devid is set by GpsdClient before SQL login]
        device.name    = result.devname; // friendly name extracted from database
        device.mmsi    = result.mmsi; 
        device.callsign= result.callsign; 
        device.cargo   = result.cargo; 
        device.length  = result.length/100; 
        device.width   = result.width/100; 
        device.model   = result.model; 
        device.sqlid   = result.id;   // this is MySQL unique ID and not device's DEVID
        device.track   = result.track;
        device.obd     = result.obd;
        device.logged  = true;        // marked device as knowned from database
        
        self.event.emit ("dev-auth", device);
    });

    sqlQuery.on("error", function (err) {
        self.Debug(0, "MySql ERROR Login devid=%d err=%s", device.devid, err);
    });
    
};

// Query are done asynchronously and function will return before result is known
BackendStorage.prototype.LogoutDev = function (device) {
    this.Debug(4, "Logout Device:%s", device.uid);

    // change device status to logout
    device.logged = false;
    this.event.emit("dev-quit", device);
};

BackendStorage.prototype.TempryLoggin = function (device) {
    this.Debug(6, "TempryLogin Device:%s", device.uid);
    this.event.emit("dev-tmp", device);
};


BackendStorage.prototype.IgnorePosDev = function (device) {
    this.Debug(6, "IgnorePosDev Device:%s", device.uid);
    this.event.emit("dev-ign", device);
};

// Query are done asynchronously and function will return before result is knowned
BackendStorage.prototype.UpdatePosDev = function (device) {
    var self=this;
    this.Debug (6,"Updating Track MySQL devid=%s", device.devid);

    // INSERT INTO positions (device_id, time, valid, latitude, longitude, altitude, speed, course, power)
    var queryString = "INSERT INTO " + device.track + " set ?";

    // launch insertion of new position asynchronously
    var insertQuery = this.base.query(queryString, device.stamp);

    insertQuery.on("error", function(err) {
        self.Debug (0,"MySql ERROR UpdatePosDev %s err=%s", queryString, err);
    });
    
    this.event.emit ("dev-pos", device);
};

BackendStorage.prototype.UpdateObdDev = function (device) {
    var self=this;
    this.Debug (6,"Updating OBD MySQL devid=%s", device.devid);

    // INSERT INTO positions (device_id, time, valid, latitude, longitude, altitude, speed, course, power)
    var queryString = "INSERT INTO " + device.obd + " set ?";

    // launch insertion of new position asynchronously
    var insertQuery = this.base.query(queryString, device.stamp);

    insertQuery.on("error", function(err) {
        self.Debug (0,"MySql ERROR UpdateOdbDev %s err=%s", queryString, err);
    });
};

BackendStorage.prototype.UpdateAlarmDev = function (device) {
    var self=this;
    this.Debug (6,"Updating Alarm MySQL devid=%s", device.devid);

    // INSERT INTO positions (device_id, time, valid, latitude, longitude, altitude, speed, course, power)
    var queryString = "INSERT INTO " + device.track + " set ?";

    // launch insertion of new position asynchronously
    var insertQuery = this.base.query(queryString, device.stamp);

    insertQuery.on("error", function(err) {
        self.Debug (0,"MySql ERROR LookupDev %s err=%s", queryString, err);
    });
    
    this.event.emit ("dev-alrm", device);
};

// Write last X positions on Telnet/Console
BackendStorage.prototype.LookupDev = function (callback, devid, args) {
    var self=this;
    var device= this.gateway.activeClients [devid]; // device.sqlid was updated at authentication

    var sqlQuery= "Select  lat,lon,sog,cog,alt,acquired_at from T_" +  devid
        + " ORDER BY DATE DESC LIMIT " + args;
    this.Debug (4, "sqlQuery=%s", sqlQuery);

    this.base.query (sqlQuery , function (err, dbresult) {
        if (err) {
            self.Debug (0,"MySql LookupDev devid=%d Err=%s",devid, err);
        } else {
            callback(dbresult);
        }
    });
};

// export the class
module.exports = BackendStorage; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
