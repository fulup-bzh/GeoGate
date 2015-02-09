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
 *
 * This is custom version of MySql backend dedicated to http://geotobe.net
 * It is provided as an example, but will probably not fit your needs.
 * For development use standard MySqlDB,MongoDb,Dummy-Backend.
 */

'use strict';

var mysql   = require('mysql'); // https://www.npmjs.org/package/mysql
var Debug   = require("../lib/_Debug");
var util    = require("util");
var crypto  = require('crypto');


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
    this.debug   =opts.mysql.debug || opts.debug;
    this.gateway =gateway;
    this.count=0;  // stat for connection retry

    this.opts= {
            host     : opts.mysql.hostname || "localhost",
            user     : opts.mysql.username,
            password : opts.mysql.password,
            database : opts.mysql.basename || opts.username
    };  
    this.uid ="mysql:" + opts.mysql.username + "@" + opts.mysql.hostname + "/" + opts.mysql.basename;
    
    // create initial connection handler to database
    CreateConnection (this);  
};

// Import debug method 
BackendStorage.prototype.Debug = Debug;

// Create MySQL Backend object
BackendStorage.prototype.CheckTablesExits = function () {
    this.Debug (0,"Hoops this backend does not support CheckTablesExits");
}


// Typically would create an entry inside device database table
BackendStorage.prototype.CreateDev = function (devid, data) {
    var self=this;
    this.Debug (3,"Add to MySql device:%s data=%j", devid, data);
    var gateway=this.gateway;

    var queryString = "INSERT INTO usr_trackers set ?";
    var post  = {
             imeinum    : devid.toString()
            ,nickname   : data.devname
            ,phonenum   : data.callsign
            ,token      : crypto.createHash('sha1').update (new Date().toString()).digest("hex")
            ,created_at : new Date()
            ,updated_at : new Date()
    };
    
    // added ALTER TABLE devices ADD UNIQUE INDEX devid (uniqueId);
    var sqlQuery = this.base.query(queryString, post);
 
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

    var queryString = "delete from usr_trackers where imeinum =" + devid;
    var sqlQuery = this.base.query(queryString);
 
    // on sucess this command is call once per selected row [hopefully only one in this case]
    sqlQuery.on("result", function(result) {
        gateway.event.emit ("notice", "DROP-DEVICE", "in MySQL", devid);
    });
 
    sqlQuery.on("error", function() {
        gateway.event.emit ("notice", "ERROR DEVICE", "from to remove MySQL", devid, err);
    });
};


// Query are done asynchronously and function will return before result is knowned
BackendStorage.prototype.LoginDev = function (device) {
    var self=this;
    this.Debug (6,"Login MySQL device:%s devid=%s", device.uid, device.devid);

    // selectQuery = 'SELECT * FROM devices where uniqueId = 359710043551135';
    var queryString = "SELECT * From usr_trackers WHERE imeinum = " + device.devid;
    var sqlQuery = this.base.query(queryString);

    // on sucess this command is call once per selected row [hopefully only one in this case]
    sqlQuery.on("result", function (result) {
        self.Debug(9, "sqlQuery %j", result);

        // update active device pool [note device.devid is set by GpsdClient before SQL login]
        device.name  = result.nickname; // friendly name extracted from database
        device.sqlid = result.id;       // this is MySQL unique ID and not device's DEVID
        device.token = result.token;    // access token for REST API
        device.logged = true;           // marked device as knowned from database
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
};


// Query are done asynchronously and function will return before result is knowned
BackendStorage.prototype.UpdatePosDev = function (device, data) {
    var self=this;
    this.Debug (6,"Updating Track MySQL devid=%s", device.devid);

    // INSERT INTO positions (device_id, time, valid, latitude, longitude, altitude, speed, course, power)
    var queryString = "INSERT INTO geo_tracks" + " set ?";

    // add tracker foreign key id
    data['tracker_id'] = device.sqlid;

    // launch insertion of new position asynchronously
    var insertQuery = this.base.query(queryString, data);

    insertQuery.on("error", function(err) {
        self.Debug (0,"MySql ERROR UpdatePosDev %s err=%s", queryString, err);
    });
};

BackendStorage.prototype.UpdateObdDev = function (device, data) {
    var self=this;
    this.Debug (6,"Updating OBD MySQL devid=%s", device.devid);

    // INSERT INTO positions (device_id, time, valid, latitude, longitude, altitude, speed, course, power)
    var queryString = "INSERT INTO geo_obds" + " set ?";

    // add tracker foreign key id
    data['tracker_id'] = device.sqlid;

    // launch insertion of new position asynchronously
    var insertQuery = this.base.query(queryString, data);

    insertQuery.on("error", function(err) {
        self.Debug (0,"MySql ERROR UpdateOdbDev %s err=%s", queryString, err);
    });
};

BackendStorage.prototype.UpdateAlarmDev = function (device, data) {
    var self=this;
    this.Debug (6,"Updating Alarm MySQL devid=%s", device.devid);

    // INSERT INTO positions (device_id, time, valid, latitude, longitude, altitude, speed, course, power)
    var queryString = "INSERT INTO geo_alarms" + " set ?";

    console.log (data)

    // add tracker foreign key id
    data['tracker_id'] = device.sqlid;

    // launch insertion of new position asynchronously
    var insertQuery = this.base.query(queryString, data);

    insertQuery.on("error", function(err) {
        self.Debug (0,"MySql ERROR LookupDev %s err=%s", queryString, err);
    });
};

// Write last X positions on Telnet/Console for active devices only !!!
BackendStorage.prototype.LookupDev = function (callback, devid, args) {
    var self=this;
    var device= this.gateway.activeClients [devid]; // device.sqlid was updated at authentication

    var sqlQuery= "Select  lat,lon,sog,cog,alt,acquired_at from geo_tracks where tracker_id=" +  device.sqlid
        + " ORDER BY acquired_at DESC LIMIT " + args;
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
