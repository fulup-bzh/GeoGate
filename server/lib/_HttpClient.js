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
 * This modele is used for HTTP like divices that do not rely on TCP session
 * typical for phone application as CellTrackGTS and others.
 */

'use strict';

var Debug   = require("./_Debug");
var TrackerCmd= require("../lib/_TrackerCmd");


// small object to keep track of last position in ram
function PositionObj (data) {
    this.msg    = parseInt (data.cmd);
    this.lat    = parseFloat(data.lat);
    this.lon    = parseFloat(data.lon);
    this.sog    = parseFloat(data.sog)   || 0;
    this.cog    = parseFloat(data.cog)   || 0;
    this.alt    = parseFloat(data.alt)   || 0;
    this.moved  = parseInt(data.moved)   || -1;
    this.elapsed= parseInt(data.elapsed) || -1;
    this.valid  = parseInt(+data.valid);
    this.acquired_at  = data.acquired_at;
    this.gpsdate= data.date;
}

// called from http class of adapter
function GpsdHttpClient (adapter, devid) {
 	
    this.debug =  adapter.debug; // inherit debug level
    this.uid  = "httpclient//" + adapter.info + ":" + devid;
        
    this.adapter       = adapter;
    this.gateway       = adapter.gateway;
    this.controller    = adapter.controller;
    this.socket        = null;     // we cannot rely on socket to talk to device
    this.devid         = false;    // we get uid directly from device
    this.name          = false;
    this.logged        = false;
    this.alarm         = 0;        // count alarm messages
    this.count         = 0;        // generic counter used by file backend
    this.errorcount    = 0;        // number of ignore messages
    
    this.uid = "httpclient://" + this.adapter.info + ":" + this.adapter.id;

};

// Import debug method 
GpsdHttpClient.prototype.Debug = Debug;

// This method is fast but very approximative for close points
// User may expect 50% of error for distance of few 100m
// nevertheless this is more than enough to optimize storage.
GpsdHttpClient.prototype.Distance = function (old, now) {
    var R = 6371; // Radius of the earth in km
    var dLat = (now.lat - old.lat) * Math.PI / 180;  // deg2rad below
    var dLon = (now.lon - old.lon) * Math.PI / 180;
    var a = 
      0.5 - Math.cos(dLat)/2 + 
      Math.cos(old.lat * Math.PI / 180) * Math.cos(now.lat * Math.PI / 180) * 
      (1 - Math.cos(dLon))/2;
    var d= R * 2 * Math.asin(Math.sqrt(a));
    d= Math.round (d*1000);
    this.Debug (7, "Distance devid:%s [%s] moved %dm", this.devid, this.name, d);
    return (d); // return distance in meters
};

GpsdHttpClient.prototype.DummyName = function (devid) {
    var devname = devid.toString();
    return devname.substring(devname.length-8);
};


GpsdHttpClient.prototype.LoginDev = function(data) {
    // make code simpler to read
    var adapter   = this.adapter;
    var controller= adapter.controller;
    var gateway   = adapter.controller.gateway;

    gateway.event.emit ("notice", "LOGIN_REQUEST", data.devid, this.uid, "");
    // if we not logged do it now
    if (this.logged === false) {
        this.devid = data.devid;
        this.class = controller.adapter.info;

        //Update/Create device socket store by uid at gateway level
        gateway.activeClients [this.devid] = this;
        
        //Propose a fake name in case nothing exist
        var emeifix = this.DummyName (this.devid);
        this.callsign = "FX-" + emeifix;
        this.model    = this.devid;
        if (!data.name) this.name = this.adapter.id + "-" + emeifix;
        else this.name = data.name;

        // ask backend to authenticate device and eventfully to change logged state to true
        gateway.backend.LoginDev (this);
    }
};

GpsdHttpClient.prototype.LogoutDev = function() {
    var gateway   = this.adapter.controller.gateway;

    if (this.logged) {
        delete gateway.activeClients [this.devid];
        gateway.backend.LogoutDev (this);
    }
};

// Action depending on data parsed by the adapter 
GpsdHttpClient.prototype.ProcessData = function(data) {

    // make code simpler to read 
    var adapter   = this.adapter;
    var controller= adapter.controller;
    var gateway   = adapter.controller.gateway;
  
     // update lastshow to cleanup crom
    this.lastshow= new Date().getTime();
    
    
    switch (data.cmd) {
        // This device is not register inside GpsdHttpClient Object
        case TrackerCmd.GetFrom.LOGIN:
            this.LoginDev (data);
            break;

        // Device keep alive service
        case TrackerCmd.GetFrom.PING:
            break;
        
        // Standard tracking information
        case TrackerCmd.GetFrom.TRACK :
            var update = true; // default is do the update
            data.acquired_at = new Date().getTime();

            // compute distance only update backend is distance is greater than xxxm
            if (this.stamp !== undefined) {
                var moved =  parseInt (this.Distance (this.stamp, data));

                // compute elapsed time since last update
                var elapsed = parseInt((data.acquired_at - this.stamp.acquired_at)/1000) ; // in seconds
                var speedms = parseInt (moved/elapsed);         // NEED TO BE KNOWN: with short tic speed is quicky overestimated by 100% !!!

                // usefull human readable info for control console
                data.moved    = moved;
                data.elapsed  = elapsed;
                
                // if moved less than mindist or faster than maxspeed check maxtime value
                if (moved < this.controller.svcopts.mindist) {
                    this.Debug(2,"%d Dev=%s Data ignored moved %dm<%dm ?", this.errorcount, this.devid, moved, this.controller.svcopts.mindist);
                    // should we force a DB update because maxtime ?
                    if (elapsed <  this.controller.svcopts.maxtime) update = false;
                }
                // if moved less than mindist or faster than maxspeed check maxtime value
                if (speedms > this.controller.svcopts.maxspeed) {
                    this.Debug(2,"%d Dev %s Data ignored speed %dm/s >%dm/s ?", this.errorcount, this.devid, speedms, this.controller.svcopts.maxspeed);
                    // we only ignore maxErrorCount message, then we restart data acquisition
                    if (this.errorcount++ <  this.controller.svcopts.maxerrors) update = false;
                }
             } else {
                data.moved  = 0;
                data.elapsed = 0;
             }


            // update database and store current device location in object for mindist computation
            if (update) { // update device last position in Ram/Database
                this.stamp = new PositionObj(data);
                gateway.backend.UpdatePosDev (this);
            } else {
                this.Debug(6,"%s Dev=%s ignored moved %dm<%dm ?", this.count, this.devid, moved, this.controller.svcopts.mindist);
                this.gateway.backend.IgnorePosDev (this);
            }
            break;
    
        default:
            this.Debug(2, "Notice: [%s] Unknown command=[%s] Ignored", this.uid, data.cmd);
            return;
            break;
    } // end switch

    gateway.event.emit ("accept", this, data);
    this.Debug (5, "Devid:[%s] Name:[%s] Cmd:[%s] Lat:%d Lon:%d Date:%s Logged=%s", this.devid, this.name, data.cmd, data.lat, data.lon, data.date, this.logged );
};

// Only LOGOUT command make sence with a TcpFeed
GpsdHttpClient.prototype.RequestAction = function(command,args){
    // send command to adapter & backend
    var status = this.adapter.SendCommand (this,command,args);
    if (status !== 0) {
        this.gateway.event.emit ("notice", "UNSUP_CMD", command, this.adapter.uid);
    }
    return(status);
};

module.exports = GpsdHttpClient;