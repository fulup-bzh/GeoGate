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
    this.lat   = parseFloat(data.lat);
    this.lon   = parseFloat(data.lon);
    this.sog   = parseFloat(data.sog);
    this.cog   = parseFloat(data.cog);
    this.alt   = parseFloat(data.alt);
    this.moved = parseInt(data.moved);
    this.elapse= parseInt(data.elapse);
    this.valid = parseInt(+data.valid);
    this.date  = data.date;
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
	this.logged         = false;
    this.alarm         = 0;        // count alarm messages
    this.count         = 0;        // generic counter used by file backend
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
        this.model = data.model;
        this.call  = data.call;

        //Update/Create device socket store by uid at gateway level
        gateway.activeClients [this.devid] = this;

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

            // compute distance only update backend is distance is greater than xxxm
            if (this.stamp !== undefined) {
                var moved =  parseInt (this.Distance (this.stamp, data));
                //console.log ("**** pos= %s,%s Stamp=%s,%s Moved=%s", data.lat, data.lon, this.stamp.lon, this.stamp.lat, moved);
           
                // compute elapse time since last update
                var elapse  = parseInt ((data.date.getTime() - this.stamp.date.getTime()) / 1000); // in seconds
                var sogms = parseInt (moved/elapse);         // NEED TO BE KNOWN: with short tic sog is quicky overestimated by 100% !!!

                // usefull human readable info for control console
                data.moved  = moved;
                data.elapse = elapse;
                
                // if moved less than mindist or faster than maxsog check maxtime value
                if (moved < this.controller.svcopts.mindist || sogms > controller.svcopts.maxsog) {
                    this.Debug(2,"%s Dev %s Data %s ignored moved %dm<%dm ?", this.count, this.devid, moved, this.controller.svcopts.mindist);
                    // should we force a DB update because maxtime ?
                    if (elapse <  controller.svcopts.maxtime) update = false;
                }
             } else {
                // usefull human readable info for control console
                data.moved   = 0;
                data.elapse  = 0;
             }

            // update database and store current device location in object for mindist computation
            if (update) { // update device last position in Ram/Database
                this.stamp = new PositionObj(data);
                gateway.backend.UpdatePosDev (this, this.stamp);
            } else {
                this.Debug(6,"%s Dev %s Data %s ignored moved %dm<%dm ?", this.count, this.devid, moved, this.controller.svcopts.mindist);
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
        this.gateway.event.emit ("notice", "UNSUP_CMD", command, adapter.uid);
    }
    return(status);
};

module.exports = GpsdHttpClient;