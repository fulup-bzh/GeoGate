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
    this.uid       = "adapter:gtcfree//" +  + controller.svcopts.port;;
    this.info      = 'GtcFree';
    this.debug     = controller.svcopts.debug;  // inherit debug from controller
    this.controller= controller;
    this.gateway   = controller.gateway;
    this.control   = 'http';
    this.Debug (1,"%s", this.uid);    
};

// send a commant to activate GPS tracker
DevAdapter.prototype.SendCommand = function(httpclient, action, arg1) {
        switch (action) {
        case TrackerCmd.SendTo.WELLCOME: break;
        case TrackerCmd.SendTo.LOGOUT:
            httpclient.LogoutDev ();
            break;  // active client is update at HttpClient level
        case TrackerCmd.SendTo.HELP:             // return supported commands by this adapter
                var listcmd=["LOGOUT", "HELP"];
                // push a notice HELP action event to gateway
                this.gateway.event.emit ("notice", "HELP", listcmd, this.uid, socket.uid);
                break;
        default: 
            this.Debug (1,"Hoops GtcFree has no command=[%s]", action);
            return (-1);     
        };
    // return OK status 
    this.Debug (5,"buffer=[%s]", this.packet);
    return (0);
};


// return a json object with device name and position
DevAdapter.prototype.QueryDevList = function(query, response) {
    var account = query['a'];
    var group   = query['g'];

    // start with response header
    var jsonresponse=
        {Account: account
        ,Account_desc: "Gpsd-" + account
        //,"TimeZone": "UTS"
        ,DeviceList: []
    };
     
    // loop on device list
    for (var devid in this.gateway.activeClients) {
        var device= this.gateway.activeClients [devid];
        // if device is valid and log then doit
        // if (device !== undefined && device.logged) {
        if (device !== undefined && device.stamp !== undefined) {
            jsonresponse.DeviceList.push (
                {Device     : device.devid
                ,Device_desc: device.name.replace(/ /g,'-')
                ,group      : group
                ,EventData: [
                    {Device: devid
                    ,Timestamp      : device.stamp.acquired_at
                    ,StatusCode     : 0
                    ,Speed          : device.stamp.sog
                    ,GPSPoint_lat   : device.stamp.lat
                    ,GPSPoint_lon   : device.stamp.lon
                }]
            });
        }

    };
    //console.log ("****JSON=%s", JSON.stringify(jsonresponse))
    response.writeHeader(200, {"Content-Type": "text/plain"});  
    response.write(JSON.stringify(jsonresponse));
    response.end();  
};

/* respoonse dev track sample
var test={"Account":"fulup-bzh","Account_desc":"Gpsd-fulup-bzh"
         ,"DeviceList":[
             {"Device":123456789,"Device_desc":"Fulup-HR37"
             ,"EventData":
                 [{"Device":123456789,"Timestamp":1413548858,"StatusCode":3,"Speed":6.8,"GPSPoint_lat":47.30231124565022,"GPSPoint_lon":-2.849232474089085}
                 ,{"Device":123456789,"Timestamp":1413548907,"StatusCode":2,"Speed":5.3,"GPSPoint_lat":47.29901180590435,"GPSPoint_lon":-2.8442291685556724}
                 ,{"Device":123456789,"Timestamp":1413548956,"StatusCode":1,"Speed":5.2,"GPSPoint_lat":47.29610186222867,"GPSPoint_lon":-2.8386510988197435}
                 ,{"Device":123456789,"Timestamp":1413549037,"StatusCode":0,"Speed":7.1,"GPSPoint_lat":47.29757485673534,"GPSPoint_lon":-2.8316258978899578}
        ]}]}
*/

// return a json object with device name and possition
DevAdapter.prototype.QueryDevTrack = function(query, response) {

    var account = query['a'];
    var list    = parseInt (query['l']);
    var devid   = query['d'];
    
    var device  = this.gateway.activeClients [devid];
    if (device === undefined) {
            this.Debug (1,"Device %s Quit", devid);
            response.writeHeader(200, {"Content-Type": "text/plain"});  
            response.write("DEV_QUIT");
            response.end(); 
            return;
        } 
        
    // DB callback return a json object with device name and possition
    var DBcallback = function(dbresult) {
        
        // start with response header
        var jsonresponse=
            {Account: account
            ,Account_desc: "Gpsd-" + account
            //"TimeZone": "UTS"
            ,DeviceList: [
                {Device     : device.devid
                ,Device_desc: device.name.replace(/ /g,'-')
                ,EventData: []    
        }]};
     
        // for Celltrack  loop is GeoJson reverse order
        var nnres = dbresult.length-1;
        if (nnres >= list-1) nnres=list-1;
        for (var i = nnres; i >= 0; i--) {    
            var pos = dbresult [i];
            jsonresponse.DeviceList[0].EventData.push (
                {Device         : device.devid
                ,Timestamp      : pos.date.getTime()/1000
                ,StatusCode     : i
                ,Speed          : pos.speed
                ,GPSPoint_lat   : pos.lat
                ,GPSPoint_lon   : pos.lon
            }); 
        };
    // call back take care of returning response to device in async mode
    response.writeHeader(200, {"Content-Type": "text/plain"});  
    response.write(JSON.stringify(jsonresponse));
    response.end(); 
    }; // end callback

   
    // loop on device last postion [warning: async mode]
    this.gateway.backend.LookupDev (DBcallback, devid, list);
};

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
    
    // for json request celltrack does not provide query.id !!!!    
    // nasty but fast check for /events/dev.json pathname
    if (question.pathname.length === 16) { 
        // group/dev  {"?a":"fulup-bzh","u":"demo-id","p":"MyPasswd","g":"all","l":"1"}
        // devices query={"?a":"fulup-bzh","u":"demo-id","p":"MyPasswd","d":"1","l":"20"}
        // query={"?a":"fulup-bzh","u":"demo-id","p":"MyPasswd","d":"demo1","l":"20"}
                
        // this is a device query [at least this is how I hunderstant it !!!
        if (query.g !== undefined) result = JSON.stringify(this.QueryDevList (query, response));
        if (query.d !== undefined) result = JSON.stringify(this.QueryDevTrack(query, response));
        // Warning: previous call might be asynchronous and result to device appen after this return
    } else {
        // at this point we need a query ID
        if (query.id === undefined) {
              this.Debug (2,"Hoops: query:id not found in Http Request");
              response.writeHeader(400, {"Content-Type": "text/plain"});
              response.write('ERR: Invalid IMEI in Http Request');
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
            setTimeout(function(){response.end()}, 1000);
            return;
        }

        // this is a position update and a synchronous call
        switch (query.cmd) { 
        case 'version':
            result = 'OK';
            break;
                  
        default:
            // if parsing abort then force line as invalid
            var data = new NmeaDecode(query.gprmc);
            if (!data.valid) {
                this.Debug (5,'GPRMC invalid nmeadata=%s', query.gprmc);
                result = "ERR-GPRMC";
            } else {
                this.Debug (7,"--> NMEA Lat:%s Lon:%s Sog:%d Cog:%d Alt:%d Date:%s"
                       , data.lat, data.lon, data.sog, data.cog, data.alt, data.date);
                device.ProcessData (data);
                result = "OK";
            }
        }
        response.writeHeader(200, {"Content-Type": "text/plain"});  
        response.write(result);
        response.end();      
    }
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
  console.log ("### Hoops GtcDroid-adapter no unit test");
};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

