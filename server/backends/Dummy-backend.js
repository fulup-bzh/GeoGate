/* 
 * Copyright 2014 Fulup Ar Foll
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


/* 
 * This backend ignore any data it received. It is only design to support
 * the online demo for devices & adapters test. It does not store anything
 * on disk and have no value for real applications.
 * 
 * It:
 * 1) keeps in RAM the 20 last possitions of any devices for demo apps.
 * 2) provides event on devices: auth,update and qui.
 * 4) to a fake device authentication base on static FakeVesselBase table.
 * 
 */

var net           = require('net');
var EventEmitter  = require("events").EventEmitter;

var Debug    = require("../lib/_Debug");

// few static variables [hugly but simple]
var  TcpJsonSv;
var  TcpAisSv;
var  QJhandle; 
var  CLsockid;

// This is our fake device authentication DB table

function BackendStorage (gateway, opts){
    
    // prepare ourself to make debug possible
    this.uid="Dummy@nothing";
    this.gateway =gateway;
    this.debug=opts.debug;
    this.count=0;
    
    this.storesize= 20 +1;  // number of position slot/devices
    this.event = new EventEmitter();
};

// import debug method 
BackendStorage.prototype.Debug = Debug;

BackendStorage.prototype.Connect = function (gpsd) {
    this.Debug (3,"Connect device:%s", device.uid);
};

// Typically would create an entry inside device database table
BackendStorage.prototype.CreateDev = function (devid, args) {
    this.Debug (3,"Create entry in DB for device:%s", device.uid);
};
// Typically would drop an entry inside device database table
BackendStorage.prototype.RemoveDev = function (devid, args) {
    this.Debug (3,"Drop entry in DB for device:%s", device.uid);
};

BackendStorage.prototype.UpdateObdDev = function (device, data) {
    this.Debug (3,"UpdateODB for device:%s data=%j", device.uid, data);

};

BackendStorage.prototype.UpdateAlarmDev = function (device, data) {
    this.Debug (3,"UpdateAlarm for device:%s data=%j", device.uid, data);

};

// Write last X positions on Telnet/Console
BackendStorage.prototype.LookupDev = function (callback, devid, args) {
    var device= this.gateway.activeClients [devid];
    if (device === undefined) {
        callback (null);
        return (-1);
    }
    this.Debug (3,"Track entry in DB for device:%s", device.uid);
    var result=[];
    
    // start from last [most recent position]
    var pos=device.posIdx;
    // loop on fifo position storage
    for (var idx = 0; (idx < args && idx < this.storesize); idx ++) {
        // no [more] positions exit before end
        if  (device.posSto[pos] === undefined) break;
        // push position from new to old [fifo order]
        result.push (device.posSto[pos]);
        // if bottom of array restart from top
        pos --;  if (pos < 0) {pos = this.storesize -1;};
    }
    // let callback application with result
    callback (result);
};

BackendStorage.prototype.TempryLoggin = function (device) {
    this.Debug(5, "TempryLogin Device:%s", device.uid);
    this.event.emit("dev-tmp", device);
};

BackendStorage.prototype.LoginDev = function (device) {
    this.Debug (3,"Authentication accepted for device=%s name=%s", device.uid, device.name);
    device.logged   = true;

    // Create Ram storage array for tracking this.storesize positions
    if (device.posIdx === undefined) {
        device.posIdx = this.storesize-1;
        device.posSto = [];
    }

    this.event.emit ("dev-auth", device);
    this.count++;
};


BackendStorage.prototype.LogoutDev = function (device) {
    this.Debug(4, "Logout Device:%s", device.uid);

    // change device status to logout
    this.event.emit("dev-quit", device);
    device.logged = false;
};

BackendStorage.prototype.UpdateObdDev = function (device) {
    this.Debug(4, "Obd Device:%s", device.uid);
};

BackendStorage.prototype.IgnorePosDev = function (device) {
    this.Debug(5, "IgnorePos Device:%s", device.uid);
    this.event.emit("dev-ign", device);
};

BackendStorage.prototype.UpdatePosDev = function (device) {
    this.Debug (4,"UpdateDev device:%s", device.uid);
    if (device.stamp.lat === 0 && device.stamp.lon === 0) return (-1);

    // move to next avaliable position slot
    device.posIdx  = (device.posIdx + 1) % this.storesize;
    device.posSto [device.posIdx]=device.stamp; // stamp is already a position object
    // mark future position as empty [end if storage]
    device.posSto [(device.posIdx + 1) % this.storesize] = undefined;

    this.event.emit ("dev-pos", device);
};


// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    opts = {debug:9};
    console.log ("### Routine Test Backend finished");
    bck=new BackendStorage(null, opts);
 }
 
// export the class
module.exports = BackendStorage; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

