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
 */

var GGgateway = require("../server/lib/GG-Gateway");

var PortBase = 4000;

var GeoGateConfig = {
    backend    : "MySqlDb",       // backend file ==> mysql-backend.js [default file]
    name       : "Gpsd-Ais",   // friendly service name [default Gpsd-Track]
    inactivity : 900,             // remove device from active list after xxxs inactivity [default 600s]
    debug      : 2,               // debug level 0=none 9=everything

    "services"    :  {  debug: 4
        /*
         info     : 'a friendly name for your service'
         adapter  : 'xxxx for adapter file = ./adapter/xxxx-adapter.js'
         port     : 'tcp port for both service server & client mode'
         hostname : 'remote service provider hostname  [default localhost]'
         timeout  : 'reconnection timeout for consumer of remote service [default 120s]'
         devid     : 'as real nmea feed does not provide devid this is where user can provide a fake one'
         maxspeed : 'any thing faster is view as an invalid input [default=55m/s == 200km/h]
         mindist  : 'dont store data if device move less than xxxm [default 200m]'
         maxtime  : 'force data store every xxxxs even if device did not move [default 3600s]'
         debug    : 'allow to give a specific debug level this adapter default is [gateway.debug]'
         */

        // this controle console, you probably want it hyden behind your firewall
        , Telnet   : {info: "Telnet Console"  , adapter: "TelnetConsole" , port: PortBase +0}
        //, Httpd  : {info: "Rest API Server" , adapter: "RestfullServer", port:PortBase +80, debug:5}

        // Tracker devices are TCP servers & wait for clients to connect
        , Gps103   : {info: "Tk102 Gps103"    , adapter: "Gps103Tk102"   , port: PortBase +10, debug:5, mindist:50}
        , Celltrac : {info: "CellTrac Android", adapter: "GtcGprmcDroid" , port: PortBase +20}
        , AisGpsd  : {info: "AIS TCP Proxy"   , adapter: "AisTcpProxy"   , port: PortBase +21, debug:5}
        , RemGps   : {info: "Gps Over Tcp" , adapter: "NmeaTcpFeed"   , hostname: "sinagot.net" , remport:5002, timeout:60, mmsi:123456789, mindist:50}
    },

    "mysql": { // [should reflect your MySQL configuration]
        debug   : 6,
        hostname: "localhost",     // MySql hostname
        basename: "tracker",        // Basename base should exist
        username: "tracker",        // MySql username
        password: "01234@bcd€"      // MySql password
    }
};



// ----------- User Event Handler -----------------
function ListenEvents (server) {
    var count =0;  // Simple counter to make easier to follow message flow


    // Events from queued jobs
    function EventHandlerQueue (status, job){
        console.log ("#%d- Queue Status=%s DevId=%s Command=%s JobReq=%d Retry=%d", count, status, job.devId, job.command, job.request, job.retry);
    };
    // Events successful process by tracker adapter
    function EventHandlerAccept (device, data){
        console.log ("#%d- Action Devid:[%s] Name:[%s] Cmd:[%s] Lat:%d Lon:%d Speed=%d", count, device.devid, device.name, data.cmd, data.lat, data.lon, data.sog);
    };
    // Events on action refused by tracker adapter
    function EventHandlerError (status, info, id, msg){
        console.log ("#%d- Notice Info=%s Data=%s Id=%s Msg:%s", count, status, info, id, msg );
    };

    // let's use the same event handler for all gpsdTracker
    server.event.on("queue",EventHandlerQueue);
    //server.event.on("accept",EventHandlerAccept);
    server.event.on("notice",EventHandlerError);
};


// **** Start Server *******

// instanciate a new Gateway Daemon
var gateway = new GGgateway (GeoGateConfig);

// In verbose mode we listen & display gateway events
ListenEvents (gateway);


 

