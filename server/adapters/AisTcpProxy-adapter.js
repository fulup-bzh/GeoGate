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

// Map Tracker EMEI on Vessel MMSI [Warning: do not use fake MMSI with AISHUB, MarineTraffic,...]
var IMEI_MMSI_MAPPING = {
    319710045733004: {mmsi: "227417480", callsign: "FGE6445", shipname: "Choari Tadkoz", shiptype: 0},
    123456789      : {mmsi: "227417480", callsign: "FGE6445", shipname: "Choari Tadkoz", shiptype: 0}
};

// hook user event handler to receive a copy of messages
function HookBackendEvent (adapter, backend, socket) {
          
    function EventDevAuth (device){
        device.aisproxy=0;   // special counter to repost full device every 20 positions
        var msg = {type : 1, devid: device.devid};
        adapter.BroadcastJson (msg);
    };    

    // Events successful process by tracker adapter
    function EventDevPos (device){
         
         // force push of full device info every 20 positions update
         device.aisproxy= device.aisproxy++ % 20;
         if (device.aisproxy === 0) {
            EventDevAuth (device); 
         }
         
         var msg = 
            {type : 2
            ,devid: device.devid
            ,lat  : device.stamp.lat
            ,lon  : device.stamp.lon
            ,sog  : device.stamp.sog
            ,cog  : device.stamp.cog
        };
        adapter.BroadcastJson (msg);
    };
    
    backend.event.on("dev-auth",EventDevAuth);	
    backend.event.on("dev-pos" ,EventDevPos);	
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

DevAdapter.prototype.BroadcastJson = function (jsonobj) {
    this.Debug (5, "%j", jsonobj);
    var aisOut;
    // push back anything we got to client [if any]
    for (var sock in  this.clients) {
        try {
            if (jsonobj.type === 2) {
                var msg18= { // standard class B Position report
                    aistype    : 18,
                    cog        : jsonobj.cog,
                    sog        : jsonobj.sog,
                    dsc        : false,
                    repeat     : false,
                    accuracy   : true,
                    lon        : jsonobj.lon,
                    lat        : jsonobj.lat,
                    second     : 1,
                    mmsi       : IMEI_MMSI_MAPPING [jsonobj.devid].mmsi
                };

                //var message=util.format ("\n18b %j\n", msg18);
                //this.clients[sock].write (message);
                aisOut = new AisEncode (msg18);
                if (aisOut.valid) this.clients[sock].write (aisOut.nmea +'\n');
            }
            if (++IMEI_MMSI_MAPPING [jsonobj.devid].count > 20 || jsonobj.type === 1)  this.BroadcastStatic(jsonobj.devid, this.clients[sock]);
           
        } catch (err) {
            this.Debug (0, '### HOOPS lost a aisproxy client: %s [err=%s]', this.clients[sock].uid, err);
            delete this.clients[sock]; 
        }
    }
    
};

DevAdapter.prototype.BroadcastStatic = function (devid, socket) {
            IMEI_MMSI_MAPPING [devid].count =0;  // reset counter
            var aisOut;
    
            var msg24a= {// class B static info
                aistype    : 24,
                part       : 0,
                cargo      : IMEI_MMSI_MAPPING [devid].shiptype,
                callsign   : IMEI_MMSI_MAPPING [devid].callsign,
                mmsi       : IMEI_MMSI_MAPPING [devid].mmsi,
                shipname   : IMEI_MMSI_MAPPING [devid].shipname
            };
            //var message=util.format ("\n24a %j\n", msg24a);
            //socket.write (message);  
            aisOut = new AisEncode (msg24a);
            if (aisOut.valid) socket.write (aisOut.nmea + '\n');


            var msg24b= {// class AB static info
                aistype    : 24,
                part       : 1,
                mmsi       : IMEI_MMSI_MAPPING [devid].mmsi,
                cargo      : IMEI_MMSI_MAPPING [devid].shiptype,
                callsign   : IMEI_MMSI_MAPPING [devid].callsign,
                dimA       : 0,
                dimB       : IMEI_MMSI_MAPPING [devid].lenght || 10,
                dimC       : 0,
                dimD       : IMEI_MMSI_MAPPING [devid].width || 3
            };
            //var message=util.format ("\n24b %j\n", msg24b);
            //socket.write (message);
            aisOut = new AisEncode (msg24b);
            if (aisOut.valid) socket.write (aisOut.nmea +'\n');
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
        if (device.logged && IMEI_MMSI_MAPPING [device.devid]) {
            
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
                    mmsi       : IMEI_MMSI_MAPPING [device.devid].mmsi
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
