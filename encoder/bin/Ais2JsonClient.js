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


/* 
 * This is a very small debuging application, its connects onto
 * an AIS binary feed and display received packet on stdout
 * 
 * Ais2JsonClient
 *    --port=xxxx        // remote tcp port [no default] 
 *    --hostname=xxxx    // remote host [default: localhost]
 *    --mmsi=xxxx        // optional filter display only mmsi
 *    --type=xxxx        // optional filter display only msg type
 *    --dumpfile=xxxx    // optional copy on a output file
 *    --verbose=1        // display incoming binary NMEA paquet
 *    --debug=xx         // debug level [0-9]
 *
 * Examples:
 *     Ais2JsonClient --hostname=geotobe.net --port=4001
 *     Ais2JsonClient --hostname=geotobe.net --port=4001 --type=3 --mmsi=123456789
 *             
 * Note: any non AIVDM paquet is silently ignored
 */

'use strict';

var AisDecode; // if GeoGate development tree uses local modules
if  (process.env.GEOGATE !== 'dev') AisDecode = require('ggencoder').AisDecode;
                                          else AisDecode = require("../../encoder/ApiExport").AisDecode;

var async    = require("async");
var net      = require('net');
var jison    = require("jison").Parser;
var fs       = require('fs');

// static variables [not clean, but easy :)]
var DumpFd     = null;
var MmsiFilter = null;
var TypeFilter = null; 
var MsgCount   = 0;
var Verbose    = false;

// This routine is called to notify Async APO that current job is processed
var QJcallback = function () {};
    
// Notice method is called by async within unknow context !!!!
var QJpost  = function (job, callback) {
    
    // decode AIS message ignoring any not AIDVM paquet
    var nmea= job.toString ('ascii');
    var ais = new AisDecode (nmea);


    // if message valid and mssi not excluded by --mmsi option
    if (ais.valid) {
        // Some cleanup to make JSON/AIS more human readable
        delete ais.bitarray;
        delete ais.valid;
        delete ais.length;
        delete ais.channel;
        delete ais.repeat;
        delete ais.navstatus;
        delete ais.utc;
        ais.lon = (parseInt(ais.lon * 10000))/10000;
        ais.lat = (parseInt(ais.lat * 10000))/10000;
        ais.sog = (parseInt(ais.sog * 10))/10;
        ais.cog = (parseInt(ais.cog * 10))/10;

        // we do not need class for each navigation report
        if (ais.msgtype === 18 || ais.msgtype === 3) {
            delete ais.class;
        }
        MsgCount ++;
        // push AIS usefull info to user
        if (DumpFd !== null) {
            fs.writeSync (DumpFd,MsgCount + " , " +JSON.stringify (ais)+'\n');
        }
        if ((MmsiFilter===null || MmsiFilter===parseInt(ais.mmsi)) 
           && (TypeFilter===null || TypeFilter===parseInt(ais.msgtype))){
           console.log ("-%d- %s", MsgCount, JSON.stringify (ais));
        }
        if (Verbose) console.log ("-%d- %s", MsgCount, nmea)

    } else {
        if (Verbose) console.log ("\n-***- %s", nmea)
    }

    // we're done let's move to next job in queue
    callback();
};


function Ais2Json (command, args) {
   var cmdgrammar = {  
    "lex": {
        "rules" : [ ["\\s+" , "return 'BLK';"]
            ,['--hostname=' , "return 'HOS';"]
            ,['--host='     , "return 'HOS';"]
            ,['--port='     , "return 'PRT';"]
            ,['--mmsi='     , "return 'IME';"]
            ,['--type='     , "return 'MSG';"]
            ,['--dumpfile=' , "return 'DUM';"]
            ,['--debug='    , "return 'DEB';"]
            ,['--verbose'   , "return 'VER';"]
            ,['--help'      , "return 'HLP';"]
            ,[','           , "/* ignore */"]
            ,['([0-z)|[-]|[\\.]|[\\/])+'  , "return 'TEX';"]
            ,['$'           , "return 'EOL';"]
        ]
    },  // end Lex rules
    
    "bnf": { // WARNING: only one space in between TOKEN ex: "STOP EOF"
        'opts':  [
            ["OPTIONS EOL" , "return (this);"]
        ]
        ,'OPTIONS': [['OPTION', ""]
           ,['OPTION BLK', ""]
           ,['OPTIONS OPTION BLK', ""]
           ,['OPTIONS OPTION', ""]
        ]
        ,'OPTION' : [["EOL"      , "return (this);"]
           ,['HOS TEX'  ,"this.hostname=$2"]
           ,['PRT TEX'  ,"this.port=parseInt($2)"]
           ,['IME TEX'  ,"this.mmsi=parseInt($2)"]
           ,['MSG TEX'  ,"this.type=parseInt($2)"]
           ,['DEB TEX'  ,"this.debug=$2"]
           ,['DUM TEX'  ,"this.dumpfile=$2"]
           ,['VER'      ,"this.verbose=true"]
           ,['HLP'      ,"this.help=true"]
           ]
    }};

    // instanciate command line parser
    var parser=new jison (cmdgrammar);
   
    try {this.opts = parser.parse (args.toString());}
     catch (err) {
        console.log ("Syntax error [please check --help] err=[%s]", err);
        this.error=true;
        return;
    }
    
    // get basename from command line
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];

    // if help call then display help and exit
    if (this.opts.help)  {
        console.log ("----------------------------------------------------------------------------------------------------------");
        console.log ("## Syntaxe:  %s --hostname=xxxx --port=xxxx [--mmsi=xxx] [--dumpfile=xxx] \\",bin);
        console.log ("----------------------------------------------------------------------------------------------------------");
        return(0);
    }
};

// ------- Public Methods --------------
Ais2Json.prototype.Debug = function(level, format) {  //+ arguments
    if (this.opts.debug >= level) {
        var args = [].slice.call(arguments, 1); // copy argument in a real array leaving out level
        this.message=util.format.apply (null, args);
        console.log ("-%d- %j", level, this.message);
    };
};;

Ais2Json.prototype.OpenDumpFile = function () {
    // if needed check dumpfile can be create
    if (this.opts.dumpfile !== undefined) {
        try {
            DumpFd= fs.openSync (this.opts.dumpfile, "w+");
        } catch (err) {
            console.log ("hoops file to open [%s] err=[%s]",this.opts.dumpfile, err);
            return (-1);
        }
    }
    return (0);
};

Ais2Json.prototype.TcpConnect = function () {
  
  // start Tcp Client
  if (this.opts.hostname === undefined) this.opts.hostname='localhost';
  var host=this.opts.hostname;
  var port=this.opts.port;
  
  // Client suceded connected to remote server
  function TcpClientConnect () {
  };
    
  // Client receive data from server
  function TcpClientData (buffer) {
    // Send Data for processing directy to adapter
    QJhandle.push (buffer, QJcallback);
  };

  // Remote server close connection
  function TcpClientEnd () {
    console.log ("Tcp connection ended");
    process.exit (-1);
  };
  
  // Remote server close connection
  function TcpClientError (err) {
    console.log ("Client connect to tcp://%s:%s err=%s",host, port, err);
    this.end();
    process.exit (-1);
  };
    
  
  this.tcpClient           = net.createConnection(this.opts.port, this.opts.hostname);
  this.tcpClient.ais2json  = this; // export Debug method inside socket context
  this.tcpClient.on('connect', TcpClientConnect);
  this.tcpClient.on('data'   , TcpClientData); 
  this.tcpClient.on('end'    , TcpClientEnd);
  this.tcpClient.on('error'  , TcpClientError);
  
  // create Job Queue
  var QJhandle = async.queue  (QJpost, 1); // try to advoid two ais report at the same time
  MmsiFilter= parseInt (this.opts.mmsi) || null;
  TypeFilter = parseInt (this.opts.type) || null;
  return (0);
};

// #### Main Start #####
var command= process.argv[1];
if (process.argv.length < 3) {
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];
    console.log ("Error: %s '--hostname=xxx --port=xxx' mandatory argements missing [try --help]",bin);
    process.exit (-1);
}

// try to parse command
var aisclient=new Ais2Json(command, process.argv.slice(2)); 
    
// parsing failed ?
if (aisclient.error) process.exit (-1);

// expand verbose option at global level
if (aisclient.opts.verbose) Verbose = true;

// user select --help exit silently
if (! aisclient.opts.help) {
    var status = aisclient.TcpConnect ();
    if (status === 0)  status = aisclient.OpenDumpFile();
    if (status !== 0) process.exit();
}
 

