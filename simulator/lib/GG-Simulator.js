
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

/*
 * GGsimulator class simulate a GPS/AIS receiver/transponder.
 * It takes input from gpx route/track file, supports OpenCPN/VisuGPX export
 * format, and hopefully while not tested many other GPX format may work.
 * 
 * GGsimulator generate intermediary positions automatically. It takes each subsegment
 * of your route/track. Computes intermediary positions depending on your selected
 * sog/tic. Sends Position Event with intermediary lon/lat/sog/cog info.
 * Stops or loop at file end depending on the option.
 *
 * Usage:
 *  simulator = new Simulator ({gpxfile: xxxx, mmsi: 1234, shipname:xxxx ...
 *  simulator.event.on("position",MyEventHandler);
 * 
 *  you can generate GPX files with:
 *  - opencpn or any other navigation software
 *  - upload gpx file from most GPS devices
 *  - create oneline with http://www.visugpx.com/editgpx/
 *  - http://events.paudax.com/content/planning-your-diy-perm-route-google-maps
 *  
 * 
 */

'use strict';

var util     = require("util");
var fs       = require('fs');
var path     = require('path');
var net      = require('net');
var async    = require("async");
var sgeo     = require('sgeo');        // https://www.npmjs.org/package/sgeo
var xml2js   = require('xml2js');      // https://github.com/Leonidas-from-XIV/node-xml2js
var EventEmitter    = require("events").EventEmitter;

/*
 * GGsimulator uses an async queue to push event at tic rate
 * each gpx segment is processed in one chuck. Every intermediary
 * positions of a given segment are push in synchronous mode.
 * then tic handler pop the queue at requested value and emit event
 * toward the application. When queue is empty JobQueueEmpty callback
 * process next segment.
 */

function QJob (simulator, lon, lat, sog, cog, count) {
    this.simulator= simulator;
    this.lon      = lon;
    this.lat      = lat;
    this.cog      = parseInt ((parseFloat(cog)+ (Math.random()*5)-2.5)*10)/10;
    this.sog      = parseInt ((parseFloat(sog)  + (Math.random()*5)-2.5)*100)/100;
    this.count    = count;
}

// push a dummy job in queue to force activatio
function JobQueueEmpty () {
        this.simulator.ProcessSegment.call (this.simulator);
}

// Notice method is called by async within async context !!!!
function JobQueuePost (job, callback) {
    // dummy job to activate jobqueue
    if (job === null) {
        callback ();
        return;
    } else {
        // force change to simulator context
        job.simulator.NewPosition.call (job.simulator, job);
    }
    // wait tic time before sending next message
    job.simulator.queue.pause ();
    // provide some randomization on tic with a 50% fluxtuation
    var nexttic = parseInt (job.simulator.ticms * (1+ Math.random()/2));
    setTimeout(function () {job.simulator.queue.resume();}, nexttic);
    callback ();
}


function GGsimulator (opts) {
    this.valid=true; // in code we trust :)
    var random = parseInt (Math.random() * 1000000000);

    // provide some default values
    this.opts= {
            gpxfile    : opts.gpxfile  || null,           // no default for gpxfile
            mmsi       : opts.mmsi     || random,         // default fake mmsi
            sog        : opts.sog      || 12,             // m/s = 8knts
            tic        : opts.tic      || 10,             // 10s
            debug      : opts.debug    || 3,              // default no debug
            cargo      : opts.cargo    || 36,             // default sailing vessel
            uway       : opts.uway     || 8,              // default sailing 
            len        : opts.length   || 15,             // Ship length
            wid        : opts.width    || 4,              // Ship width
            draught    : opts.draught  || 3,              // Ship width
            loopwait   : opts.loopwait || 0,              // Sleep time before restating route
            dumpfile   : opts.dumpfile || null,           // filename for log file or NMEA generated commands
            shipname   : opts.shipname || "GG"+ random,
            callsign   : opts.callsign || "FX"+ random,
            class      : opts.class    || "B", // AIS class A|B
            randomize  : opts.randomize|| 0    // +-Math.Random/opts.randomize to Longitude/Latitude
    };

    this.Debug (7, "Main Options:  gpxfile=%s shipname=%s mmsi=%s sog=%d tic=%d ", this.opts.gpxfile
               , this.opts.shipname, this.opts.mmsi, this.opts.sog, this.opts.tic);

    // check --gpxfile is present and filename exite
    if (this.opts.gpxfile === null) {
        console.log ("Error: --gpxfile=xxxx [xxx must be a valid gpx file]");
        this.valid=false;
    } else {
        this.opts.basename = path.basename (this.opts.gpxfile);
        try {!fs.statSync (this.opts.gpxfile).isFile();}
        catch (err) {
            console.log ("Error: --gpxfile=%s err=%s", this.opts.gpxfile, err);
            this.valid=false;
        }
    }

    if (opts.mmsi === 0) this.opts.mmsi = 0; // special case for GPRMC formating
            
    // openfile and read store it in a buffer string
    try {
        if (this.valid)this.xmlData = fs.readFileSync (this.opts.gpxfile, "utf-8");
    } catch (err) {
        this.Debug (0, "Hoops gpxfile=%s err=%s", this.opts.gpxfile, err);
        this.valid=false;
    }
    
    // if needed check dumpfile can be create
    if (this.opts.dumpfile !== null) {
        try {
            this.dumpfd= fs.openSync (this.opts.dumpfile, "w+");
        } catch (err) {
            console.log ("hoops file to open [%s] err=[%s]",this.opts.dumpfile, err);
            return;
        }
    }
    
    // Process XLM/GPX route/track File (result in this.route)
    if (this.valid) this.route = this.ProcessGPX();
    if (this.route === null) {
        this.valid = false;
    }
    
    // if error within options, stop here
    if (!this.valid) {
        console.log ('\n## GGsimulator Abort [check options] ##\n');
        return;
    }
    this.uid = "GGsimulator//mmsi:" + this.opts.mmsi;

    // Create an event handler for user apps
    this.event = new EventEmitter();
    
    // migh want to check your waypoint before moving any further
    this.Debug (2, "Gpx Route=[%s] Waypts=[%d]", this.route.name, this.route.count);
    for (var pts in this.route.waypts) {
        this.Debug (3, "GPX waypts %d -- name: %s  Lon: %s Lat:%s", pts, this.route.waypts [pts].name, this.route.waypts [pts].lat, this.route.waypts [pts].lon);
    }
    
    // Route segment are process each time job queue is empty
    this.queue           = async.queue (JobQueuePost, 1);
    this.queue.simulator = this;
    this.segment         = 0;                    // next segment to process counter
    this.count           = 0;                    // stat on NMEA packets
    this.ticms           = this.opts.tic * 1000; // node.js timer are in ms
    this.queue.drain     = JobQueueEmpty;        // empty queue callback

    // 1st segment is activate here, JobQueueEmpty will activate next ones
    this.Debug (1,"Simulation Started mmsi=%s shipname=%s", this.opts.mmsi, this.opts.shipname);
    this.ProcessSegment();

}

// JobQueue is empty let's process next segment
GGsimulator.prototype.ProcessSegment = function () {
    // push a dummy job in queue to force activation

    function JobQueueActivate(queue, callback, timeout) {
        setTimeout(function () {queue.push (null, callback);}, timeout); // wait 5S before start
    }

    // Callback notify Async API that curent JobQueue processing is done
    function JobCallback (job, callback) {
        // Nothing to do
    }


    // each time job queue is empty we process a new segment
    if (this.segment < this.route.count-1) {
        
        // this is working segment
        var segstart = this.route.waypts  [this.segment];
        var segstop  = this.route.waypts  [this.segment+1];
        
        // compute segment distance
        var p1   = new sgeo.latlon(segstart.lat, segstart.lon);
        var p2   = new sgeo.latlon(segstop.lat, segstop.lon);
        var distance = p2.distanceTo(p1);

        // compute intemediary point sog/distance ration
        var sogms = this.opts.sog * 1.852/ 3600;  // sog from knts to meter/second
        var tmmsins = distance/sogms;               // time in second for this segment
        var inter   = Math.round (tmmsins / this.opts.tic);  // number of intemediary segments
        
        this.Debug (5, "segment %d -- from:%s to:%s distance=%dnm midsegment=%d", this.segment, segstart.name, segstop.name, distance/1.852, inter);

        var statics =  // statics report
            { type       : 1
            , mmsi       : this.opts.mmsi
            , shipname   : this.opts.shipname
            , class      : this.opts.class
            , cargo      : this.opts.cargo
            , callsign   : this.opts.callsign
            , draught    : this.opts.draught
            , length     : this.opts.len
            , width      : this.opts.wid
        };
        this.Debug (4,"Emit Static=%j", statics);
        this.event.emit ("statics", statics);

        // calculate intermediary waypoint and push them onto NMEA job queue
        var interpolated = p1.interpolate(p2, inter);
        var inter1= interpolated[0];
        this.Debug (6, "Computing [%s] segment [%d/%d] ", this.route.name, this.segment, this.route.count);
        if (this.dumpfd !== undefined) {
            fs.writeSync (this.dumpfd, "\n$ROUTE:[" +this.route.name +"] SEGMENT:[" + this.segment + "/" + this.route.count +"]\n");
        }
        for (var inter=1; inter < interpolated.length; inter ++) {
            this.count ++;
            var inter2 = interpolated[inter];
            // push waypoint to the queue
            var job = new QJob (this, inter1.lng, inter1.lat, this.opts.sog, inter1.bearingTo(inter2).toFixed(2), this.count);
            this.Debug (6, "Queue Intermediary WayPts N°%d %s cog: %s", this.count, inter1, job.cog);
            this.queue.push (job, JobCallback);
            inter1 = interpolated[inter];
            inter ++;
        }
        this.segment ++; // next time process next segment
    } else {
        this.Debug (6, "All [%d] segment from [%s] processed  [loop in %ss]", this.segment, this.opts.basename, this.opts.loopwait/1000);
        // if loop selected wait timeout and restart operation
        if (this.opts.loopwait > 0) {
            this.Debug (6, "Restarting route [%s]", this.opts.basename);
            this.segment = 0;
            JobQueueActivate (this.queue, this.callback, this.opts.loopwait);
        }
    }
};

// publish new position to listeners
GGsimulator.prototype.NewPosition  = function (job) {
    var position=
        { type       : 2  // position report
        , mmsi       : this.opts.mmsi
        , lat        : job.lat
        , lon        : job.lon
        , cog        : job.cog
        , hdg        : job.cog
        , sog        : job.sog
        };

    this.Debug (4,"Emit Position=%j", position);
    this.event.emit ("position", position);
};

// import Debug helper
GGsimulator.prototype.Debug = require('./_Debug');


// Process GPX file parse and send NMEA paquet
GGsimulator.prototype.ProcessGPX= function () {
    var route = {
        name  : "", // this.route name from gpx file
        count : 0,  // number of waypts/trackpts
        waypts:[]   // list of waypoint lat/lon
    };
    
    var opts= this.opts; // provide acces to opts during parsing.
    // process data return by XML2JSON
    var ParseGPX= function(err, result) {
        var data=[];
    
        // default route name if not present in XML
        var now=new Date();
        data.name= 'ParseGPX' + now.toISOString(); 
    
        // search for gpx tag
        if (result['gpx'] === undefined) {
            console.log ("Fatal: Not a GPX route/track file [no <gpx></gpx> tag]");
            return (-1);
        }
        // search for track tag
        if (result['gpx']["trk"] !== undefined) {
            // console.log ("track=%s", JSON.stringify(result['gpx']["trk"]));
            data = {
                mode    : 'track',
                name    : result['gpx']["trk"][0].name,
                segment : result['gpx']["trk"][0]["trkseg"][0]['trkpt']
            };
        }
        // search for route tag
        if (result['gpx']["rte"] !== undefined) {
            //console.log ("route=%s", JSON.stringify(result['gpx']["rte"]));
            data = {
                mode    :'route',
                name    :result['gpx']["rte"][0].name,
                segment :result['gpx']["rte"][0]["rtept"]
            };
        }
        if (data.mode === undefined) {
           console.log ("Fatal Not a valid GPX route/track file <trk>|<rte> tag");
           return (-1);
        }
    
        // provide a default name if nothing found in gpxfile
        if (data.name === undefined) {
            now= new Date();
            route.name = 'GGsimulator://' + opts.gpxfile + "/" + now.toISOString();
        } else {
            route.name = 'GGsimulator://' + data.name;
        }
    
        switch (data.mode) {
            case "track":
            var spd, crs, alt,dat;
            for (var trackpts in data.segment)  {
                // console.log ("trackpts[%s]=%s", trackpts, JSON.stringify(data.segment[trackpts]));
                if (data.segment[trackpts]['name'] === undefined) nam= 'TrackPts-' + trackpts; 
                    else nam=data.segment[trackpts]['name'];
                
                lat=parseFloat (data.segment[trackpts]["$"].lat);
                lon=parseFloat (data.segment[trackpts]["$"].lon);
                spd=data.segment[trackpts]['sog'];
                crs=data.segment[trackpts]['course'];
                alt=data.segment[trackpts]['ele'];
                dat=data.segment[trackpts]['time'];
                //console.log ("name=%s  lat=%s lon=%s sog=%s course=%s alt=%s", nam, lat, lon, spd, crs, alt);
                route.waypts.push ({name: nam, lat: lat, lon: lon, date: dat});
                route.count++;
            }
            break;
        case 'route':
            var nam, lat, lon;
            for (var routepts in data.segment)  {
                // console.log ("routepts[%s]=%s", routepts, JSON.stringify(data.segment[routepts]));
                if (data.segment[routepts]['name'] === undefined)
                    nam= 'TrackPts-' + routepts;
                else
                    nam=data.segment[routepts]['name'];

                lat=parseFloat (data.segment[routepts]["$"].lat);
                lon=parseFloat (data.segment[routepts]["$"].lon);
                // console.log ("name=%s  lat=%s lon=%s", nam, lat, lon);
                route.waypts.push ({name: nam, lat: lat, lon: lon});
                route.count++;
            }
            break;
        }
    };

    // Create GPX parser and send file for parsing
    this.parser = new xml2js.Parser();
    try {
        this.parser.parseString(this.xmlData, ParseGPX);
    } catch (e) {
        this.Debug (0, 'Hoops GpxFile=[%s] err=[%s]', this.opts.gpxfile, e);
        return (null);
    }
    this.Debug (8,"XML parsed route=%s", route.name);
    return (route);
};


// if use as a main and not as a module try start test
if (process.argv[1] === __filename)  {
   var config =
      { gpxfile :    "../sample/gpx-file/opencpn-sample.gpx"
      , mmsi    : 1234 // my prefered fake MMSI
      , tic     : 1    // send a position every 10s
      , loopwait: 0    // stop at end of gpxfile
      , debug   : 5    // 4 allow us to see event emit without officially listening to them
   };
   var simulator = new GGsimulator (config);
}

module.exports = GGsimulator; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
