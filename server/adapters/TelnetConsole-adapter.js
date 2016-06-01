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
 * Telnet-Adapter is a dummy adapter for debug purdev.stampe. 
 * it waits for a telnet connect and provide very few basic commands
 *  - lst [list all active devices]
 *  - snd devid command [arg1, ...]
 *  - quit
 */
'use strict';

var Jison     = require ("jison").Parser;
var Debug     = require ("../lib/_Debug");
var TrackerCmd= require ("../lib/_TrackerCmd");

var util   = require("util");


// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    
    // Define or LEX/Bison grammar to handle device packet
    var grammar = {
    "lex": {
        "rules" : [ ["\\s+" , "/* skip whitespace */"]
            // Lex rules==> smallest token after big/generic ones ex: 'b,'/'b', [A,C]/[a-Z], etc ...
            ,['help\\b'             , "return 'HELP';"]
            ,['quit\\b'             , "return 'QUIT';"]
            ,['ctrl\\b'             , "return 'CTRL';"]
            ,['back\\b'             , "return 'BACK';"]
            
            ,['evt\\b'              , "return 'EVTS';"]
            ,['start\\b'            , "return 'STAR';"]
            ,['on\\b'               , "return 'STAR';"]
            ,['stop\\b'             , "return 'STOP';"]
            ,['off\\b'              , "return 'STOP';"]
            
            ,['dev\\b'              , "return 'DEV';"]
            ,['list\\b'             , "return 'LIS';"]
            ,['login\\b'            , "return 'LOG';" ]
            ,['logout\\b'           , "return 'OUT';" ]
            ,['track\\b'            , "return 'TRK';" ]
            ,['info\\b'             , "return 'INF';" ]
            ,['track\\b'            , "return 'TRK';" ]
            
            ,['snd\\b'              , "return 'SEND';"]
            ,['all\\b'              , "return 'ALL';" ]

            ,['db\\b'               , "return 'BASE';"]
            ,['create\\b'           , "return 'CREA';"]
            ,['remove\\b'           , "return 'DROP';"]
            ,['search\\b'           , "return 'SEAR';"]
            ,['show\\b'             , "return 'SEAR';"]
            ,['init\\b'             , "return 'INIT';"]

            ,['[\',\"]'             , "/* ignored */" ]
            ,['[^ ]+\\b'            , "return 'TXT';" ]
            ,['\\n'                 , "return 'EOL';" ]
            ,[';'                   , "return 'EOL';" ]
            ,['$'                   , "return 'EOL';" ]
        ]
    },  // end Lex rules
    
    "bnf": { // WARNING: only one space in between TOKEN ex: "STOP EOF"
        'data': [["EOL"        ,"this.cmd='EMPTY'; return (this);"]
            ,["QUIT EOL"   ,"this.cmd='QUIT'   ; return (this);"]
            ,["HELP EOL"   ,"this.cmd='HELP'   ; return (this);"]
            ,["CTRL EOL"   ,"this.cmd='CONTROL'; return (this);"]
            ,["BACK EOL"   ,"this.cmd='BACKEND'; return (this);"]
            ,["COMMD EOL"  ,"return (this);"]

            ,["DEV LIS EOL"  ,"this.cmd='DEVLIST' ; return (this);"]
            ,["DEV ALL EOL"  ,"this.cmd='DEVALL' ; return (this);"]
            ,["DEV LOG TXT EOL"   ,"this.cmd='DEVIN'  ; this.devid=$3; return (this);"]
            ,["DEV OUT TXT EOL"   ,"this.cmd='DEVOUT' ; this.devid=$3; return (this);"]
            ,["DEV OUT ALL EOL"   ,"this.cmd='DEVOUT' ; this.devid=0;  return (this);"]
            ,["DEV TRK TXT EOL"   ,"this.cmd='DEVTRCK'; this.devid=$3; return (this);"]
            ,["DEV TRK ALL EOL"   ,"this.cmd='DEVTRCK'; this.devid=0;  return (this);"]
            ,["DEV INF TXT EOL"   ,"this.cmd='DEVINFO'; this.devid=$3; return (this);"]

            ,["BASE INIT EOL"     ,"this.cmd='DBINIT' ;return (this);"]
            ,["BASE DROP TXT EOL" ,"this.cmd='DBDROP' ; this.devid=$3;return (this);"]
            ,["BASE SEAR TXT EOL" ,"this.cmd='DBSEAR' ; this.devid=$3; this.args=5; return (this);"]
            ,["BASE SEAR TXT TXT EOL" ,"this.cmd='DBSEAR' ; this.devid=$3; this.limit=parseInt($4); return (this);"]
            ,["BASE CREA TXT TXT TXT TXT TXT TXT TXT ARGS EOL","this.cmd='DBCREA' ; this.devid=$3; this.mmsi=$4; this.callsign=$5; this.cargo=$6; this.length=$7; this.width=$8; this.model=$9; return (this);"]

            ,["EVTS STAR EOL" ,"this.cmd='EVTSTART' ; return (this);"]
            ,["EVTS STOP EOL" ,"this.cmd='EVTSTOP'  ; return (this);"]
           ] 
        ,'COMMD':[
            ,["SEND TXT ALL ARGS"     , "this.cmd='SEND'; this.action=$2; this.devid=0;"]
            ,["SEND TXT TXT ARGS"     , "this.cmd='SEND'; this.action=$2; this.devid=$3;"]
            ,["SEND TXT ALL"          , "this.cmd='SEND'; this.action=$2; this.devid=0;"]
            ,["SEND TXT TXT"          , "this.cmd='SEND'; this.action=$2; this.devid=$3;"]
            ,["SEND HELP TXT"         , "this.cmd='SEND'; this.devid=$3; this.action='help';"]
        ]
        ,'ARGS':[
             ["TXT"                   , "this.args=[$1];"]
            ,["ARGS TXT"              , "this.args.push ($2);"]
        ]
    }};

    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.control   = "tcpsock";
    this.info      = "Telnet";
    this.debug     = controller.svcopts.debug;  // inherit debug from controller
    this.Debug     (1,"uid=%s", this.uid);
    this.controller= controller;  // keep a link to device controller and TCP socket
    this.parser    = new Jison(grammar);
    this.request   = 0; // job request number for gateway queue
    try {
        this.prompt= controller.gateway.opts.name +"> ";
    } catch (err) {
        this.prompt= "GatewayTracker> ";
    }
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

// hook user event handler to receive a copy of messages
DevAdapter.prototype.HookEventHandler = function(socket, gateway) {
    var count = 0;
    var message;
    
    var EventHandlerQueue = function (status, job){
        message=util.format ("#-%d Queue Status=%s DevId=%s Command=%s JobReq=%d Retry=%d\n", count++, status, job.devId, job.command, job.request, job.retry);
        socket.write (message);
    };	
  
    // Events successful process by tracker adapter
    var EventHandlerAccept = function (device, data){
        message=util.format ("#-%d Action Devid:[%s] Name:[%s] Cmd:[%s] Lat:%d Lon:%d Speed=%d\n", count++, device.devid, device.name, data.cmd, data.lat, data.lon, data.sog);
        socket.write (message);
    };
    
     // Events on action refused by tracker adapter
    var EventHandlerError = function(status, info, adapter, client){
        message=util.format ("#-%d Notice Info=%s Data=%s Adapter=%s Client=%s\n", count++, status, info, adapter, client );       
        socket.write (message);
    };

    // socket closed let's clear event
    if (socket === null) {
        gateway.Debug(7, "Remove Telnet gateway event listener [%s]", gateway.uid);
        gateway.event.removeListener("queue" ,EventHandlerQueue);	
        gateway.event.removeListener("accept",EventHandlerAccept);	
        gateway.event.removeListener("error" ,EventHandlerError);	
    } else {
        // Events from queued jobs
        message=util.format ("> Hook On [Listening for gateway [queue|accept|notice] events\n");
        socket.write (message);
        // note: in order to make removal of listener dev.stampsible function should have a static name
        gateway.event.on("queue" ,EventHandlerQueue);	
        gateway.event.on("accept",EventHandlerAccept);	
        gateway.event.on("notice",EventHandlerError);
    }
};

// Method is called each time a new client connect
DevAdapter.prototype.ClientConnect = function (socket) {
    socket.write ("> type: help for support [evt to receive events]\n");
    socket.write (this.prompt);
};

// Method is called when a client quit a TcpClient adapter
DevAdapter.prototype.ClientQuit = function (socket) {
};

// Command received from TCP server
DevAdapter.prototype.SendCommand = function(socket, action, arg1) {
    var gateway = this.controller.gateway;
    
    switch (action) {
        case "LOGOUT": // warning at this point socket is not valid !!!
            this.HookEventHandler (null, gateway);
            break;
        case "HELP":  // return supported commands by this adapter
            var listcmd=["try: [help] command directly"];
            // push a notice HELP action event to gateway
            device.controller.gateway.event.emit ("notice", "HELP", listcmd, this.uid, socket.uid);
            break;
        default: 
            this.Debug (1,"Telnet ignored Command=[%s]", action);
            return (-1);
    }
    return (0);
};


// This routine is call from DevClient each time a new line arrive on socket
DevAdapter.prototype.ParseBuffer = function(socket, buffer) {
    var prompt=this.prompt;  // make prompt avaliable in timer :(
    var data, status;

    var JobCallback = function (job) {
        var msg = util.format (" --> [job:%s] command=%s devid=%s [sent]\n", job.request, job.command, job.devId);
        socket.write (msg);
    }; 
    
    // make our life simpler
    var gateway   = socket.controller.gateway;
    var adapter= socket.adapter;

    var line =  buffer.toString('utf8');  // socket buffer are not string
    try {
        data=this.parser.parse(line); // call jison parser
    } catch (err) {
        socket.write ("??? (Hoops) Unknown Command [help ???]\n");
        // socket.write (err + "\n");
        socket.write (prompt);
        return (255); // special ignore status return code
    }
        
    // final processing of data return from parser
    switch (data.cmd) {
        case "EMPTY":  // ignore empty lines           
            break;
        case "LOGIN":  // simulate a real login [parsed by DevClient]
            device.data=data;
            socket.write (prompt);
            return (0);
        case "HELP":   // better than no documentation :)
            socket.write ("> ---- help ----\n");
            socket.write (">   dev list                          [list logged devices]\n");
            socket.write (">   dev all                           [list every connected devices]\n");
            socket.write (">   dev track  xxxx                   [send track request to device devid=xxxx]\n");
            socket.write (">   dev info   xxxx                   [display avaliable last info from activeClient devid=xxxx]\n");
            socket.write (">   dev login  xxxx                   [simulate devid=xxxx login]\n");
            socket.write (">   dev logout xxxx                   [close client socket & force a full reconnect]\n");
            socket.write (">\n");
            socket.write (">   db init                           [if not exist create table in database]\n");
            socket.write (">   db create devid mmsi callsign cargo length/cm width/cm model name....name \n");
            socket.write (">   db remove xxxx                    [delete devices in database devid=xxx]\n");
            socket.write (">   db search xxxx                    [search last devices dev.stampitions in database devid=xxx]\n");
            socket.write (">\n");
            socket.write (">   snd cmd   xxxx|all [arg1..argn]   [send command=cmd to devid=xxxx]\n");
            socket.write (">   snd help  xxxx                    [check avaliable commands for devid=xxxx]\n");
            socket.write (">\n");
            socket.write (">   evt start                         [register a listener to receive event from gateway as user application does\n");
            socket.write (">   evt stop                          [stop event listener\n");
            socket.write (">\n");
            socket.write (">   ctrl                              [list controllers]\n");
            socket.write (">   back                              [display backend]\n");
            socket.write (">   quit                              [close connection]\n");
            break;
        case "DEVLIST": // list devices from gateway active list
            var count = 0;
            socket.write ("> List logged active devices \n");
            for (var devId in gateway.activeClients) {
                var dev= gateway.activeClients[devId];
                if (dev.logged) {
                    count ++;
                    var elapse= parseInt((new Date().getTime()- dev.lastshow)/1000);
                    
                    var info= util.format ("> -%d- devid/mmsi= %s Name= '%s' LastShow: %ds Adapter: %s\n"
                              , count, devId, dev.name, elapse, dev.adapter.info);
                    socket.write (info);

                }
            }
            if (count === 0) socket.write ("> - no active devices [try 'dev all']\n");
            break;
        case "DEVALL": // list devices from gateway active list
            var count = 0;
            socket.write ("> List all active devices \n");
            for (var devId in gateway.activeClients) {
                count ++;
                dev= gateway.activeClients[devId];
                var elapse= parseInt((new Date().getTime()- dev.lastshow)/1000);
                var info= util.format ("> -%d- devid/mmsi= %s Name= '%s' Logged=%s LastShow: %ss Adapter: %s\n"
                        , count, devId, dev.name, dev.logged, elapse, dev.adapter.info);
                    socket.write (info);
            }
            if (count === 0) socket.write ("> - no active devices [retry later]\n");
            break;
        case "EVTSTART": // register to listen gateway application events
            this.HookEventHandler (socket, gateway);
            break;
        case "EVTSTOP": // register to listen gateway application events
            socket.write ("> stop event listen\r\n");
            this.HookEventHandler (null, gateway);
            break;
            
        case "CONTROL": // list active controller for this gateway
            socket.write (">  List active device controller\n");
            for (var svc in gateway.controllers) {
                var ctrl= gateway.controllers[svc];
                socket.write ("> - uid=" + ctrl.uid + "\n");
            } 
            break;
            
        case "BACKEND": // list active backend for this gateway
            socket.write (">  Current Backend: " + gateway.backend.uid + "\n");
            break;
            
        case 'DBSEAR':
            try {
              // Ask DB backend to display on telnet socket last X position for devid=yyyy
              var DBcallback = function (dbresult) {
                if (dbresult === null || dbresult === undefined) {
                    this.Debug (1,"Hoops: no DB info for %s", data.devid);
                    return;
                }
                
                for (var idx = 0; (idx < dbresult.length); idx ++) {
                    var posi= dbresult[idx];
                    posi.lon = posi.lon.toFixed (4);
                    posi.lat = posi.lat.toFixed (4);
                    posi.sog = posi.sog.toFixed (2);
                    posi.cog = posi.cog.toFixed (2);
                    var info=util.format ("> -%d- Lat:%s Lon:%s Sog:%s Cog:%s Alt:%s Acquired:%s\n"
                    , idx, posi.lat, posi.lon, posi.sog, posi.cog, posi.alt, posi.acquired_at);
                    socket.write (info);
                 }
              };
              var lastpos = gateway.backend.LookupDev (DBcallback, data.devid, data.limit || 10);
              } catch(err) {
                this.Debug (0,"Error: DBsearch devid:%s err=%s", data.devid, err);
                socket.write ("> - devid: " + data.devid + "error requesting DBsearch backend\n");
              }
            break;
            
        case "DEVTRCK":  // track one or all active devices
            var job={command: TrackerCmd.SendTo.GET_TRACK
                ,gateway: gateway
                ,devId  : data.devid
                ,request: this.request++
            };
            gateway.queue.push (job, JobCallback); // push to queue
            socket.write ("--> queue:" + job.request);
            break;
            
        case "DEVINFO":  // print info avaliable from gateway activeClient array
              
            try {
                var dev=gateway.activeClients[data.devid];
                var stamp=dev.stamp;
                var elapse= parseInt((new Date().getTime()- dev.lastshow)/1000);
                var posi = {
                    lon: stamp.lon.toFixed (4),
                    lat: stamp.lat.toFixed (4),
                    sog: stamp.sog.toFixed (2),
                    cog: stamp.cog.toFixed (2),
                    alt: stamp.alt.toFixed (2)
                };
                var info= util.format ("> --- devid/mmsi= %s Name= '%s' LastShow: %ss Adapter: %s\n"
                              , data.devid, dev.name, elapse, dev.adapter.info);
                socket.write (info);
                info=util.format (">    Lat:%s Lon:%s Speed:%s Alt:%s Crs:%s Time:%s\n"
                             , posi.lat, posi.lon, posi.sog, posi.alt, posi.cog, stamp.gpsdate);
                 socket.write (info);
            } catch(err) {
                this.Debug (1,"Error: parsing Devid: %s Msg: %s", data.devid, err);
                socket.write ("> - devid: " + data.devid + "No Stamp Info [try dev track]\n");
            }
            break;
        case "DEVOUT":  // force a device to close tcp socket
            var job={command: TrackerCmd.SendTo.LOGOUT
                ,gateway: gateway
                ,devId  : data.devid
                ,request: this.request++
            };
            gateway.queue.push (job, JobCallback); // push to queue
            socket.write ("--> queue:" + job.request);
            break;
        case "DBINIT": // Create table in database
            status= gateway.backend.CheckTablesExits ();
            socket.write ("--> dbinit: done \n");
            break;
        case "DBCREA": // create a device within database backend
            var devname;
            var error=false;
            if (data.args.length > 0 ) {
                devname = data.args.join(" ");
            } else {
                devname = data.args;
            }

            var cmdcreate = {
                devname : devname
               ,callsign: data.callsign
               ,model   : data.model
               ,mmsi    : data.mmsi
               ,cargo   : data.cargo
               ,length  : data.length
               ,width   : data.width
            };

            for (var slot in cmdcreate) {
                if (cmdcreate [slot].length === 0) {
                    socket.write ("--> dbcreat: " + slot + "should be defined\n");
                    error=true;
                }
            }
            if (!error) {
                gateway.backend.CreateDev(data.devid, cmdcreate);
                socket.write("--> create:" + data.devid + "\n");
            }
            break;
        case "DBDROP": // create a device within database backend
            gateway.backend.RemoveDev (data.devid);
            socket.write ("--> drop:" + data.devid + "\n");
            break;
        case "SEND": // request action from device
            try {
                var job = {
                    command: TrackerCmd.SendTo[data.action.toUpperCase()],
                    gateway: gateway,
                    devId  : data.devid,
                    args   : data.args,
                    request: this.request++
                };
                gateway.queue.push (job, JobCallback); // push to queue
                socket.write ("--> queue:" + job.request);
            } catch (e) {
                socket.write ('--> unknown command: ' + data.action.toUpperCase() + '\n');
            }
            break;
        case "QUIT": // force closing of tcp connection
            socket.end();
            return (255);
            break;
        default:   
            socket.write (prompt);
            break;     
    };
    // wait 1/4s before rewriting prompt [most command will be finished]
    setTimeout(function () {socket.write (prompt);}, 250);
    // Telnet adapter alway return special 255 status code to DevClient
    return (255);
};


// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    // Add here any paquet you would like to test
    var testParser = {  Empty: ""
        ,"Start     " : "ctrl"
        ,"Quit      " : "quit"
        
        ,"List2     " : "dev  list"
        ,"Login     " : "dev  login    123456"
        ,"Logout1   " : "dev  logout   123456"
        ,"Logout2   " : "dev  logout   all"
        
        ,"Send2     " : "snd  help    123456789"
        ,"Send4     " : "snd  command 1234567 arg1"
        ,"Send5     " : "snd  command 1234567 arg1 arg2"
        
        ,"DBinit    " : "db init"
        ,"DBCreate  " : "db create devid mmsi callsign length width My Friendly Name"
        ,"DBRemove  " : "db remove 123456"
        ,"DBSearch1 " : "db search 123456"
        ,"DBSearch2 " : "db search 123456 10"
     
    };
    var dummy = [];  // dummy object for test
    dummy.debug = 9;
    var devAdapter  = new DevAdapter (dummy);
    // Jison is quite picky, heavy testing is more than recommended
    for (var test in testParser) {
        var line= testParser[test];
        console.log ("### %s = [%s]", test, line);
        var data=devAdapter.parser.parse(line);
        console.log ("--> cmd=%s devid=%s subaction=%s args=%j", data.cmd, data.devid, data.action, data.args);
    }
    console.log ("**** Telnet Parser Test Done ****");
};

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
