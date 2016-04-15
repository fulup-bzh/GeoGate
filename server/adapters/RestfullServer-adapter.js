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
 * Object: Simple unsecured REST API interface with GeoGate Server
 * WARNING: this adapter is supposed to run behind a firewall and should not be expose to Internet.
 *
 */

'use strict';

var Debug     = require("../lib/_Debug");
var util      = require("util");
var url       = require("url");
var path      = require('path');

var TrackerCmd= require ("../lib/_TrackerCmd");


// Adapter is an object own by a given device controller that handle nmeadata connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.info      = 'Restapi';
    this.debug     = controller.svcopts.debug;  // inherit debug from controller
    this.controller= controller;  // keep a link to device controller and TCP socket
    this.control   = 'http';
    this.cors      = controller.svcopts.cors || false;
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

// This adapter ignore silently any command request
DevAdapter.prototype.SendCommand = function(httpclient, action, arg1) {
    return (0);
};

DevAdapter.prototype.JobCallback= function (job) {
    job.gateway.Debug (3, 'Job Done =%j', job);
};

// return a json object with device name and possition
DevAdapter.prototype.LogoutDev = function(query, request, response) {
    var gateway    = this.controller.gateway;

    var job={command: TrackerCmd.SendTo.LOGOUT
        ,gateway: gateway
        ,devId  : data.devid
        ,request: this.request++
    };
    gateway.queue.push (job, this.JobCallback); // push to queue
    response.writeHead(200,{"Content-Type": "text/html",'Cache-Control':'no-cache'});
    response.write ('OK');
    response.end();

};

// return a json object with device name and possition
DevAdapter.prototype.PingDev = function(query, request, response) {
    var gateway    = this.controller.gateway;
    var dev= gateway.activeClients [query.devid];

    if (dev.stamp != undefined) {
        var stamp = {
            'devid': query.devid,
            'age': parseInt((new Date().getTime() - dev.lastshow) / 1000),
            'lon': dev.stamp.lon.toFixed(4),
            'lat': dev.stamp.lat.toFixed(4),
            'sog': dev.stamp.sog.toFixed(2),
            'cog': dev.stamp.cog.toFixed(2),
            'alt': dev.stamp.alt.toFixed(2)
        };
    } else var stamp = {  'devid': query.devid, 'age': parseInt((new Date().getTime() - dev.lastshow) / 1000)};

    response.writeHead(200,{"Content-Type": "text/html",'Cache-Control':'no-cache'});
    response.write (JSON.stringify (stamp));
    response.end();

    // if update is request let force a device track command
    if (query.update) {
        var job={command: TrackerCmd.SendTo.GET_TRACK
            ,gateway: gateway
            ,devId  : query.devid
            ,request: this.request++
        };
        gateway.queue.push (job, this.JobCallback); // push to queue
    }
};

// return a json object with device name and possition
DevAdapter.prototype.QueryDevTrack = function(query, request, response) {
    var gateway    = this.controller.gateway;
    var dev= gateway.activeClients [query.devid];

    if (dev.stamp != undefined) {
        var stamp = {
            'devid': query.devid,
            'age': parseInt((new Date().getTime() - dev.lastshow) / 1000),
            'lon': dev.stamp.lon.toFixed(4),
            'lat': dev.stamp.lat.toFixed(4),
            'sog': dev.stamp.sog.toFixed(2),
            'cog': dev.stamp.cog.toFixed(2),
            'alt': dev.stamp.alt.toFixed(2)
        };
    } else var stamp = {  'devid': query.devid, 'age': parseInt((new Date().getTime() - dev.lastshow) / 1000)};

    response.writeHead(200,{"Content-Type": "text/html",'Cache-Control':'no-cache'});
    response.write (JSON.stringify (stamp));
    response.end();

};


// Do basic REST authentication and dispatch request
DevAdapter.prototype.ProcessRestApi = function(query, request, response) {

    var gateway    = this.controller.gateway;
    var device  = gateway.activeClients [query.devid];

    // in case client quit since last phone device list update
    if (device === undefined) {
        response.writeHead(404,"DEV_QUIT", {"Content-Type": "text/html"});
        response.write('DEV_QUIT');
        response.end();
        return;
    };

    // if device is known in DB check if tokens fits
    if (device.token != undefined) {
        if (device.token != query.token) {
            response.writeHead(406,"NOT_AUTH", {"Content-Type": "text/html"});
            response.write('NOT_AUTH');
            response.end();
            return;
        }
    }

    switch (query.cmd) {
        case 'logout' :   // 'http://localhost:4080/restapi?cmd=logout'
            this.LogoutDev  (query,request,response);
            break;
        case 'ping' :    // 'http://localhost:4080/restapi?cmd=ping&devid=865328021054936&token=36591ef0c1fea394445e58a128a41ddc41257a57'
            this.PingDev  (query,request,response);
            break;
            break;
        case 'list' :
            this.QueryDevList  (query,request,response);
            break;
        case 'get-track':
            this.QueryDevTrack (query,request,response);
            break;
        default: 
            response.writeHeader(404, {"Content-Type": "text/plain"});
            response.write("UNK_CMD");
            response.end();
    }
};

// This routine is called from GpsdController each time a new http request popup
DevAdapter.prototype.ProcessData = function(request, response) {
    var gateway=this.controller.gateway;
    var question=url.parse(request.url, true, true);
    var command = path.basename(question.pathname);
    var query = question.query;

    this.Debug (4,"Path=%s Query=%s", question.path, JSON.stringify(query));

    // sign or respond with a specific servername header
    response.setHeader("Server", "GeoGate-RestAPI");

    switch (command) {
    case "restapi":
        this.ProcessRestApi (query,request,response);
        break;

    default:
        response.writeHead(404, "unsupported command", {'Content-Type': 'text/html'});
        response.write("Unsupport command");
        response.end();    
    }
};
    
// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
  console.log ("### Hoops HtmlBasic-adapter no unit test");
};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/