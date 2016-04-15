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
 * This Adaptator is a proxy that wait for a JSON/AIS clients compatible 
 * with qtVLM and encode JSON/AIS into binary NMEA/AIS and push then on UDP
 * for Gpsd to process them.
 */

'use strict';

var Debug   = require("../lib/_Debug");
var dgram   = require('dgram');

// use localdev tree if available
var AisEncode;
if  (process.env.GEOGATE !== 'dev')
     AisEncode = require('ggencoder').AisEncode;
else AisEncode = require("../../encoder/ApiExport").AisEncode;

// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.info      = 'json2ais';
    this.control   = 'tcpsock';                 // this wait for AIS clients to connect via TCP  
    this.debug     =  controller.svcopts.debug; // inherit debug from controller
    this.controller =  controller;              // keep a link to device controller and TCP socket
    this.clients   =  [];                       // array to keep track of client
    this.count     =  0;                        // index for incomming client
    this.uport     =  controller.svcopts.uport;
    this.uhost     =  controller.svcopts.uhost || "127.0.0.1";
    this.Debug (1,"%s uhost=%s uport=%d", this.uid, this.uhost, this.uport);

    // create UDP port to push packet out
    if (this.uport) this.usock = dgram.createSocket('udp4');
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

DevAdapter.prototype.AisEncodeSend = function (message) {
    var aisOut, aisIn;

    try {
       aisIn = JSON.parse(message);
    }  catch (err) {
       return null;  
    }
    
    aisOut = new AisEncode (aisIn);
    if (! aisOut.valid) {
        this.Debug (1, "Invalid JSON/AIS=%j", aisIn);
        return null;
    }
    
    // transform AIS string into a buffer linefeed ended
    var msgbuf = new Buffer (aisOut.nmea + '\n');
    
    // if UDP is defined send AISpos onto it
    if (this.usock) {
           this.Debug (9, "Send UDP://%s:%d NMEA/AIS=%s", this.uhost, this.uport, aisOut.nmea);
           this.usock.send(msgbuf, 0, msgbuf.length, this.uport, this.uhost, function(err, bytes) {
           if (err) console.log ('### Hoops BroadcastPos : UDP Msg18 [err=%s]', err); 
        });
    }
    return msgbuf;
};
        
// we got a new JsonAisClient add it to client list for broadcast
DevAdapter.prototype.ClientConnect = function (socket) {
    socket.id=this.count ++;
    socket.uid="json2ais://" +  socket.remoteAddress +':'+ socket.remotePort;
    this.Debug  (4, "New client [%s]=%s", socket.id, socket.uid);
    this.clients[socket.id] = socket;
    socket.lineidx   = 0;                       // index within buffer
    socket.linebuf   = new Buffer (256);        // intermediary buffer
    socket.count     = 0;
    socket.write ("Json2Ais Waiting for data\n");
};

// aisproxy quit remove it from out list
DevAdapter.prototype.ClientQuit = function (socket) {
    this.Debug (4, 'Quit aisproxy client: %s id=%j', socket.uid, socket.id);
    delete this.clients[socket.id]; 
};

// browser talking, ignore data
DevAdapter.prototype.ParseLine = function(socket, line) {
    this.Debug (4, '%s data=%s', socket.uid, line);
    var aisNmea = this.AisEncodeSend (line);
    if (!aisNmea) socket.write ("Adapter: [" + this.info + "] JSON/AIS Invalid --> " + line + '\n');
    else if (this.debug > 3) socket.write ("Done\n");
};

DevAdapter.prototype.ParseBuffer = function(socket, buffer) {
    this.Debug  (9, "request=[%s]", buffer);

    // split buffer multiple lines if any and remove \r\n
    for (var idx=0; idx < buffer.length; idx++) {
        switch (buffer [idx]) {
            // ; is the end of GPS103 command
            case 0x0A:  // newline \n
            case 0x3B:  // ';' remove Gps103 end of command
                this.ParseLine (socket, socket.linebuf.toString ('ascii',0, socket.lineidx));
                socket.lineidx=0;
                break;
            case 0x0D: break;  // carriage return \r
            default:
                socket.linebuf[socket.lineidx] = buffer [idx];
                socket.lineidx++;
            }
    }
};


// This adapter does not send command
DevAdapter.prototype.SendCommand = function(device, action, arg1) {return (0);};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
