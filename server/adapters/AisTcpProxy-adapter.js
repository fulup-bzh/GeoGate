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
 * This Adaptator is a proxy that wait for an AIS compatible client to
 * connect [ex: Gpsd tcp://localhost:1234] or OpenCPN. It allows to broadcast
 * on AIShub/MarineTraffic a fake AIS possition obtain from a GPS tracker.
 */

'use strict';

var Debug   = require("../lib/_Debug");
var dgram   = require('dgram');

// use localdev tree if available
var AisEncode;
if  (process.env.GEOGATE !== 'dev')
     AisEncode = require('ggencoder').AisEncode;
else AisEncode = require("../../encoder/ApiExport").AisEncode;


// hook user event handler to receive a copy of messages
function HookBackendEvent (adapter, backend, socket) {
    
    function String2Hash (str) {
        var hash = 5381;
        var i = str.length;

        while(i) hash = (hash * 33) ^ str.charCodeAt(--i);

        /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
         * integers. Since we want the results to be always positive, convert the
         * signed int to an unsigned by doing an unsigned bitshift. 
         */
        
        return hash >>> 0;
    }
    
    // if no MMSI avaliable let's try to build a fakeone
    function EventDevAuth (device){
        if (!device.mmsi)  device.mmsi = parseInt (device.devid);
        if (isNaN (device.mmsi)) device.mmsi=String2Hash(device.devid);
        adapter.BroadcastStatic (device);
        if (device.stamp) adapter.BroadcastPos (device);
    };    
    
    function EventDevQuit (device){
    };    

    // Events successful process by tracker adapter
    function EventDevPos (device){
         
        // force push of full device info every 20 positions update
        if (device.aisproxy >= 20) adapter.BroadcastStatic (device);
        if ((new Date().getTime() - device.laststatics) > 900000) adapter.BroadcastStatic (device); // force statics every 15mn
        adapter.BroadcastPos (device);
    };
    
    backend.event.on("dev-auth",EventDevAuth);	
    backend.event.on("dev-pos" ,EventDevPos);	
    backend.event.on("dev-ign" ,EventDevPos);	
    backend.event.on("dev-alrm",EventDevPos);	
    backend.event.on("dev-quit",EventDevQuit);	
};

// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.info      = 'aistcp';
    this.control   = 'tcpsock';                 // this wait for AIS clients to connect via TCP  
    this.debug     =  controller.svcopts.debug; // inherit debug from controller
    this.controller =  controller;              // keep a link to device controller and TCP socket
    this.clients   =  [];                       // array to keep track of client
    this.count     =  0;                        // index for incomming client
    this.uport     =  controller.svcopts.uport;
    this.uhost     =  controller.svcopts.uhost || "127.0.0.1";
    this.Debug (1,"uid=%s", this.uid);

    // create UDP port to push packet out
    if (this.uport) this.usock = dgram.createSocket('udp4');

    HookBackendEvent(this, controller.gateway.backend);
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

DevAdapter.prototype.BroadcastPos = function (device) {
    var aisOut;
    
    device.aisproxy++; // update counter for AIS static renewal
    if (!device.stamp) return;
    
    // push back anything we got to AIS clients [if any]
    var msg18= { // standard class B Position report
        aistype    : 18,
        cog        : device.stamp.cog,
        sog        : device.stamp.sog,
        dsc        : false,
        repeat     : false,
        accuracy   : true,
        lon        : device.stamp.lon,
        lat        : device.stamp.lat,
        second     : 1,
        mmsi       : device.mmsi
    };
    this.Debug (4, "AIS Position=%j", msg18);

    //var message=util.format ("\n18b %j\n", msg18);
    //this.clients[sock].write (message);
    aisOut = new AisEncode (msg18);
    if (! aisOut.valid) {
        this.Debug (1, "Invalid msg18=%j", msg18);
        return;
    }
    
    // transform AIS string into a buffer linefeed ended
    var msgbuf = new Buffer (aisOut.nmea + "\n");
    
    // if UDP is defined send AISpos onto it
    if (this.usock) {
           this.usock.send(msgbuf, 0, msgbuf.length, this.uport, this.uhost, function(err, bytes) {
           if (err) console.log ('### Hoops BroadcastPos : UDP Msg18 [err=%s]', err); 
        });
    }

    // if we have AIS TCP client let's send a copy of AISpos to each of them
    for (var sock in  this.clients) {
        try {
            this.clients[sock].write (msgbuf);          
        } catch (err) {
            this.Debug (1, '### Hoops BroadcastPos lost aisclient: %s [err=%s]', this.clients[sock].uid, err);
            delete this.clients[sock]; 
        }
    }   
};

DevAdapter.prototype.BroadcastStatic = function (device) {
    
    var aisOutA, aisOutB;   
    device.aisproxy= 0; // reset counter to renew AIS static info
    device.laststatics=new Date().getTime();
    
    this.Debug (1,"BroadcastStatic devid=%s mmsi=%s name=%s cargo=%s length=%s", device.devid, device.mmsi, device.name, device.cargo , device.length);

    var msg24a= {// class B static info
        aistype    : 24,
        part       : 0,
        mmsi       : device.mmsi,
        shipname   : device.name
    };
    this.Debug (4, "AIS Statics=%j", msg24a);
    aisOutA = new AisEncode (msg24a);

    var msg24b= {// class AB static info
        aistype    : 24,
        part       : 1,
        mmsi       : device.mmsi,
        cargo      : device.cargo  || 0, 
        callsign   : device.callsign,
        dimA       : 0,
        dimB       : Math.round(device.length),
        dimC       : 0,
        dimD       : Math.round(device.width)
    };
    aisOutB = new AisEncode (msg24b);

    if (!aisOutA.valid || !aisOutB.valid) {
        this.Debug (1, "Invalid msg24a=%j msg24b=%j", msg24a, msg24b);
        return; 
    }
    
    // transform AIS string into a buffer linefeed ended
    var msgbufA = new Buffer (aisOutA.nmea + "\n");
    var msgbufB = new Buffer (aisOutB.nmea + "\n");
    
    // if UDP is defined send AISpos onto it
    if (this.usock) {
        this.usock.send(msgbufA, 0, msgbufA.length, this.uport, this.uhost, function(err, bytes) {
           if (err) console.log ('### Hoops BroadcastPos : UDP msg24a send [err=%s]', err); 
        });

        this.usock.send(msgbufB, 0, msgbufB.length, this.uport, this.uhost, function(err, bytes) {
                if (err) console.log ('### Hoops BroadcastPos : UDP msg24b send [err=%s]', err); 
        });
        
    }
    
    // send statics to every connected AIS clients
    for (var sock in  this.clients) {
        try {
            //socket.write (message);
            this.clients[sock].write (msgbufA);
            this.clients[sock].write (msgbufB);
        } catch (err) {
            this.Debug (0, '### HOOPS BroadcastStatic lost aisclient: %s [err=%s]', this.clients[sock].uid, err);
            if (sock) delete this.clients[sock]; 
        }
    }
};
        
// we got a new aisproxy add it to client list for broadcast
DevAdapter.prototype.ClientConnect = function (socket) {
    socket.id=this.count ++;
    var gateway=this.controller.gateway;
    var aisOut;
    socket.uid="aisproxy://" +  socket.remoteAddress +':'+ socket.remotePort;
    this.Debug  (4, "New client [%s]=%s", socket.id, socket.uid);
    this.clients[socket.id] = socket;
    
    // each new client get a list of logged device at connection time
    for (var devId in gateway.activeClients) {
        var device= gateway.activeClients[devId];
        if (device.logged) {
            
            
            if (device.stamp !== undefined) {                
                var msg18= { // standard class B Position report
                    aistype    : 18,
                    cog        : device.stamp.cog,
                    sog        : device.stamp.sog,
                    dsc        : false,
                    repeat     : false,
                    accuracy   : true,
                    lon        : device.stamp.lon,
                    lat        : device.stamp.lat,
                    second     : 1,
                    mmsi       : device.mmsi
                };
  
                //var message=util.format ("\n18x %j\n", msg18);
                //socket.write (message);
                aisOut = new AisEncode (msg18);
                if (aisOut.valid) socket.write (aisOut.nmea +'\n');
            }
        }
    }    
};

// aisproxy quit remove it from out list
DevAdapter.prototype.ClientQuit = function (socket) {
    this.Debug (4, 'Quit aisproxy client: %s id=%j', socket.uid, socket.id);
    delete this.clients[socket.id];
};

// browser talking, ignore data
DevAdapter.prototype.ParseBuffer = function(socket, buffer) {
    this.Debug (4, '%s data=%s', socket.uid, buffer);
    socket.write ("Adapter: [" + this.info + "] invalid--> " + buffer);
};

// This adapter does not send command
DevAdapter.prototype.SendCommand = function(device, action, arg1) {
    return (0);
};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
