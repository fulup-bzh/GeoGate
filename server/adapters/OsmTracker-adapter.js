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
 * This adapter handle MobilePhone under Traccar/OSM http protocol
 * Clients: https://www.traccar.org
 * Protocol https://www.traccar.org/osmand/
 */

'use strict';

var Debug       = require("../lib/_Debug");
var HttpClient  = require('../lib/_HttpClient');
var TrackerCmd  = require("../lib/_TrackerCmd");

// use localdev tree if available
var NmeaDecode;
if  (process.env.GEOGATE !== 'dev')
     NmeaDecode = require('ggencoder').NmeaDecode;
else NmeaDecode = require("../../encoder/ApiExport").NmeaDecode;

var util        = require("util");
var url         = require("url");

function OSMdata (data) {
    if(typeof (data) !== "object") return;

    this.valid= true;
    this.date = new Date (data.timestamp * 1000);
    this.lat  = parseFloat (data.lat);
    this.lon  = parseFloat (data.lon);
    this.sog  = parseFloat (data.speed);
    this.cog  = parseFloat (data.bearing);
    this.alt  = parseFloat (data.altitude);
};

// Adapter is an object own by a given device controller that handle nmeadata connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.info      = 'OSMtracker';
    this.debug     = controller.svcopts.debug;  // inherit debug from controller
    this.controller= controller;
    this.gateway   = controller.gateway;
    this.control   = 'http';
    this.Debug (1,"uid=%s", this.uid);    
};

// CellTrack Free does not accept commands.
DevAdapter.prototype.SendCommand = function() {};


// This routine is called from Controller each time a new http request popup
DevAdapter.prototype.ProcessData = function(request, response) {
    var result;

    // parse URL to extract DevId and NMNEA $GPRMC info
    var question=url.parse(request.url, true, true);
    var query=question.query;
    
    // query={id:708697, timestamp:1459674223, lat:47.6188112896477, lon:-2.760623590985209, speed:1.1541678025918007, bearing:257.92236328125, altitude:77.14398689398148, batt:89.0}
    this.Debug (4,"Path=%s [len=%s] Query=%s", question.pathname, question.pathname.length, JSON.stringify(query));

    if (query.id === undefined) {
          this.Debug (2,"Hoops: query:id not found in Http Request");
          response.writeHeader(400, {"Content-Type": "text/plain"});
          response.write('OSM/Traccar: Invalid Input Format');
          response.end();
          return;
    }

    // is user is logged try it now
    var device = this.gateway.activeClients [query.id];
    if (device === undefined) {
        device= new HttpClient(this, query.id);
        // force authent [due to DB delay we may refuse first NMEA packets]
        device.LoginDev ({devid: query.id});
    }

    // we refuse packet from device until it is not log by DB backend
    if (device.logged !== true) {
        // leave 1s for DB to authenticate device before closing request
        this.Debug (4,"Device not login: EMEI=%s", query.id);
        setTimeout(function(){response.end();}, 1000);
        return;
    }

    // if parsing abort then force line as invalid
    var data = new OSMdata (query);
    if (!data.valid) {
        this.Debug (5,'OSM invalid data=%s', JSON.stringify(query));
        result = "Invalid Data";
    } else {
        this.Debug (7,"--> NMEA Lat:%s Lon:%s Sog:%d Cog:%d Alt:%d Date:%s"
                   , data.lat, data.lon, data.sog, data.cog, data.alt, data.date);
        data.cmd = TrackerCmd.GetFrom.TRACK;
        device.ProcessData (data);
        result = "OK";
    }
    response.writeHeader(200, {"Content-Type": "text/plain"});  
    response.write(result);
    response.end();      
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
  console.log ("### Hoops GtcDroid-adapter no unit test");
};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

