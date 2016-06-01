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
 * This adaptater takes AIS input in AIS/NMEA Binary Format from either GPSd or Socket
 * And push event without creating a device per vessel
 */

'use strict';

var Debug       = require("../lib/_Debug");
var TcpClient   = require('../lib/_TcpClient');   // make each device a fake devid device
var TrackerCmd  = require("../lib/_TrackerCmd");


// use localdev tree if available
var AisDecode;
if  (process.env.GEOGATE !== 'dev')
     AisDecode = require('ggencoder').AisDecode;
else AisDecode = require("../../encoder/ApiExport").AisDecode;


// this function scan active device table and remove dead one based on inactivity timeout
function SetGarbage (proxy, timeout) {
    // let's call back ourself after timeout*1000/4
    proxy.Debug (4, "SetGarbage timeout=%d", timeout);
    setTimeout (function(){SetGarbage (proxy, timeout);}, timeout*500);
    
    // let compute timeout timeout limit
    var lastshow = new Date().getTime() - (timeout *1000);
    
    for (var mmsi in proxy.vessels) {
        var vessel = proxy.vessels[mmsi];
        if (vessel.lastshow < lastshow) {
            proxy.Debug (5, "Removed Vessel mmsi=%s", mmsi);
            delete proxy.vessels [mmsi];
        }
    }
      
};

// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + "@" +  controller.svcopts.hostname + ":" +controller.svcopts.remport;
    this.info      = 'AisProxyNmea';
    this.control   = 'tcpfeed';          // this adapter connect onto a remote server 
    this.debug     = controller.svcopts.debug;    // inherit debug from controller
    this.cleanup   = controller.svcopts.cleanup || 600;    // inherit debug from controller
    this.controller= controller;          // keep a link to device controller and TCP socket
    this.gateway   = controller.gateway;
    this.Debug (1,"uid=%s", this.uid);
    this.session   = {}; // special object to store AIS multipart messages
    this.vessels   = []; // cache for vessel positions
    
    this.event = controller.gateway.backend.event; // hook backend event handler
    SetGarbage (this, this.cleanup);
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

// Ais as multiple devices attached to one single tcp session 
DevAdapter.prototype.ClientConnect = function (socket) {
    // in case we are facing gpsd send nmea watch command
    socket.write ('?WATCH={"enable":true,"nmea":true}');
    
    // attach line counter and tempry buffer to socket session 
    socket.lineidx   = 0;                       // index within buffer
    socket.linebuf   = new Buffer (256);        // intermediary buffer

};

// Ais cannot logout device, they may still exit with gpsd cleanup function
DevAdapter.prototype.ClientQuit = function (socket) {
};
    
DevAdapter.prototype.ParseBuffer = function(socket, buffer) {
    this.Debug  (9, "request=[%s]", buffer);
    
    // split buffer multiple lines if any and remove \r\n
    for (var idx=0; idx < buffer.length; idx++) {
        switch (buffer [idx]) {
            case 0x0A: // new line \n
                var status = this.ParseLine (socket, socket.linebuf.toString ('ascii',0, socket.lineidx));
                socket.lineidx=0;
                break;
            case 0x0D: break;  // cariage return \r
            default: 
                socket.linebuf[socket.lineidx] = buffer [idx];
                socket.lineidx++;
            }
    }
};
    
// Process a full line Gpsd/Json send one object per line 
DevAdapter.prototype.ParseLine = function(socket, line) {
    var device;
    
    this.Debug  (8, "line=[%s]", line);

    // send AIS message to parser
    //try {
        var ais= new AisDecode (line, this.session);
    // } catch(e) {return;}
    
    // check if message was valid
    if (!ais.valid) return;
 
    /* we handle static AIS message type 5,24 as authentication request
     * and message 1,2,3,18 and position update resquest
     * check ../GpsdAisDecode for more information on message types  */
    switch (ais.aistype) {
        case 1:
        case 2:
        case 3:
        case 18:
            this.vessels[ais.mmsi] =
                { lat: ais.lat
                , lon: ais.lon
                , lastshow: new Date().getTime()
                };
            this.event.emit ("ais-data", ais, line);
            break;
        
        case 5:  // static information class A
        case 24: // static information class B
            if (this.vessels[ais.mmsi]) {
                ais.lat = this.vessels[ais.mmsi].lat;
                ais.lon = this.vessels[ais.mmsi].lon;
            }
            this.event.emit ("ais-data", ais, line);
            break;
        default:
            this.Debug (3,"Hoops: AIS aistype=%s not supported", ais.aistype);
    }
};


// send a command to activate GPSd service
DevAdapter.prototype.SendCommand = function(device, action, arg1) {
        switch (action) {
        case TrackerCmd.SendTo.LOGOUT: break; // everthing was take care at TcpFeed level
        default: 
            this.Debug (1,"Hoops %s UNKN_CMD=[%s]", this.uid, action);
            return (-1);     
        };
    // return OK status 
    this.Debug (5,"buffer=[%s]", this.packet);
    return (0);

};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
