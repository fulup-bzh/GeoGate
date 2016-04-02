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

var Debug       = require("../lib/_Debug");
var Device      = require('../lib/_TcpClient'); // in this cas a device is a feed
var net         = require('net');
var url         = require("url"); 
var util       = require("util");

// use localdev tree if available
var AisEncode;
if  (process.env.GEOGATE !== 'dev')
     AisEncode = require('ggencoder').AisEncode;
else AisEncode = require("../../encoder/ApiExport").AisEncode;


// hook user event handler to receive a copy of messages
function HookBackendEvent (adapter, backend, socket) {
          
    function EventDevAuth (device){
        adapter.BroadcastStatic (device);
        if (device.stamp) adapter.BroadcastPos (device);
    };    
    
    function EventDevQuit (device){
    };    

    // Events successful process by tracker adapter
    function EventDevPos (device){
         
        // force push of full device info every 20 positions update
        device.aisproxy= device.aisproxy++ % 20;
        if (device.aisproxy === 0) adapter.BroadcastStatic (device);
        else adapter.BroadcastPos (device);
    };
    
    backend.event.on("dev-auth",EventDevAuth);	
    backend.event.on("dev-pos" ,EventDevPos);	
    backend.event.on("dev-alrm",EventDevPos);	
    backend.event.on("dev-quit",EventDevQuit);	
};

// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    this.uid       = "adapter:" + "aistcp//"  + controller.svcopts.port;
    this.info      = 'aistcp';
    this.control   = 'tcpsock';                 // this wait for AIS clients to connect via TCP  
    this.debug     =  controller.svcopts.debug; // inherit debug from controller
    this.controller =  controller;              // keep a link to device controller and TCP socket
    this.clients   =  [];                       // array to keep track of client
    this.count     =  0;                        // index for incomming client
    this.Debug (1,"%s", this.uid);    

    HookBackendEvent(this, controller.gateway.backend);
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

DevAdapter.prototype.BroadcastPos = function (device) {
    var aisOut;
    
    // push back anything we got to AIS clients [if any]
    for (var sock in  this.clients) {
        try {
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
                    mmsi       : device.callsign
                };

                //var message=util.format ("\n18b %j\n", msg18);
                //this.clients[sock].write (message);
                aisOut = new AisEncode (msg18);
                if (aisOut.valid) this.clients[sock].write (aisOut.nmea +'\n');
           
        } catch (err) {
            this.Debug (0, '### HOOPS BroadcastPos lost aisclient: %s [err=%s]', this.clients[sock].uid, err);
            delete this.clients[sock]; 
        }
    }   
};

DevAdapter.prototype.BroadcastStatic = function (device) {
    
    var aisOut;   
    device.aisproxy= 0; // reset counter to renew AIS static info

    // send statics to every connected AIS clients
    for (var sock in  this.clients) {
        try {
    
            var msg24a= {// class B static info
                aistype    : 24,
                part       : 0,
                cargo      : 37, // map on pleasure Craft
                callsign   : device.callsign,
                mmsi       : device.model,
                shipname   : device.name
            };
            //var message=util.format ("\n24a %j\n", msg24a);
            //socket.write (message);  
            aisOut = new AisEncode (msg24a);
            if (aisOut.valid) this.clients[sock].write (aisOut.nmea + '\n');

            var msg24b= {// class AB static info
                aistype    : 24,
                part       : 1,
                mmsi       : device.model,
                cargo      : device.name,
                callsign   : device.callsign,
                dimA       : 0,
                dimB       : 7,
                dimC       : 0,
                dimD       : 2.5
            };
            //var message=util.format ("\n24b %j\n", msg24b);
            //socket.write (message);
            aisOut = new AisEncode (msg24b);
            if (aisOut.valid) this.clients[sock].write (aisOut.nmea +'\n');
            } catch (err) {
        this.Debug (0, '### HOOPS BroadcastStatic lost aisclient: %s [err=%s]', this.clients[sock].uid, err);
        delete this.clients[sock]; 
        }
    }
};
        
// we got a new aisproxy add it to client list for broadcast
DevAdapter.prototype.ClientConnect = function (socket) {
    var aisOut;
    socket.id=this.count ++;
    var gateway=this.controller.gateway;
    socket.uid="aisproxy://" +  socket.remoteAddress +':'+ socket.remotePort;
    this.Debug  (4, "New client [%s]=%s", socket.id, socket.uid);
    this.clients[socket.id] = socket;

    // each new client get a list of logged device at connection time
    for (var devId in gateway.activeClients) {
        var device= gateway.activeClients[devId];
        if (device.logged) {
            
            this.BroadcastStatic (device.devid, socket);
            
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
                    mmsi       : device.model
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
    this.Debug (4, 'Talk AisTcpClient: %s data=%s', socket.uid, buffer);
};

// This adapter does not send command
DevAdapter.prototype.SendCommand = function(device, action, arg1) {
    return (0);
};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
