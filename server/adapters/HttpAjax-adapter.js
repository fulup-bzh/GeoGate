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
 * Object: Servs Ajax/Json REST request and basic html pages
 * 
 * Rest/Json 
 *   1) list all dev with current position [equivalent to telnet dev info].
 *   2) return the last xxx info about a given device [equivalent to db search]
 * Note: To bypass CORS constrains http://api.jquery.com/jquery.getjson/
 *   just add ?jsoncallback=? at the and your JSON URL
 *   jQuery/JsonP= "http://localhost:4001/geojson.rest?jsoncallback=?";
     jQuery/Json = "http://localhost:4001/geojson.rest";
 * Http/Pages
 *  Return HTML page, to solve (Cross-Origin Request) error, that browser raise
 *  when an Ajax request is sent to different destination.
 * Note: 
 * In production you should configure a real web server to server your HTML pages
 * but hopefully this one should be enough for your development.
 * 
 * References CORS (Cross-Origin Request): 
 *  http://www.html5rocks.com/en/tutorials/cors/
 *  http://geojson.org/geojson-spec.html
 *  http://leafletjs.com/examples/geojson.html
 *  http://leafletjs.com/examples/sample-geojson.js
 *  http://geojsonlint.com/ [online geojson validation]
 * Debug
 *  FireBug extension on firefox
 *  sudo tcpdump -i lo -A  port 8080 -c 10 [to verify Access-Control-Allow-Origin]
 */

'use strict';

var DEMO_API_KEY=123456789; // this is only good for demo and test !!!!

var Debug       = require("../lib/_Debug");
var util        = require("util");
var path        = require("path");
var url         = require("url"); 
var fs          = require('fs');

// Adapter is an object own by a given device controller that handle nmeadata connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.info      = 'HttpdAjax';
    this.debug     = controller.svcopts.debug;  // inherit debug from controller
    this.controller= controller;  // keep a link to device controller and TCP socket
    this.control   = 'http';
    this.cors      = controller.svcopts.cors || false;
    this.apikey    = parseInt (Math.random()*123456789876);  // should depend on user authentication
    
    // define root dir for html pages.
    if (controller.svcopts.rootdir !== undefined)  this.rootdir= controller.svcopts.rootdir;
    else  this.rootdir= path.join (__dirname, "../../www");
    
    this.Debug (1,"%s rootdir=%s", this.uid, this.rootdir);    
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

// This adapter ignore silently any command request
DevAdapter.prototype.SendCommand = function(httpclient, action, arg1) {
    return (0);
};


// return a json object with device name and possition
DevAdapter.prototype.QueryDevList = function(question, request, response) {
    var gateway = this.controller.gateway;
    var backend = gateway.backend;

    // start with response header // validate syntaxe at http://geojsonlint.com/
    var jsonresponse={"type":"FeatureCollection","features": []};
    var srchost=request.headers.host;
    var query=question.query;
    var now=new Date();
    
    // loop on device list
    for (var devid in gateway.activeClients) {
        var device= gateway.activeClients [devid];

        if (device !== undefined && device.stamp !== undefined) {
            var devinfo=util.format ("Name:%s DevId:%s Position:[%s,%s]",device.name, devid, device.stamp.lon.toFixed (4),device.stamp.lat.toFixed(4));
            var devurl =util.format ("[%s/geojson.rest,{key:%s,cmd:track,devid:%s,llist:%s}]",srchost, query.key, devid, query.llist||10);
         jsonresponse.features.push (
                {"type":"Feature"
                ,"geometry": 
                    {"type":"Point"
                    ,"coordinates" :[device.stamp.lon, device.stamp.lat]
                    ,'sog' : device.stamp.sog
                    ,'cog' : device.stamp.cog
                    ,'age' : parseInt ((now.getTime() - device.stamp.date.getTime())/1000) // report age in second
                },"properties":
                    {"type":"Properties"
                    ,"id"  : devid
                    ,"name": device.name
                    ,"title": devinfo
                    ,'url': devurl
                },"device":
                    {"type":"Device"
                    ,"class": device.class
                    ,"model": device.type 
                    ,"call": device.call
                    ,"img": device.img
                    ,"url": device.url
                }});       
             
        };
    };
    if (query.jsoncallback === undefined) {
        response.writeHead(200,{"Content-Type": "application/json"});  
        response.write(JSON.stringify(jsonresponse));
    } else {
        response.writeHead(200,{"Content-Type": "text/javascript",'Cache-Control':'no-cache'});  
        var fakescript=query.jsoncallback +'(' + JSON.stringify(jsonresponse) +');';
        response.write (fakescript);
    }
    response.end();  
};

// return a json object with device name and possition
DevAdapter.prototype.QueryDevTrack = function(question, request, response) {
    var gateway    = this.controller.gateway;
    var backend = gateway.backend;
    var srchost = request.headers.host;
    var query   = question.query;
    var device  = gateway.activeClients [query.devid];

    var devurl =util.format ("[%s/geojson.rest,{key:%s,cmd:track,devid:%s,llist:%s}]",srchost, query.key, query.devid, query.llist||10);
    
    // DB callback return a json object with device name and possition
    var DBcallback = function(dbresult) {
        // start with response header
        var jsonresponse= // validate syntaxe at http://geojsonlint.com/
          {"type":"GeometryCollection"
          ,"device":
            {"type":"Device"
            ,"class":device.class
            ,"model": device.model
            ,"call": device.call
          },"properties":
            {"type":"Properties"
            ,'id'  : query.devid
            ,"name": device.name
            ,'url': devurl
            ,'img': device.img
          }
          ,"geometries":[]             
          };       
     
        for (var idx in dbresult) {
            var pos = dbresult [idx];
            var ptsinfo=util.format ("%s<br>Position:[%s,%s] Speed:%s",pos.date,pos.lon.toFixed(4),pos.lat.toFixed(4),pos.sog.toFixed(1));
            jsonresponse.geometries.push (
                   {'type':'Point'
                    ,'coordinates' :[pos.lon, pos.lat]
                    ,'sog' : pos.sog
                    ,'cog' : pos.cog
                    ,'date' : pos.date.getTime()
                    ,'properties'  :
                        {'type':'Properties'
                        ,"title": ptsinfo 
                    }});
           };
    if (query.jsoncallback === undefined) {
        response.writeHead(200,{"Content-Type": "application/json"});  
        response.write(JSON.stringify(jsonresponse));
    } else {
        response.writeHead(200,{"Content-Type": "text/javascript",'Cache-Control':'no-cache'});  
        var fakescript=query.jsoncallback +'(' + JSON.stringify(jsonresponse) +');';
        response.write (fakescript);
    }      
    response.end(); 
    }; // end callback
    
    // in case client quit since last phone device list update
    if (device === undefined) {
        response.writeHead(404,"DEV_QUIT", {"Content-Type": "text/html"});  
        response.write('DEV_QUIT');
        response.end();
        return;
    }

    // loop on device last postion [warning: async mode]
    gateway.backend.LookupDev (DBcallback, query.devid, parseInt(query.llist)||10);
};

// Do basic REST authentication and dispatch request
DevAdapter.prototype.ProcessRestApi = function(question, request, response) {
    var query=question.query;

    // check user key [in real world should be more serious than this :)
    var querykey=parseInt (query['key']);
    if (querykey !== this.apikey &&  querykey !== DEMO_API_KEY ){
        response.writeHeader(200, {"Content-Type": "text/plain"});  
        response.write("NOT_AUTH");
        response.end();
        return;
    }
    
    switch (query.cmd) {
        case 'list' : // 'http://localhost:4080/geojson.rest?key=123456789&cmd=list&group=all'
            this.QueryDevList  (question,request,response);
            break;
        case 'track': // 'http://localhost:4080/geojson.rest?key=123456789&cmd=track&devid=123456789&llist=5'
            this.QueryDevTrack (question,request,response);
            break;
        default: 
            response.writeHeader(200, {"Content-Type": "text/plain"});  
            response.write("UNK_CMD");
            response.end();
    }
};

// Read a file and sent it as it to the browser
DevAdapter.prototype.ProcessFile = function(question, request, response) {
    
    // push file back onto response HTTP response handler
    function ReadFileCB (err, byteread, buffer) {
        if (err) {
            response.write(err.toString());
        } else {
            response.write(buffer);
        }
        response.end(); 
    }
    
    // open file and check if its supported
    function OpenFileCB (err, fd) {
        if (err) {
            response.setHeader('Content-Type','text/html');
            response.writeHead(404, err.toString("utf8"));
            response.write("Hoops:" +  err );
            response.end();
            return;
        }
        fs.fstat(fd, function(err,stats){
            // get file size and allocate buffer to read it
            var buffer = new Buffer (stats.size);
            fs.read (fd, buffer,0,buffer.length,0,ReadFileCB);
        });
    }

    // Need to be known: nodejs files handling method are asynchronous
    var  fullpath =path.join (this.rootdir, question.pathname);
    fs.open(fullpath, 'r', OpenFileCB);
};
    

// This routine is called from GpsdController each time a new http request popup
DevAdapter.prototype.ProcessData = function(request, response) {
    var gateway=this.controller.gateway;
    var question=url.parse(request.url, true, true);
    this.Debug (4,"Path=%s Query=%s", question.path, JSON.stringify(question.query));
    
    // sign or respond with a specific servername header
    response.setHeader("Server", "GeoGate-HttpAjax");
    // provide a default search to index.html
    if (question.pathname === '/') {
        question.pathname = "html/index.html";
        response.writeHead(302, {'Location': 'html/index.html'});
        response.end();
        return;
    }
        
    // check extension we only support html,js,css
    var extension=path.extname(question.pathname).toLowerCase();
    if (extension === '') {
        extension='.html';
        question.pathname = question.pathname + extension;
    }
    
    switch (extension) {
    case ".rest":
    case ".json":
        this.ProcessRestApi (question,request,response);
        break;
    case ".html":
        if (this.cors)  response.setHeader("Access-Control-Allow-Origin","*");
        response.setHeader("Content-Type", "text/html");
        this.ProcessFile (question,request,response);
        break;
    case '.js':
        response.setHeader("Content-Type", "text/javascript");
        // add special variable directly inside JavaScript to enable JSON/JsonP profile selection
        response.write ("var HTTP_AJAX_CONFIG={JSONP: false, GPSD_API_KEY:" + this.apikey +"};");
        this.ProcessFile (question,request,response);
        break;
    case '.css':
        response.setHeader("Content-Type",  "text/css");
        this.ProcessFile (question,request,response);
        break;
    case '.png':
        response.setHeader("Content-Type",  "image/png");
        this.ProcessFile (question,request,response);
        break;
    case '.jpg':
    case '.jpeg':
        response.setHeader("Content-Type", "image/jpeg");
        this.ProcessFile (question,request,response);
        break;
    case '.svg':
        response.setHeader("Content-Type", "image/svg+xml");
        this.ProcessFile (question,request,response);
        break;
    case '.woff':
        response.setHeader("Content-Type", "application/font-woff");
        this.ProcessFile (question,request,response);
        break;
    case '.ttf':
        response.setHeader("Content-Type", "application/x-font-ttf");
        this.ProcessFile (question,request,response);
        break;
    default:
        response.writeHead(404, "unsupported extension", {'Content-Type': 'text/html'});
        response.write("Unsupport file type ext:" + extension );
        response.end();    
    }
};
    
// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
  console.log ("### Hoops HtmlBasic-adapter no unit test");
};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/