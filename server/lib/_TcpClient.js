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
 * This modele is used for remove feed accessed in both client and server mode.
 * In server mode we may have multiple instance of devices for on server port.
 * Each device is instanciated as one . In client we only have 
 * one instance of per controller, but the code remain the same.
 * Note than on the other handle even for the same device, the adapter need
 * at the minimum specific routines dedicate to client/server mode.
 * 
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

function AlarmObj (data) {
    this.alarm= parseInt (data.cmd);
    this.arg  = parseInt (data.arg);
    this.lat  = parseFloat(data.lat);
    this.lon  = parseFloat(data.lon);

    this.data = new Date();
}

function ObdObj (data) {
    if (data.trip.length  > 0) this.trip = parseInt   (data.trip);
    if (data.rfuel.length > 0) this.rfuel= parseInt   (data.rfuel);
    if (data.afuel.length > 0) this.afuel= parseFloat (data.afuel);
    if (data.dtime.length > 0) this.dtime= parseInt   (data.dtime);
    if (data.speed.length > 0) this.speed= parseInt   (data.speed);
    if (data.pload.length > 0) this.pload= parseFloat (data.pload);
    if (data.temp.length  > 0) this.temp = parseInt   (data.temp);
    if (data.atp.length   > 0) this.atp  = parseFloat (data.atp);
    if (data.rpm.length   > 0) this.rpm  = parseInt   (data.rpm);
    if (data.bat.length   > 0) this.bat  = parseFloat (data.bat);
    if (data.diag.length  > 0) this.diag = parseInt   (data.diag);
    this.date = new Date();
}

// called from TcpFeed class of adapter
function TcpClient (socket) {
    this.debug     = socket.controller.debug; // inherit controller debug level
    this.gateway   = socket.controller.gateway;
    this.controller= socket.controller;
    this.adapter   = socket.adapter;
    this.socket    = socket;
    this.devid     = false;    // devid/mmsi directly from device or adapter
    this.name      = false;
    this.logged     = false;
    this.alarm     = 0;        // count alarm messages
    this.sensor    = 0;
    this.count     = 0;        // generic counter used by file backend
    
    if (socket.remoteAddress !== undefined) {
       this.uid= "sockclient//"  + this.adapter.info + "/remote:" + socket.remoteAddress +":" + socket.remotePort;
    } else {
        this.uid  = "tcpclient://" + this.adapter.info + ":" + socket.port;
    }
};

// Import debug method 
TcpClient.prototype.Debug = Debug;

// This method is fast but very approximative for close points
// User may expect 50% of error for distance of few 100m
// nevertheless this is more than enough to optimize storage.
TcpClient.prototype.Distance = function (old, now) {
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

TcpClient.prototype.LogoutDev = function() {
  if (this.logged) {
      delete this.gateway.activeClients [this.devid];
      this.gateway.backend.LogoutDev (this);
  }
};

TcpClient.prototype.LoginDev = function(data) {

    this.gateway.event.emit ("notice", "LOGIN_REQUEST", data.devid, this.uid, "");
    // if we not logged do it now
    if (this.logged === false) {
        this.devid = data.devid;
        this.class = this.adapter.info;
        this.model = data.model;
        this.call  = data.call;

        //Update/Create device socket store by uid at this.gateway level
        this.gateway.activeClients [this.devid] = this;

        // ask backend to authenticate device and eventfully to change logged state to true
        this.gateway.backend.LoginDev (this);
    }
};


TcpClient.prototype.ProcessData = function(data) {
    // if not logged exit now except for login
    if (!this.logged && data.cmd !== TrackerCmd.GetFrom.LOGIN) {
       this.Debug (3,"tracker update not logged DEVID=%s", this.devid);
        return (-1);
    }
    
    // update lastshow for cleanup cron
    this.lastshow= new Date().getTime();
    this.count ++; 
    
// process login in DB & active client list
    switch (data.cmd) {
                // This device is not register inside TcpClient Object
        case TrackerCmd.GetFrom.LOGIN: {
            this.LoginDev (data);
            break;
        };

        // Device keep alive service
        case TrackerCmd.GetFrom.PING:
            break;

        // Standard tracking information
        case TrackerCmd.GetFrom.OBD:
            this.gateway.backend.UpdateObdDev (this, new ObdObj (data));
            break;

        // Standard Alarm Packet
        case TrackerCmd.GetFrom.HELPME:
        case TrackerCmd.GetFrom.BATLOW:
        case TrackerCmd.GetFrom.SPEEDON:
        case TrackerCmd.GetFrom.ALARMDOOR:
        case TrackerCmd.GetFrom.ALARMACC:
            this.gateway.backend.UpdateAlarmDev (this, new AlarmObj (data));
            break;

        // Standard tracking information
        case TrackerCmd.GetFrom.TRACK:

            var update = true; // default is do the update
            
            // compute distance only update backend is distance is greater than xxxm
            if (this.stamp !== undefined) {
                var moved =  parseInt (this.Distance (this.stamp, data));
           
                // compute elapse time since last update
                var elapse  = parseInt ((data.date.getTime() - this.stamp.date.getTime()) / 1000); // in seconds
                var speedms = parseInt (moved/elapse);         // NEED TO BE KNOWN: with short tic speed is quicky overestimated by 100% !!!

                // usefull human readable info for control console
                data.moved   = moved;
                data.elapse  = elapse;
                
                // if moved less than mindist or faster than maxspeed check maxtime value
                if (moved < this.controller.svcopts.mindist || speedms > this.controller.svcopts.maxspeed) {
                    this.Debug(2,"%s Dev %s Data ignored moved %dm<%dm ?", this.count, this.devid, moved, this.controller.svcopts.mindist);
                    // should we force a DB update because maxtime ?
                    if (elapse <  this.controller.svcopts.maxtime) update = false;
                }
             } else {
                data.moved  = 0;
                data.elapse = 0;

             }

            // update database and store current device location in object for mindist computation
            if (update) { // update device last position in Ram/Database
                this.stamp = new PositionObj(data);
                this.gateway.backend.UpdatePosDev (this, this.stamp);

            } else {
                this.Debug (6, "DevId=%s [%s] Update Ignored moved:%dm/%d speed:%dms/%d"
                           , this.devid, this.name, moved, this.controller.svcopts.mindist, speedms, this.controller.svcopts.maxspeedms);
            }
            break;
    
        // Unknow command
        default:
            this.Debug(2, "Notice: [%s] Unknown command=[%s] Ignored", this.uid, data.cmd);
            return;
            break;
    } // end switch

    this.gateway.event.emit ("accept", this, data);
    this.Debug (5, "Devid:[%s] Name:[%s] Cmd:[%s] Lat:%d Lon:%d Date:%s Logged=%s", this.devid, this.name, data.cmd, data.lat, data.lon, data.date, this.logged );
};

// Only LOGOUT command make sence with a TcpFeed
TcpClient.prototype.RequestAction = function(command,args){
     // make code simpler to read 
    // send command to adapter & backend
    var status = this.adapter.SendCommand (this,command,args);
    if (status !== 0) {
        this.gateway.event.emit ("notice", "UNSUP_CMD", command, this.adapter.uid);
    }
    return(status);
};

module.exports = TcpClient;