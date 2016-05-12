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

'use strict';

var util        = require("util");
var net         = require('net');
var fs          = require('fs');
var path        = require('path');
var http        = require("http"); 
var webSocket   = require('ws').Server; // https://github.com/einaros/ws

var Debug       = require("./_Debug");
var TcpClient   = require("./_TcpClient");
var availableAdapters  = require("./_ScanPlugin").Adapter();


// [Must be known] TcpConnect handler extend net.createServer object
// This method is executed at each a client hit TcpServer listening port
function TcpConnect (socket) {
    this.count ++;    // increment client count inside this server
    socket.uid = "Socket://" + socket.remoteAddress +":" + socket.remotePort;
    socket.controller = this.controller;
    socket.adapter   = this.adapter;
    socket.controller.Debug(4, "N°:%d Server=[%s] Client: [%s]"
             ,this.count,this.uid,socket.uid);            
        
    // attach new device object to client socket
    socket.device = new TcpClient (socket);
    
    // notify adapter that it has a new client device connected
    if (socket.adapter.ClientConnect (socket) === -1) {
        try {socket.end();} catch(e){};
        return;
    }
  
    // send any received data to device parser
    socket.on(this.evtname, function(buffer) {
	    socket.controller.Debug(7, "%s Data=[%s]", socket.device.uid, buffer);
        // call adapter specific method to process messages
        socket.adapter.ParseBuffer(socket, buffer);
    });
    
    // On error close socket
    socket.on('error', function (err) {
        socket.controller.Debug(3, "%s ERROR=[%s]", socket.device.uid, err);
        this.adapter.ClientQuit(socket);
        try {socket.destroy();} catch(e){};
    });
        
    // Remove the device from gateway active device list and notify adapter for eventual cleanup
    socket.on('end', function () {
	socket.controller.Debug(4, "SockClient Quit devid=%s uid=%s", socket.device.devid, socket.device.uid);
        this.adapter.ClientQuit(socket);
    });
    
};

// WebSockVerify callback info={origin, secure, req} params=OK:true/false,httpstatus,statustext
function WebSockVerify (adapter, info, callback) {
    adapter.Debug (4,"WebSockVerify origine=%s url=%s", info.origin, info.url);
    adapter.WebSockVerify (info, callback);
}
// in HTTP mode they is not initial connection concept adapter as to handle data.
function HttpRequest (request, response) {
    this.controller.Debug(7, "Data=[%s]", request.url);
    this.adapter.ProcessData (request, response);
    // processing of http responses is done at adapter level
};

function TcpSvrListenOk () {
    this.controller.Debug (3,"TcpServer [%s] listening", this.uid);
};

// Server fail to listen on port [probably busy]
function TcpSvrListenFx (err) {
    this.controller.Debug (0,"Hoop fail to listen port: %d ==> %s", this.controller.svcopts.port, err);
    console.log ("### gateway process abort ###");
    process.exit (-1);
};
    
// Client suceded connected to remote server
function TcpClientConnect () {
    this.controller.Debug (4,"[%s] connected", this.uid);
    // notify adapter that it has a new client device connected
    this.adapter.ClientConnect (this);
};
    
// Client receive data from server
function TcpClientData (buffer) {
    this.controller.Debug(7, "[%s] Data=[%s]", this.uid, buffer);
    // call adapter specific routine to process messages
    var status = this.adapter.ParseBuffer(this, buffer);
   
};

// Remote server close connection
function TcpClientEnd () {
    var svcopts   = this.svcopts;  // make objec info visible inside timer handler
    var controller= this.controller;
    var gateway   = this.controller.gateway;
    var svc       = this.controller.svc;
        
    controller.Debug (4,"[%s] connection ended", this.uid);
    this.adapter.ClientQuit(this);
    setTimeout (function(){ // wait for timeout and recreate a new Object from scratch
        gateway.controllers [svc] = new Controller (gateway, svcopts, svc);
    }, this.svcopts.timeout*1000);
};
// Remote server close connection
function TcpClientError (err) {
    var svcopts   = this.svcopts;  // make objec info visible inside timer handler
    var controller= this.controller;
    var gateway   = this.controller.gateway;
    var svc       = this.controller.svc;
    
    this.controller.Debug (2,"[%s] connection err=%s", this.uid, err);
    this.end();
    this.adapter.ClientQuit(this);
    setTimeout (function(){ // wait for timeout and recreate a new Object from scratch
        gateway.controllers [svc] = new Controller (gateway, svcopts, svc);
    }, this.svcopts.timeout*1000);
};
    
// devServer object embed TcpServer and SockClient objects
function Controller (gateway, svcopts, svc) {
    // Add DebugTool to log messages
    this.uid    = "Controller://" + svcopts.info + "/" + svcopts.adapter + ":" + svcopts.port;
    this.debug  = gateway.opts.services.debug || gateway.debug;
    this.svcopts= svcopts;
    this.gateway= gateway;
    this.svc    = svc;

    // take care or default adapter svcopts
    if (svcopts.mindist  === undefined) this.svcopts.mindist =200; // in m
    if (svcopts.maxtime  === undefined) this.svcopts.maxtime =3600;// in s == 1h
    if (svcopts.maxspeed === undefined) this.svcopts.maxspeed=100;  // in 100m/s=~400km/h
    if (svcopts.debug    === undefined) this.svcopts.debug   =this.debug;
    if (svcopts.debug    === undefined) this.svcopts.debug   =this.debug;
    if (svcopts.hostname === undefined) this.svcopts.hostname='localhost';
    if (svcopts.timeout  === undefined) this.svcopts.timeout=60;
    if (svcopts.maxerrors=== undefined) this.svcopts.maxerrors=2;
    // load device adapter as described within svcopts option from user application
    try {
        var  adapter  =  require(availableAdapters [svcopts.adapter]);  
    } catch (err) {
        this.Debug (0, 'Invalid adapter name : [%s] Error=%s', svcopts.adapter, err);
        console.log ("gateway aborted");
        process.exit();
    }
    this.adapter           =  new adapter (this);
    
    // Depending on adapter's control type logic for handling tcp socket change
    switch (this.adapter.control) {
    case 'tcpsock':
        // in tcpsock mode gateway uses tcp session to track a given device.
        // Each time a new client raises, it creates a new TcpConnect and attaches
        // a SockClient object to it. Device handler is then called from SockClient.
        this.tcpServer           = net.createServer(TcpConnect);
        this.tcpServer.uid       = "TcpServer://" + svcopts.adapter + ':' + svcopts.port;
        this.tcpServer.evtname   = 'data';
        this.tcpServer.controller= this;
        this.tcpServer.adapter   = this.adapter;
        this.tcpServer.count     = 0;   // number of active tcp clients 
        this.tcpServer.listen(svcopts.port, TcpSvrListenOk); 
        this.tcpServer.on('error', TcpSvrListenFx);
        break;
    case 'websock':
        // websocket start like an http connection and endup as a TcpConnect
        var adapter = this.adapter;
        var webSockOpts=
            {port         :svcopts.port
            ,verifyClient :function(info, callback){WebSockVerify(adapter, info, callback)}
        }
        this.wsServer=new webSocket (webSockOpts);
        this.wsServer.uid = "websock://" + svcopts.adapter + ':' + svcopts.port;
        this.wsServer.controller = this;
        this.wsServer.adapter   = this.adapter;
        this.wsServer.evtname   = 'message';
        this.wsServer.on('listening', TcpSvrListenOk);
        this.wsServer.on('connection',TcpConnect);
        break;
    case 'http':
        // in http mode, gateway cannot use tcp session to handle device, and deviceID
        // has to be present in each http/post. HttpRequest function calls
        // device adapter specific functions directly. The adapter creates
        // an HttpClient object based on devID present within each http/post request.
        this.tcpServer           = http.createServer(HttpRequest);
        this.tcpServer.uid       = "HttpServer://" + svcopts.adapter + ':' + svcopts.port;
        this.tcpServer.controller= this;
        this.tcpServer.adapter   = this.adapter;
        this.tcpServer.svcopts   = svcopts;
        this.tcpServer.listen(svcopts.port, TcpSvrListenOk); 
        this.tcpServer.on('error', TcpSvrListenFx);
        break;
    case 'tcpfeed':
        // in tcpfeed, gateway is a client of a remote server. And only one svcopts is
        // attached to a given instance of an adapter. Connected being unique it
        // is directly handled at adapter level.
        this.tcpClient           =  net.createConnection(svcopts.remport, svcopts.hostname);
        this.tcpClient.uid       = "TcpClient://" + svcopts.adapter + ':' + svcopts.remport;
        this.tcpClient.controller = this;
        this.tcpClient.adapter   = this.adapter;
        this.tcpClient.svcopts   = svcopts;
        this.tcpClient.on('connect', TcpClientConnect);
        this.tcpClient.on('data'   , TcpClientData); 
        this.tcpClient.on('end'    , TcpClientEnd);
        this.tcpClient.on('error'  , TcpClientError);
        break;
    default:
        this.Debug (0,"Hoops Invalid control class [%s] adapter [%s] class", adapter.control, availableAdapters [svcopts.adapter]);
    }
};

// import debug method 
Controller.prototype.Debug = Debug;

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
  console.log ("\n### Hoops Controller has no unit test");
}
module.exports = Controller; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

