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

var MongoClient = require('mongodb').MongoClient; https://github.com/mongodb/node-mongodb-native
var util        = require("util");
var Debug       = require("../lib/_Debug");

MONGO_RECONNECT_TIMER=10*1000; // 10s timeout in between two MONGO reconnects


// ConnectDB is done on at creation time
function CreateConnection (backend) {

    backend.Debug (4, "MongoDB creating connection [%s]", backend.uid);
    MongoClient.connect(backend.uid, function (err, db) {
        if (err) {
            backend.Debug (0, "Fail to connect to MongoDB: %s err=[%s]", backend.uid, err)
        } else {
            backend.Debug (4, "Connected to MongoDB: %s", backend.uid)
            backend.base = db;
        }
    });
}

// Create MongoDB Backend object
function BackendStorage (gateway, opts){
    
    // prepare ourself to make debug possible
    this.debug  =opts.debug;
    this.gateway=gateway;

    this.opts=
       { hostname : opts.mongodb.hostname || "localhost"
       , username : opts.mongodb.username
       , password : opts.mongodb.password
       , basename : opts.mongodb.basename || opts.mongo.username
       , port     : opts.mongodb.port     || 27017
    };
    this.uid ="mongodb://" + this.opts.username + ':' + this.opts.password + "@" + this.opts.hostname +':'+ this.opts.port  + "/" + this.opts.basename;
    
    // create initial connection handler to database
    CreateConnection (this);  
}

// Import debug method 
BackendStorage.prototype.Debug = Debug;

// Mongo is schema less and does not requiere to pre-create collections
BackendStorage.prototype.CheckTablesExits = function () {
    var self = this;
    self.Debug (3,"Check and Create collections if needed");

    function ResponseCB (err, collection) {
        self.Debug (1,"*** ResponseCB err=%j collection=%j", err, collection);
    }
    this.base.collection('ALL_Devices', {w:1}).createIndex({devid:1}, {unique: true, w:1}, ResponseCB);
};

// Typically would create an entry inside device database table
BackendStorage.prototype.CreateDev = function (devid, data) {
    this.Debug (3,"Create entry in DB for device:%s data=%j", devid, data);
    var self=this;
    var gateway=this.gateway;

    function DeviceCB (err, doc) {
        self.Debug (6, 'Device Insert devid=%s doc=%j err=%j', devid, doc, err);
        if (err !== null) {
            gateway.event.emit ("notice", "ERROR-CREATDEVICE", "MongoDB", devid, err);
        }
    };

    this.base.collection('T_' + devid,{w:1}).createIndex({date:1}, {w:1}, DeviceCB);
    this.base.collection('A_' + devid,{w:1}).createIndex({date:1}, {w:1}, DeviceCB);
    this.base.collection('O_' + devid,{w:1}).createIndex({date:1}, {w:1}, DeviceCB);

    var article  = {
         devid : devid.toString()
        ,devname  : data.devname
        ,callsign : data.callsign
        ,model    : data.model
        ,collection: { track: 'T_' + devid, alarm: 'A_' + devid, obd: 'O_' + devid }
    };

    this.base.collection("ALL_Devices").insert (article, {w:1}, DeviceCB);
};

// Typically would create an entry inside device database table
BackendStorage.prototype.RemoveDev = function (devid) {
    this.Debug (3,"Device Remove devid:%s", devid);
    var gateway=this.gateway;
    var self=this;

    function ResponseCB (err, doc) {
        self.Debug (6, 'Removing device doc=%j err=%j', doc, err);
        if (err !== null) {
            gateway.event.emit ("notice", "ERROR-REMOVEDEV", "remove MongoDB", devid, err);
        }
    }
    this.base.collection("ALL_Devices").remove({devid:devid}, ResponseCB);
    this.base.collection("T"+devid).drop(ResponseCB);
    this.base.collection("A"+devid).drop(ResponseCB);
    this.base.collection("O"+devid).drop(ResponseCB);
};

// Query are done asynchronously and function will return before result is knowned
BackendStorage.prototype.LoginDev = function (device) {
    var self= this;
    self.Debug (6,"Authenticate device:%s devid=%s", device.uid, device.devid);

    function ResponseCB (err, responses) {

        if (err) {
            self.Debug (0, "MongoDB Find Err=%s", err);
            return;
        }
        if (responses.length === 0) {
            self.Debug(1, "Device %s not authenticated", device.devid);
        } else {
            var response = responses[0];

            self.Debug(4, "Device %s authenticated Response=%j", device.devid, response);
            device.name      = response.name; // friendly name extracted from database
            device.logged     = true;         // marked tracker as known from database
            device.mogodevid = response._id;  // this is MongoDB unique ID and not tracker's DEVID
            device.mogotrack = self.base.collection(response.collection.track);
            device.mogoobd   = self.base.collection(response.collection.obd);
            device.mogoalarm = self.base.collection(response.collection.alarm);
        }
    };

    // connection to mongo is asynchronous we may reach a login before database is open
    if (this.base !== undefined)
    this.base.collection("ALL_Devices").find({devid: device.devid.toString()}).limit(1).toArray(ResponseCB);
};

// Query are done asynchronously and function will return before result is known
BackendStorage.prototype.LogoutDev = function (device) {
    this.Debug(4, "Logout Device:%s", device.uid);

    // change device status to logout
    device.logged = false;
};

BackendStorage.prototype.TempryLoggin = function (device) {
    this.Debug(6, "TempryLogin Device:%s", device.uid);
    this.event.emit("dev-tmp", device);
};

BackendStorage.prototype.IgnorePosDev = function (device) {
    this.Debug(6, "IgnoreDev Device:%s", device.uid);
    this.event.emit("dev-ign", device);
};

// Query are done asynchronously and function will return before result is known
BackendStorage.prototype.UpdatePosDev = function (device) {
    var self= this;

    this.Debug (6,"Update Position device:%s devid=%s", device.uid, device.devid);

    function ResponseCB (err, response) {
        if (err !== null) {
            self.Debug(0, 'Hoops MongoDB device=%s error=%j', device.devid, err);
            return;
        }
        status = JSON.parse (response);
        if (!status.ok) {
            self.Debug(1, 'ERROR-TRACK insert devid=%s failed err=%j response=%j', device.devid, err, status);
        } else {
            self.Debug(6, "UPDATE-TRACK insert devid=%s MongoDB response=%j", device.devid, response);
        }
    }    
    // launch insertion of new position asynchronously
    device.mogotrack.insert (device.stamp, {w:1}, ResponseCB);
};

// Query are done asynchronously and function will return before result is known
BackendStorage.prototype.UpdateObdDev = function (device) {
    var self= this;

    this.Debug (6,"Update OBD device:%s devid=%s", device.uid, device.devid);

    function ResponseCB (err, response) {
        if (err != null) {
            self.Debug(0, 'Hoops MongoDB device=%s error=%j', device.devid, err);
            return;
        }
        status = JSON.parse (response);
        if (!status.ok) {
            self.Debug(1, 'ERROR-UPDATE insert devid=%s failed err=%j response=%j', device.devid, err, status);
        } else {
            self.Debug(6, "UPDATE-OK insert devid=%s MongoDB response=%j", device.devid, response);
        }
    }
    // launch insertion of new position asynchronously
    device.mogoobd.insert (device.stamp, {w:1}, ResponseCB);
};
// Query are done asynchronously and function will return before result is known
BackendStorage.prototype.UpdateAlarmDev = function (device) {
    var self= this;

    this.Debug (6,"Update OBD device:%s devid=%s", device.uid, device.devid);

    function ResponseCB (err, response) {
        if (err != null) {
            self.Debug(0, 'Hoops MongoDB device=%s error=%j', device.devid, err);
            return;
        }
        status = JSON.parse (response);
        if (!status.ok) {
            self.Debug(1, 'ERROR-UPDATE insert devid=%s failed err=%j response=%j', device.devid, err, status);
        } else {
            self.Debug(6, "UPDATE-OK insert devid=%s MongoDB response=%j", device.devid, response);
        }
    }
    // launch insertion of new position asynchronously
    device.mogoalarm.insert (device.stamp, {w:1}, ResponseCB);
};

// Write last X positions on Telnet/Console
BackendStorage.prototype.LookupDev = function (callback, devid, limit) {
    var self=this;

    function ResponseCB (err, responses) {
        self.Debug(6, 'LookupDev device doc=%j err=%j', responses, err);
        if (err) {
            self.Debug(0, "MongoDB Find Err=%s", err);
            return;
        }

        if (responses.length === 0) {
            self.Debug(1, "Device %s no positions avaliable", devid);
        } else {
            // send back DB position to application callback
            callback(responses);
        }
    }
    this.base.collection('T_'+ devid).find({}).limit(limit).sort({$natural: -1}).toArray(ResponseCB);
};

// export the class
module.exports = BackendStorage; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/