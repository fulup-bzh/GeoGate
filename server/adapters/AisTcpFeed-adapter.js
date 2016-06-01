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
 * Note is will not accept AIS positioning before target send a static AIS message
 */

/*
 * This adapter handle AIS feed over TCP as provided by
 *    AISHUB http://www.aishub.net
 *    GPSd   http://www.catb.org/gpsd/
 *    check  tcp://geotobe.net:4001 for testing data
 * Reference: http://www.catb.org/gpsd/client-howto.html
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

// small object to keep track of last position in ram
function AisPositionObj (ais) {
    this.devid= ais.mmsi;   // make a fake devid for device mmsi
    this.lat  = ais.lat;
    this.lon  = ais.lon;
    this.sog  = ais.sog; 
    this.cog  = ais.cog;
    this.alt  = 0;          // this is a boat it does not hick mountains!!! 
    this.date = new Date(); // use computer time 
};

// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + "@" +  controller.svcopts.hostname + ":" +controller.svcopts.remport;
    this.info      = 'TcpAis';
    this.control   = 'tcpfeed';          // this adapter connect onto a remote server 
    this.debug     = controller.svcopts.debug;    // inherit debug from controller
    this.controller= controller;          // keep a link to device controller and TCP socket
    this.gateway   = controller.gateway;
    this.Debug (1,"uid=%s", this.uid);
    this.count     =0; // stat counter
    this.session   = {}; // special object to store AIS multipart messages
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
    socket.count     = 0;

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
    var ais= new AisDecode (line, this.session);
    
    // check if message was valid
    if (!ais.valid) return;
    socket.count++;  // update line counter stat
 
    /* we handle static AIS message type 5,24 as authentication request
     * and message 1,2,3,18 and position update resquest
     * check ../GpsdAisDecode for more information on message types  */
    switch (ais.aistype) {
        case 1:
        case 2:
        case 3:
        case 18:
            var data = new AisPositionObj (ais);
            data.cmd= TrackerCmd.GetFrom.TRACK;
            data.count = socket.count;
            
            // if we exist in active client and we're log then update position now
            device = this.gateway.activeClients [ais.mmsi];
            if (device) {        // is device is not logged we use a trempry name
                device.ProcessData (data); // update ship position in DB
            } else {
                this.Debug (3, "Tempry log for mmsi:%s type:%s", ais.mmsi, ais.aistype);
                device = new TcpClient (socket);
                this.gateway.activeClients [ais.mmsi] = device;
                device.devid = ais.mmsi;
                data.cmd= TrackerCmd.GetFrom.TMPLOG;
                device.ProcessData (data); // update ship position in DB                
            }
            break;
        
        // 1st time when we get a device static info we check its authentication
        case 5:  // static information class A
        case 24: // static information class B

            // if device is not in active list we force a new object to keep track of it
            if (!this.gateway.activeClients [ais.mmsi]) {
                device = new TcpClient (socket);
                this.gateway.activeClients [ais.mmsi] = device;
            } else device=this.gateway.activeClients [ais.mmsi];
            
            this.Debug (8, "24 static mmsi=%s name=%s callsign=%s cargo=%s dimA=%s dimB=%s", ais.mmsi, ais.shipname, ais.callsign, ais.cargo, ais.dimA, ais.dimB);
                 
            if (!device.logged) { // if we have shipname update device even is unknown from DB
                
            device.mmsi    = ais.mmsi;
            if (ais.shipname) device.name = ais.shipname;
            if (ais.callsign) {
                device.callsign= ais.callsign;                 
                device.cargo   = ais.cargo;
                device.length  = Math.abs(ais.dimB - ais.dimA);
                device.width   = Math.abs(ais.dimD - ais.dimC);
            }
            
            // AIS loggin information arrive in two separated messages for (name & callsign)
            if (device.name && device.callsign) {
                this.Debug (4, "24 Loggin mmsi=%s name=%s cargo=%s callsign=%s", device.mmsi, device.name, device.cargo, device.callsign);
                var data = 
                    {devid : ais.mmsi
                    ,cmd  : TrackerCmd.GetFrom.LOGIN
                };                
                // ask client to process login 
                device.ProcessData (data);                
            }
            }


            break;
        case 25: // ping self
            if (device !== undefined && device.logged) { // device has sent its static info
                data.cmd= TrackerCmd.GetFrom.PING;
                device.ProcessData (data); // update ship position in DB
            }  
            break;
        default:
            this.Debug (4,"Hoops: AIS aistype=%s not supported", ais.aistype);
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
