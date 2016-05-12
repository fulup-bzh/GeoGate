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

/*
 * This Adaptator receive an NMEA position and return AIS target within a
 * range of XXXNM. It is design for with OpenCPN and VirtualLoupDeMer, but
 * should work with any chart system that can send it possition in NMEA on
 * the same channel as it read AIS.
 * 
 * Client may send either a GPRMC NMEA value or AIS/JSON data
 * 
 * $GPRMC,171417,A,4737.1061,N,00245.6595,W,1.0969,58.544,080516,,*02
 * 
 * {"aistype":24,"mmsi":163994842,"part":0,"shipname":"maitai"}
 * {"aistype":24,"mmsi":163994842,"part":1,"callsign":"FG9196","cargo":95,"dimA":10,"dimB":2,"dimC":3,"dimD":3}
 * {"aistype":18,"mmsi":163994842,"lon":-2.4529008333333334,"lat":47.273095000000003,"cog":1300,"sog":160,"dsc":false,"accuracy":true,"second":1}
 *

 */

'use strict';

var Debug   = require("../lib/_Debug");
var TrackerCmd  = require("../lib/_TrackerCmd");
var TcpClient = require("../lib/_TcpClient");

// use localdev tree if available
var AisEncode;
if  (process.env.GEOGATE !== 'dev')
     AisEncode = require('ggencoder').AisEncode;
else AisEncode = require("../../encoder/ApiExport").AisEncode;

// use localdev tree if available
var NmeaDecode;
if  (process.env.GEOGATE !== 'dev')
     NmeaDecode = require('ggencoder').NmeaDecode;
else NmeaDecode = require("../../encoder/ApiExport").NmeaDecode;

// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.info      = 'ocpvlm';
    this.control   = 'tcpsock';                // this wait for AIS clients to connect via TCP  
    this.gateway   =  controller.gateway;
    this.debug     =  controller.svcopts.debug;// inherit debug from controller
    this.controller=  controller;              // keep a link to device controller and TCP socket
    this.count     =  0;                       // index for incomming client
    this.nbclient  =  0;
    this.distance  =  controller.svcopts.distance*1852 || 30*1852;
    this.maxclient =  controller.svcopts.maxclient || 30;
    this.Debug (1,"uid=%s distance=%dNM", this.uid, this.distance/1852);
    
    HookBackendEvent(this, controller.gateway.backend);
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

// hook user event handler to receive a copy of messages
function HookBackendEvent (adapter, backend, socket) {
          
    // Events successful process by tracker adapter
    function EventAisData (aismsg, aisnmea){
        adapter.Debug (9, "devid=%s aistype=%d nmea=%s", aismsg.mmsi, aismsg.aistype, aisnmea);
        adapter.BroadcastAisData (aismsg, aisnmea);
    };
    
    backend.event.on("ais-data"  ,EventAisData);	
};

DevAdapter.prototype.DistanceMove = function (device, now) {
    var old=device.stamp;
        
    var R = 6371; // Radius of the earth in km
    var dLat = (now.lat - old.lat) * Math.PI / 180;  // deg2rad below
    var dLon = (now.lon - old.lon) * Math.PI / 180;
    var a = 
      0.5 - Math.cos(dLat)/2 + 
      Math.cos(old.lat * Math.PI / 180) * Math.cos(now.lat * Math.PI / 180) * 
      (1 - Math.cos(dLon))/2;
    var d= R * 2 * Math.asin(Math.sqrt(a));
    d= Math.round (d*1000);
    this.Debug (9, "Distance devid:%s [%s] moved %dm", device.devid, device.name, d);
    return (d); // return distance in Meter
};

DevAdapter.prototype.BroadcastAisData = function (aismsg, aisnmea) {
    var aisOut;
    
    // transform AIS string into a buffer linefeed ended
    var msgbuf = new Buffer (aisnmea + "\n");
    
    // if we have AIS TCP device let's send a copy of AISpos to each of them
    for (var devid in this.gateway.activeClients) {
        var device = this.gateway.activeClients[devid];
        
        // if not tcpdevice with a known position ignore
        if (!device.socket || !device.stamp) continue;
            
        // if target is close enough from device send vessel position
        if (aismsg.vlm || this.DistanceMove (device, aismsg) <= this.distance) try {
            device.socket.write (msgbuf);          
        } catch (err) {
            this.Debug (1, '### Hoops BroadcastPos lost aisdevice: %s [err=%s]', device.uid, err);
            device.LogoutDev(); 
        }
    }   
};

     
// we got a new JsonAisClient add it to client list for broadcast
DevAdapter.prototype.ClientConnect = function (socket) {
    
    // protect from deny of service by overloading service
    if (this.nbclient >= this.maxclient) {
        this.Debug (3, 'MaxClient==%d Reached', this.nbclient);
        socket.write ("VlmOpc Too Many Clients [please retry later]\n");
        return -1;
    } 
    
    this.nbclient ++; 
    socket.id=this.count ++;
    socket.uid="opcvlm2ais://" +  socket.remoteAddress +':'+ socket.remotePort;
    this.Debug  (4, "New client [%s]=%s", socket.id, socket.uid);
    socket.device = new TcpClient (socket);
    socket.lineidx   = 0;                       // index within buffer
    socket.linebuf   = new Buffer (256);        // intermediary buffer
    socket.write ("VlmOpc Ready\n");
};

// aisproxy quit remove it from out list
DevAdapter.prototype.ClientQuit = function (socket) {
    this.Debug (4, 'Quit aisproxy client: %s id=%j', socket.uid, socket.id);
    this.nbclient --;
    socket.device.LogoutDev ();
};

// browser talking, ignore data
DevAdapter.prototype.ParseLine = function(socket, line) {
    this.Debug (4, '%s data=%s', socket.uid, line);
    var data;
    var device= socket.device;

    // looks like NMEA packet
    if (line[0] === '$') {

        
        // implement a fake login for NMEA only client
        if (!device.logged) {
            data = 
                {devid: socket.id
                ,cmd  : TrackerCmd.GetFrom.LOGIN
                ,name : socket.uid
            };
            device.ProcessData (data); 
        }
        
        data= new NmeaDecode (line);
        if (!data.valid) {
            socket.write ("Adapter: [" + this.info + "] NMEA Invalid RCM position --> " + line + '\n');
            return;
        }
        
        // send parsed data to unique device attached to NMEA adapter
        data.cmd = TrackerCmd.GetFrom.TRACK;
        device.ProcessData (data);
        if (this.debug > 5) socket.write ('NMEA Posi OK\n');
        
    // Might be AIS/JSON 
    } else {
        
        try {
            var aismsg = JSON.parse (line);
        } catch(e) {
            socket.write ("Adapter: [" + this.info + "] Invalid JSON position --> " + line + '\n');
            return;            
        } 
        
        // Encode AIS/Json on AIS/NMEA binary
        var aisnmea = new AisEncode (aismsg);
        if (! aisnmea.valid) {
            this.Debug (1, "Invalid JSON/AIS=%j", aismsg);
            return;
        }

        // implement a fake login at 1st AIS packet
        if (!device.logged) {
            data = 
            {devid: aismsg.mmsi
            ,cmd  : TrackerCmd.GetFrom.LOGIN
            ,name : socket.uid
            };
            device.ProcessData (data); 
        }
        
        switch (aismsg.aistype) {
            case 3:
            case 18:
                // Update Static and include last known position of client vessel
                aismsg.cmd = TrackerCmd.GetFrom.TRACK;
                device.ProcessData (aismsg);
                this.BroadcastAisData (aismsg, aisnmea.nmea); // Simulate an AIS input to broacast position to other vessels.
                if (this.debug > 5) socket.write ('AIS Posi OK\n');               
                break;
            
            case 5:
            case 24:                             
                this.BroadcastAisData (aismsg, aisnmea.nmea); // Simulate an AIS input to broacast position to other vessels.                
                if (this.debug > 5) socket.write ('AIS Static OK\n');
                break;
                
            default:
                // ignore any other data
                return;               
        }               
    }
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

// This adapter does not send command
DevAdapter.prototype.SendCommand = function(device, action, arg1) {return (0);};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
