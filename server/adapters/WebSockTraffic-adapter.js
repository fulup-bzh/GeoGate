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
 * This adapter is a sample on how to use a WEBsock. It connect on an
 * existing TCP feed (ex: AIShubSimulator, AIShub, etc ...) and broadcast
 * it to any active websock clients.
 * reference: // https://github.com/einaros/ws
 */

'use strict';

var Debug       = require("../lib/_Debug");
var Device      = require('../lib/_TcpClient'); // in this cas a device is a feed
var net         = require('net');
var url         = require("url"); 


var activeDev =[];

// hook user event handler to receive a copy of messages
function HookBackendEvent (adapter, backend, socket) {
          
    function EventDevAuth (device){
        device.websock=0;   // special counter to repost full device every 20 positions
        var msg = 
            {type : 1
               ,devid: device.devid
               ,model: device.type
               ,name : device.name
               ,call : device.call
               ,img  : device.img
        };
        adapter.BroadcastJson (msg);
    };    

    // Events successful process by tracker adapter
    function EventDevPos (device){
         
         // force push of full device info every 20 positions update
         device.websock= device.websock++ % 20;
         if (device.websock === 0) {
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
    
     // Events on action refused by tracker adapter
    function EventDevQuit (device){
       var msg=
           {type: 3
           ,devid: device.devid
           };
       adapter.BroadcastJson (msg);
    };

    backend.event.on("dev-auth",EventDevAuth);	
    backend.event.on("dev-pos" ,EventDevPos);	
    backend.event.on("dev-quit",EventDevQuit);	
};

// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    this.uid       = "adapter:" + "websock//"  + controller.svcopts.port;
    this.info      = 'websock';
    this.control   = 'websock';                // this wait for clients to connect via websock  
    this.debug     =  controller.svcopts.debug; // inherit debug from controller
    this.controller =  controller;               // keep a link to device controller and TCP socket
    this.clients   =  [];                      // array to keep track of client
    this.count     =  0;                       // index for incomming client
    this.Debug (1,"%s", this.uid);    

    HookBackendEvent(this, controller.gateway.backend);
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

DevAdapter.prototype.BroadcastJson = function (jsonobj) {
    this.Debug (7, "%j", jsonobj);
    // push back anything we got to client [if any]
    for (var sock in  this.clients) {
        try {
            var message=util.format ("%j", jsonobj);
            this.clients[sock].send (message);
        } catch (err) {
            this.Debug (0, '### HOOPS lost a websock client: %s', this.clients[sock].uid);
            delete this.clients[sock]; 
        }
    }
    
};
DevAdapter.prototype.WebSockVerify = function (info, callback) {
   var status, code, msg; 
    
   this.Debug (5, "origin=%s url", info.origin, info.req.url);
   var question=url.parse(info.req.url, true, true);
   
   if (parseInt (question.query.API_KEY) === 123456789) {
      status= true; // I'm happy
      code  = 400;  // everything OK
      msg   = '';   // nothing to add
  } else {
      status= false; // I'm noy happy
      code  = 404;   // key is invalid
      msg   = 'Demo requires API_KEY=123456789';
  }
   
   callback (status,code,msg);
};


// we got a new websock add it to client list for broadcast
DevAdapter.prototype.ClientConnect = function (socket) {
    socket.id=this.count ++;
    var gateway=this.controller.gateway;
    socket.uid="websock://" +  socket._socket.remoteAddress +':'+ socket._socket.remotePort;
    this.Debug  (4, "New client [%s]=%s", socket.id, socket.uid);
    this.clients[socket.id] = socket;
   
    // each new client get a list of logged device at connection time
    for (var devId in gateway.activeClients) {
        var device= gateway.activeClients[devId];
        if (device.logged) {

            if (device.stamp === undefined) {
            var msg =
               {type: 0
               ,devid: device.devid
               ,model: device.type
               ,name : device.name
               ,call : device.call
               ,img  : device.img
               };
           } else {
            var msg =
               {type: 0
               ,devid: device.devid
               ,model: device.type
               ,name : device.name
               ,call : device.call
               ,img  : device.img
               ,lat  : device.stamp.lat
               ,lon  : device.stamp.lon
               ,sog  : device.stamp.sog
               ,cog  : device.stamp.cog
               };
            }
            var message=util.format ("%j", msg);
            socket.send (message);   
        }
    }        
};

// websock quit remove it from out list
DevAdapter.prototype.ClientQuit = function (socket) {
    this.Debug (4, 'Quit websock client: %s', this.clients[sock.id].uid);
    delete this.clients[socket.id]; 
};

// browser talking, ignore data
DevAdapter.prototype.ParseBuffer = function(socket, buffer) {
    this.Debug (4, 'Talk websock client: %s data=%s', socket.uid, buffer);
};

// This adapter does not send command
DevAdapter.prototype.SendCommand = function(device, action, arg1) {
    return (0);
};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
