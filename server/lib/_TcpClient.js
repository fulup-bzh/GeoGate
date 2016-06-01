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

function ObdObj (data) {
    this.trip = parseInt (data.trip) || 0;
    this.rfuel= parseInt   (data.rfuel) || 0;
    this.afuel= parseFloat (data.afuel) || 0;
    this.dtime= parseInt   (data.dtime) || 0;
    this.speed= parseInt   (data.speed) || 0;
    this.pload= parseFloat (data.pload) || 0;
    this.temp = parseInt   (data.temp)  || 0;
    this.atp  = parseFloat (data.atp)   || 0;
    this.rpm  = parseInt   (data.rpm)   || 0;
    //this.bat  = parseFloat (data.bat) || 0;
    if (data.diag.length  > 0) this.diag = parseInt   (data.diag);  else this.diag=0;
    this.acquired_at = new Date().getTime();
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
    this.logged    = false;
    this.alarmcount= 0;        // count alarm messages
    this.errorcount= 0;        // number of ignore messages
    this.jobcount  = 0;        // Job commands send to gateway
    this.count     = 0;        // generic counter used by file backend
    
    if (socket.remoteAddress !== undefined) {
       this.uid= "tcpclient//"  + this.adapter.info + "/remote:" + socket.remoteAddress +":" + socket.remotePort;
    } else {
       this.uid= "tcpclient://" + this.adapter.info + ":" + socket.port;
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

        //Update/Create device socket store by uid at this.gateway level
        this.gateway.activeClients [this.devid] = this;

        // ask backend to authenticate device and eventfully to change logged state to true
        this.gateway.backend.LoginDev (this);
    }
};


TcpClient.prototype.ProcessData = function(data) {

    function JobCallback (job) {
         job.gateway.Debug (3,"Job Done job=%s", job);
    }

    // update lastshow for cleanup cron
    this.lastshow= new Date().getTime();
    this.count ++; 

    // if not logged exit now except for login
    if (!this.logged) {
        switch (data.cmd) {
            // This device is not register inside TcpClient Object
            case TrackerCmd.GetFrom.LOGIN:
                this.LoginDev (data);
                break;    
            case TrackerCmd.GetFrom.TMPLOG:
                data.acquired_at = new Date().getTime();
                this.stamp = new PositionObj(data);
                this.gateway.backend.TempryLoggin (this);
                break;
            default:
                this.Debug (3,"tracker update TempryLoggin DEVID=%s", this.devid);
                return (-1);
        }
        return;
    }
    
    
    // process login in DB & active client list
    switch (data.cmd) {
 
        // Device keep alive service
        case TrackerCmd.GetFrom.PING:
            this.gateway.backend.IgnorePosDev (this);
            break;

        // Standard tracking information
        case TrackerCmd.GetFrom.OBD:
            this.gateway.backend.UpdateObdDev (this, new ObdObj (data));
            break;

        // Standard Alarm Packet
        case TrackerCmd.GetFrom.HELPME:
        case TrackerCmd.GetFrom.BATLOW:
        case TrackerCmd.GetFrom.ALARMSPEED:
        case TrackerCmd.GetFrom.ALARMDOOR:
        case TrackerCmd.GetFrom.ALARMACC:

            // after 5 validated Alarm let's clear device
            if (this.alarmcount ++ > 5) {
                this.alarmcount = 0;
                var job={command: TrackerCmd.SendTo.ALARM_OFF
                    ,gateway: this.gateway
                    ,devId  : data.devid
                    ,request: this.jobcount++
                };
                this.gateway.queue.push (job, JobCallback); // push to queue
            }

            data.acquired_at = new Date().getTime();
            this.stamp = new PositionObj(data);
            this.gateway.backend.UpdateAlarmDev (this);
            break;


        // Standard tracking information
        case TrackerCmd.GetFrom.TRACK:

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
                    this.Debug(2,"%s Dev %s Data ignored moved %dm<%dm ?", this.errorcount, this.devid, moved, this.controller.svcopts.mindist);
                    // should we force a DB update because maxtime ?
                    if (elapsed <  this.controller.svcopts.maxtime) update = false;
                }
                // if moved less than mindist or faster than maxspeed check maxtime value
                if (speedms > this.controller.svcopts.maxspeed) {
                    this.Debug(2,"%s Dev %s Data ignored speed %dm/s >%dm/s ?", this.errorcount, this.devid, speedms, this.controller.svcopts.maxspeed);
                    // we only ignore maxErrorCount message, then we restart data acquisition
                    if (this.errorcount++ <  this.controller.svcopts.maxerrors) update = false;
                }
             } else {
                data.moved  = 0;
                data.elapsed = 0;
             }

            // update database and store current device location in object for mindist computation
            if (update) { // update device last position in Ram/Database
                this.errorcount = 0;
                this.stamp = new PositionObj(data);
                this.gateway.backend.UpdatePosDev (this);

            } else {
                this.gateway.backend.IgnorePosDev (this);
                this.Debug (5, "DevId=%s [%s] Update Ignored moved:%dm/%d speed:%dms/%d"
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