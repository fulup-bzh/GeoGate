#!/usr/bin/env node

/*
 * Copyright 2015 Fulup Ar Foll
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
 * Json2AIS waits on a given TCP port for incoming connection.
 * Transforms received JSON/AIS packet in NMEA binary Packet and push then on UDP
 * 
 * Json2AIS
 *    --adapter=xxxx     // adapter file
 *    --verbose=1        // display incoming binary NMEA paquet
 *    --debug=xx         // debug level [0-9]
 *
 * Examples:
 *     Json2AIS --adapter=./conf/DummyBackend.conf
 *
 */

'use strict';

var GGcontroller    =  require ('../lib/GG-Controller');

var jison           = require("jison").Parser;
var EventEmitter    = require("events").EventEmitter;

var Verbose  = false;

function Arguments (command, args) {
   var cmdgrammar = {  
    "lex": {
        "rules" : [ ["\\s+" , "return 'BLK';"]
            ,['--adapter='  , "return 'CON';"]
            ,['--port='     , "return 'PRT';"]
            ,['--hostname=' , "return 'HOS';"]
            ,['--host='     , "return 'HOS';"]
            ,['--debug='    , "return 'DEB';"]
            ,['--verbose'   , "return 'VER';"]
            ,['--help'      , "return 'HLP';"]
            ,[','           , "/* ignore */"]
            ,['[^,]+'       , "return 'TEX';"]
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
           ,['CON TEX'  ,"this.adapter=$2"]
           ,['DEB TEX'  ,"this.debug=$2"]
           ,['PRT TEX'  ,"this.port=$2"]
           ,['HOS TEX'  ,"this.hostname=$2"]
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
        console.log ("## Syntaxe:  %s --adapter=xxxx --port=xxxx [--verbose] \\",bin);
        console.log ("----------------------------------------------------------------------------------------------------------");
        return(0);
    }
};

// listen to application events
function ListenEvents (event) {
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
    event.on("queue",EventHandlerQueue);
    event.on("accept",EventHandlerAccept);
    event.on("notice",EventHandlerError);
};

// Adapters need a fake backend for connect and update
function FakeBackend () {};
    FakeBackend.prototype.Connect  =function() {
    if (Verbose) console.log ('Adapter: connected');
    };
    FakeBackend.prototype.UpdateDev=function (device, command) {
    if (Verbose) console.log ('Adapter: send command:%s', command);
    };

// #### Main Start #####
var command= process.argv[1];
if (process.argv.length < 3) {
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];
    console.log ("\nError: %s '--adapter=xxx' mandatory argument missing [try --help]",bin);
    process.exit (-1);
}

// try to parse command
var cli=new Arguments(command, process.argv.slice(2));
    
// parsing failed ?
if (cli.error) process.exit (-1);

// expand verbose option at global level
if (cli.opts.verbose) Verbose = true;

// user select --help exit silently
if (! cli.opts.help) {

    if (cli.opts.adapter === undefined) {
        console.log ("Hoops missing --adapter=xxxxx");
        process.exit();
    }
    var opts =
       { info: 'adapter ' + cli.opts.adapter
       , adapter:  cli.opts.adapter
       , port   :  cli.opts.port
       , debug  :  cli.opts.debug
    };

    // we need a minimal fake gateway to support adapters
    var gateway =
        { uid: 'Tracker2Json fake gateway'
        , opts : {services:[]}
        , controllers  : []
        , activeClients: []
        , debug :  cli.opts.debug
        , backend: new FakeBackend()
        , event:   new EventEmitter()
    };

    // instanciate a new controller to check adapter
    var controller = new GGcontroller (gateway, opts, "cli.opts.adapter");
    // In verbose mode we listen & display gateway events
    if (cli.opts.verbose) ListenEvents (gateway.event);
}
 

