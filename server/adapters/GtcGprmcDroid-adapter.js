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
 * This adapter handle GtcFree messages For devices using HTTP/GPRMC protocol.
 * As Android://CellTrac/Geotelematic, iPhone://OpenGtsCient/TECHNOLOGYMAZE
 * iphone://GerGTSTracker; etc....
 * https://play.google.com/store/apps/details?id=org.opengts.client.android.cgtsfre
 * 
 * Reference: http://fr.wikipedia.org/wiki/NMEA_0183
 * https://sourceforge.net/p/opengts/discussion/579834/thread/f2be5bbf/
 * http://fossies.org/dox/OpenGTS_2.5.6/EventUtil_8java_source.html
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

// Adapter is an object own by a given device controller that handle nmeadata connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.info      = 'GtcFree';
    this.debug     = controller.svcopts.debug;  // inherit debug from controller
    this.controller= controller;
    this.gateway   = controller.gateway;
    this.control   = 'http';
    this.Debug (1,"uid=%s", this.uid);    
};

// CellTrack Free does not accept commands.
DevAdapter.prototype.SendCommand = function(httpclient) {};


// This routine is called from Controller each time a new http request popup
DevAdapter.prototype.ProcessData = function(request, response) {
    var result;

    // parse URL to extract DevId and NMNEA $GPRMC info
    var question=url.parse(request.url, true, true);
    var query=question.query;
    //query={"id":"123456789012345","altitude":"43.977329","hacc":"65.000000","code":"0xF020","gprmc":"$GPRMC,010341.06,A,0123.4340,N,10350.8960,E,00.00,000.00,220115,0,0,A*69"};

    this.Debug (4,"Path=%s [len=%s] Query=%s", question.pathname, question.pathname.length, JSON.stringify(query));

    // Debug
    // Group:  http://localhost:4020/events/dev.json?a=fulup-bzh&u=demo-id&p=MyPasswd&g=all&l=1
    // Device: http://localhost:4020/events/dev.json?a=fulup-bzh&u=demo-id&p=MyPasswd&d=123456789&l=4
      
    if (query.id === undefined) {
          this.Debug (2,"Hoops: query:id not found in Http Request");
          response.writeHeader(400, {"Content-Type": "text/plain"});
          response.write('CellTracGTS: Invalid Input Format');
          response.end();
          return;
    }
    
    // make sure the ID is an interger
    var devid = parseInt (query.id);
    if (isNaN (devid)) devid = parseInt (query.id,16)/1000;
    if (isNaN (devid)) {
          this.Debug (2,"Hoops: query:id invalid id=%s", devid);
          response.writeHeader(400, {"Content-Type": "text/plain"});
          response.write('ERR: This is not a valid CellTracGTS request');
          response.end();
          return;
    }

    // is user is logged try it now
    var device = this.gateway.activeClients [devid];
    if (device === undefined) {
        Debug (5,"New CellTrac Device id=%s devid=%d", query.id, devid);
        device= new HttpClient(this, devid);
        // force authent [due to DB delay we may refuse first NMEA packets]
        
        device.LoginDev ({devid: devid});
    }

    // we refuse packet from device until it is not log by DB backend
    if (device.logged !== true) {
        // leave 1s for DB to authenticate device before closing request
        this.Debug (4,"Device not login: EMEI=%s", devid);
        setTimeout(function(){response.end();}, 1000);
        return;
    }

    // if parsing abort then force line as invalid
    if (query.gprmc) {
        var data = new NmeaDecode(query.gprmc);
        if (data.valid) {
            this.Debug (7,"--> NMEA Lat:%s Lon:%s Sog:%d Cog:%d Alt:%d Date:%s"
                       , data.lat, data.lon, data.sog, data.cog, data.alt, data.date);
            data.cmd = TrackerCmd.GetFrom.TRACK;
            device.ProcessData (data);
        }    
        result = "OK";
    } else result = "FX";
    
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

