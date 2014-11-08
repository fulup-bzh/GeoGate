#!/usr/bin/env node

/* 
 * Copyright 2014 Fulup Ar Foll
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
 * DOCUMENTATION
 * -------------
 * Ais Simulator simulates real life AIS/GPS feed like anyone can receive
 * on a real vessel or from an Internet service like AIShub, MarineTraffic, ...
 *
 *
 */
'use strict';


var net   = require ('net');
var async = require ("async");
var fs    = require ('fs');


// static global variables
var ActiveClients =[];    // global array for clients
var QJhandle;             // push data to client 0.5s sleep time in between messages
var CLsockid=0;           // provide a unique id to socket for cleaning ActiveClients
var DumpFD;               // file handler to write a copy of sent packet in dumpfile
var SCK_PSE=50;           // minimum pause time in between two packet [in ms]

/*
 *  As soon as GG-Dispatcherer receives an event from a simulator it pushes received
 *  position/statics in QJqueue with no transformation.
 *  Then Node pop the queue do presentation transformation [Ais,Json, ...] and finally
 *  pushed to any waiting client. If we are in client mode, then activeClient hold only
 *  one socket, on server mode we may have many of them.
 */
function QJcallback () {}
function QJpost (job, callback) {
    var packet;

    if (job === null) {callback ();}
    
    // wait tic time before sending next message
    QJhandle.pause ();

    job.dispatcher.Debug (4, "Job msg=%j", job.msg);

    // if no encoding method is registrated let's use basic JSON
    if (job.dispatcher.encoder === undefined) {
        packet = JSON.stringify(job.msg);
    } else {
        // encoding method is self encoded in job
        packet = job.dispatcher.encoder(job.msg);
    }

    // if a dumpfile has been defined write to it
    if (DumpFD !== undefined) {
      fs.writeSync (DumpFD, packet + '\n');
    }
    
    for (var sock in ActiveClients) {           
        ActiveClients [sock].write (packet + '\r\n');
    }
    
    // we're done wait SCK_PAUSE to send next message
    setTimeout(function () {QJhandle.resume();}, SCK_PSE);
    callback (); 
}

/*
 * Dispatcher constructor, start TCP server, connect on client on open dumpfile if requested.
 * it also create QJob queue and register for listening to simulator position/statics events.
 */
function Dispatcher (opts) {
    // provide some default values
    this.opts=
        { debug      : opts.debug    || 3              // default no debug
        , dumpfile   : opts.dumpfile || null           // filename for log file or NMEA generated commands
        , hostname   : opts.hostname || 'localhost'    // default localhost for client connect host
        , srvmod     : opts.srvmod   || false          // default is client mode
        , proto      : opts.proto    || 'json'         // default formatting proto
        , port       : opts.port     || 1234           // no default for port
        , cltmod     : opts.cltmod   || true           // default mode is client connect
        , timeout    : opts.timeout*1000  || 180000    // reconnect timeout default 180s
    };

    // if needed check dumpfile can be create
    if (this.opts.dumpfile !== null) {
        try { // dump fd is global
            DumpFD= fs.openSync (this.opts.dumpfile, "w+");
        } catch (err) {
            console.log ("hoops file to open [%s] err=[%s]",this.opts.dumpfile, err);
        }
    }

    // if needed start a Tcp server
    if (this.opts.srvmod) {
        this.opts.cltmod=false;    // when server cannot be a client
        this.clientCount= 0;       // index tcp clients socket
        this.TcpServer (); // start a server waiting on --port/localhost
    }

    // in client mode we connect onto a remote server
    if (this.opts.cltmod) {
        this.TcpClient();  // when connected will enter ClientListener() event handler
    }

    // validate Queue where position will be posted
     QJhandle  = async.queue  (QJpost, 1);
}

// import Debug helper
Dispatcher.prototype.Debug = require('./_Debug');

// Insert formatter registry and request encoder
Dispatcher.prototype.SetFormatter = function (ggformatter) {

    this.encoder = ggformatter.GetEncoder (this.opts.proto);
    if (this.encoder === undefined) {
        this.Debug (0, "HOOPs requested proto=[%s] encoder does not exist should be: %j", this.opts.proto,ggformatter.ListEncoder());
    }
};

// Collect event send by simulator objects
Dispatcher.prototype.SetListener = function (simulator) {

    var self= this; // hugly NodeJS hack to pass simulator object to job queue

    // Events successful process by tracker adapter
    function EventStatics (msg){
        var job =
                { type: 1
                , dispatcher: self
                , msg : msg
                };
        QJhandle.push (job, QJcallback);
    }
    // Events on action refused by tracker adapter
    function EventPosition (msg){
        var job =
            { type: 2
            , dispatcher: self
            , msg : msg
            };
        QJhandle.push (job, QJcallback);
    }
    // let's use the same event handler for all simulator object
    simulator.event.on("position",EventPosition);
    simulator.event.on("statics" ,EventStatics);
};

// implement a gps server compatible with OpenCPN/GPSd
Dispatcher.prototype.TcpServer = function () {

    // [Must be known] TcpConnect handler extend net.createServer object
    // this method is executed at each time a client hit TcpServer listening port
    function ServerConnect (socket) {
        var simulator= this.simulator;

        socket.uid = "Socket://" + socket.remoteAddress +":" + socket.remotePort;
        simulator.Debug(3, "New Client Id-%d Server=[%s] Client: [%s]",CLsockid++,this.uid,socket.uid);

        // keep track of active clients inside TCP server
        ActiveClients[socket] = socket;

        // Normaly gpsd client does not talk to server
        socket.on("data", function(buffer) {
            simulator.Debug(1, "%s Data=[%s]", socket.uid, buffer);
            socket.write ('GeoGate Simulator Ignored:' + buffer );
        });

        // On error close socket
        socket.on('error', function (err) {
            simulator.Debug(1, "%s ERROR=[%s]", socket.uid, err);
            socket.end();
        });

        // Remove the device from daemon active device list and notify adapter for eventual cleanup
        socket.on('end', function () {
            simulator.Debug(3, "Tcp-Client Quit %s/%d uid=%s", socket.countid, simulator.clientCount, socket.uid);
            delete ActiveClients[socket];
        });
    }

    // this method is call after TCP server start listening
    function ServerListen () {
        this.simulator.Debug (2,"TcpServer listening port:%d", this.simulator.opts.port);
    }

    // Launch Server and use it handler to store informations needed within tcpConnect handler
    this.tcpServer           = net.createServer(ServerConnect);
    this.tcpServer.uid       = "TcpServer://localhost:" + this.opts.port;
    this.tcpServer.simulator = this;

    // Activate server to listern on its TCP port
    this.tcpServer.listen(this.opts.port, ServerListen);
};

// act as a tcp client like any gps tracking device
Dispatcher.prototype.TcpClient = function () {

    // this handler is called when TcpClient connect onto server
    function TcpStreamConnect () {
        this.simulator.Debug (3, 'Dispatcher connected to %s:%s', simulator.opts.host, simulator.opts.port);
        ActiveClients[this] = this;  // register on remote server in active socket list
    }

    // Client receive data from server
    function TcpStreamData  (data) {
        // Normaly server take feed and does not talk
        this.simulator.Debug (1, "Server Talks =[%s]", data);
    }

    // Remote server close connection let's retry it
    function TcpStreamEnd () {
        this.simulator.Debug (3,"TcpStream [%s:%s] connection ended", simulator.opts.host, simulator.opts.port);
        delete ActiveClients[this];
        setTimeout (function(){ // wait for timeout and recreate a new Object from scratch
            simulator.TcpClient ();
        }, this.opts.timeout);
    }

    // Remote server close connection
    function TcpStreamError (err) {
        this.simulator.Debug (3,"TcpStream [%s:%s] connection err=%s", this.simulator.opts.host, this.simulator.opts.port, err);
        delete ActiveClients[this];
        setTimeout (function(){ // wait for timeout and recreate a new Object from scratch
            simulator.TcpClient ();
        }, this.timeout);
    }

    // connect onto server, call listerner on success
    this.socket = net.connect(this.opts.port, this.opts.hostname, TcpStreamConnect);
    this.socket.uid       = "TcpClient://" + this.opts.hostname + ':' +this.opts.port;
    this.socket.simulator = this;
    this.socket.timeout   = this.opts.timeout;

    // register event handler
    this.socket.on('data'  , TcpStreamData);
    this.socket.on('end'   , TcpStreamEnd);
    this.socket.on('error' , TcpStreamError);
};

module.exports = Dispatcher; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/