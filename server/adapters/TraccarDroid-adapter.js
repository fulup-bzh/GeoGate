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
 * Old Traccar Protocol https://www.traccar.org/
 * New version of Traccer use OsmDroid adapter
 * 
 */


'use strict';

var Debug       = require("../lib/_Debug");
var TcpClient = require("../lib/_TcpClient");
var TrackerCmd  = require("../lib/_TrackerCmd");
var Jison = require("jison").Parser;
var util  = require("util");

// Adapter is an object own by a given device controler that handle data connection
function DevAdapter (controler)  {

    
    // Define or LEX/Bison grammar to handle device packet
    var grammar = {  
    "lex": {
        "rules" : [ [" +" , "/* skip whitespace */"]
            // Lex rules==> smallest token after big/generic ones ex: 'b,'/'b', [A,C]/[a-Z], etc ...
            ,['-[0-9]+\\.[0-9]+\\b' , "return 'FLOAT';"]
            ,['[0-9]+\\.[0-9]+\\b'  , "return 'FLOAT';"]
            ,['[0-9]+\\b'           , "return 'INT';"]  
            ,['\\*[a-h,0-9]*\\b'    , "return 'CHKSUM';"]
            ,['\\$PGID,'            , "return 'STA';"]
            ,['\\$TRCCR,'           , "return 'TRACK';"]
            ,['A,'                  , "return 'ALL';"]
            ,[','                   , "return 'SEP';"]            
            ,['\\r\\n'              , "return 'EOL';"]
            ,['\\n'                 , "return 'EOL';"]
            ,[';'                   , "return 'EOL';"]
            ,['$'                   , "return 'EOL';"]
        ]
    },  // end Lex rules
    
    "bnf": { // WARNING: only one space in between TOKEN ex: "STOP EOF"
        'data': [["EOL"      , "this.cmd='EMPTY'    ; return (this);"]           
                ,["LOG EOL"  , "this.cmd='LOGIN'    ; return (this);"]
                ,["TRK EOL"  , "this.cmd='TRACKER'  ; this.valid=true; return (this);"]
           ]
        // Because of LR reduction we have to duplicate line for each command
        ,'LOG' :  [ // $PGID,352519050984578*05\r\n
                    ["STA IMEI", "this.imei=$2"]]
                
        ,'TRK' :  [ // $TRCCR,20140908100846.499,A,47.618544,-2.760980,0.00,201.00,57.00,89,*16\r\n
                    ["TRACK FLOATSEP GPSDATA","this.date=$2;"]
        ]
        , 'GPSDATA' : [ // A,47.618544,-2.760980,0.00,201.00,57.00,89,*2c\r\n
                ["ALL FLOATSEP FLOATSEP FLOATSEP FLOATSEP FLOATSEP INTSEP CHKSUM"
                      ,"this.lat=parseFloat($2); this.lon=parseFloat($3); this.sog=parseFloat($4); this.cog=parseFloat($5); this.alt=parseFloat($6); this.battery=parseInt($7)"]
        ]
        , 'IMEI'       : [
                ["INT CHKSUM", "$$=$1"]
        ]
        , 'FLOATSEP'   : [
                ["FLOAT SEP", "$$=$1"]
        ]
        , 'INTSEP'   : [
                ["INT SEP", "$$=$1"]
        ]
    }};

    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.control   = 'tcpsock';
    this.info      = 'TraccarDroid';
    this.debug     =  controler.svcopts.debug;  // inherit debug from controler
    this.controler = controler;  // keep a link to device controler and TCP socket
    this.parser    = new Jison(grammar);
    this.Debug (1,"uid=%s", this.uid);    
};

// Import debug method 
DevAdapter.prototype.Debug = Debug;

// Clean up GPS data to make them device independant
DevAdapter.prototype.GpsNormalize =function(data) {

    if (data.date === undefined) {
        data.date  = new Date();        
    } else { 
        // Traccar Android data.time format '20140916191851.750'
        var y=data.date.substring (0,4);
        var m=data.date.substring (4,6)-1;  //warning january=0 !!!
        var d=data.date.substring (6,8);
        var h=data.date.substring (8,10);
        var n=data.date.substring (10,12);
        var s=data.date.substring (12,14);
        data.date = new Date (y,m,d,h,n,s);
    }
};


// send a commant to activate GPS tracker
DevAdapter.prototype.SendCommand = function(device, action, arg1) {
        var socket= device.socket;
        switch (action) {
            case "WELLCOME":break; // special init sequences
            case "LOGOUT":  break; // warning: socket not valid anymore
            case "HELP":  // return supported commands by this adapter
                listcmd=["LOGOUT","HELP"];  

                // push a notice HELP action event to daemon
                device.controler.daemon.event.emit ("notice", "HELP", listcmd, this.uid, socket.uid);
                break;
            default: 
             this.Debug (1,"Hoops T55 has no command=[%s]", action);
             return (-1);     
        };
    // return OK status 
    this.Debug (5,"buffer=[%s]", this.packet);
    return (0);
};

    
// Method is called each time a new client connect
DevAdapter.prototype.ClientConnect = function (socket) {
    // let's use TCP session to keep track of device
    socket.device = new TcpClient (socket);

    // attach line counter and tempry buffer to socket session
    socket.lineidx   = 0;                       // index within buffer
    socket.linebuf   = new Buffer (256);        // intermediary buffer
    socket.count     = 0;
};


// Method is called each time a client quit
DevAdapter.prototype.ClientQuit = function (socket) {
    socket.device.RequestAction ('LOGOUT');
};


// This routine is call from DevClient each time a new line arrive on socket
DevAdapter.prototype.ParseLine= function(socket, line) {
        var device=socket.device;
        var data;
       
       console.log (line);
       
        try {
            // parse data directly inside device object structure
            data=this.parser.parse(line); // call jison parser
        } catch (err) {
            console.log ( "Parsing Err:%s", err);
            this.Debug (5, "Parsing Err:%s Line:%s", err, line );
            socket.write ('Invalid TR05 data:' + line);
            return (-1);
        }
        
        // final processing of device.data return from parser
        switch (data.cmd) {
          case "LOGIN": {
                socket.write ("OK");
                break;
          };
          case "EMPTY": // just a promt for checking service
                socket.write ("gpsd-tracking: " +this.uid + " running\n");
                break;          
          default: {
                
            this.GpsNormalize (data);
            this.count = socket.count ++; 
            break;     
          };
        };
    
         // send parsed data to device
        data.cmd = TrackerCmd.GetFrom.TRACK;
        this.Debug (7,"Device=%s Data=%j", socket.device.uid, data);
        var status = socket.device.ProcessData (data);
        if (status < 0) {
            this.Debug (1,"Device=%s Ignored=%s", socket.device.uid, line);
        }
    return (status);
};

DevAdapter.prototype.ParseBuffer = function(socket, buffer) {
    this.Debug  (9, "request=[%s]", buffer);
    
    // split buffer multiple lines if any and remove \r\n
    for (var idx=0; idx < buffer.length; idx++) {
        switch (buffer [idx]) {
            case 0x0A: // new line \n
                var status = this.ParseLine (socket, socket.linebuf.toString ('ascii',0, socket.lineidx));
                socket.lineidx=0;
                break;
            case 0x0D: break;  // cariage return \r
            default: 
                socket.linebuf[socket.lineidx] = buffer [idx];
                socket.lineidx++;
            }
    }
};

// Jison is quite picky, heavy testing is more than recommended
DevAdapter.prototype.TestParser = function(testParser) {
    //var code = new Generator (grammar, opts).generate();
    // console.log(code);
    console.log ("\n#### Starting Test ####");
    for (var test in testParser) {
        var line= testParser[test];
        console.log ("### %s = [%s]", test, line);
        var data=this.parser.parse(line);
        console.log ("  --> Emei:%s Cmd:%s Lat:%s Lon:%s Date:%s Speed:%d Course:%d Altitude:%d", data.imei, data.cmd, data.lat, data.lon, data.date, data.sog, data.cog, data.alt);
    }
};

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    // Add here any paquet you would like to test
    var testParser = { Empty: ""
        ,"Start     " : "$PGID,352519050984578*05\r\n"
        ,"Track1    " : "$TRCCR,20140908100115.000,A,47.618587,-2.761109,0.00,291.00,50.00,89,*14\r\n"
        ,"Track2    " : "$TRCCR,20140908100219.999,A,47.618458,-2.761302,0.54,218.00,71.00,89,*1b\r\n"
        ,"Track3    " : "$TRCCR,20140908131113.999,A,47.623168,-2.778404,7.02,131.00,70.00,76,*1a\r\n"
        ,"Track4    " : "$TRCCR,20140908132727.249,A,47.618544,-2.761002,0.54  ,4.00 ,62.00,75,*15\r\n"
        ,"Track5    " : "$TRCCR,20140908152206.500,A,53.955156, 2.028544,304.00,57.00,0.00, 92,*36\r\n"
        ,"Track6    " : "$TRCCR,20140916204253.749,A,47.618555,-2.760980,0.00,151.00,0.00,91,*23;$TRCCR,20140916204558.249,A,47.618319,-2.760873,0.00,151.00,0.00,91,*29\r\n"
        ,"Track7    " : "$TRCCR,20140916204253.749,A,47.618555,-2.760980,0.00,151.00,0.00,91,*23\r\n$TRCCR,20140916204558.249,A,47.618319,-2.760873,0.00,151.00,0.00,91,*29\r\n"
    
    };
    var dummyControler = { test: true  // dummy object for test
      ,debug: 9
      ,svcopts: {port:9999}
    };
    
    var devAdapter  = new DevAdapter (dummyControler);
    devAdapter.TestParser (testParser);
    console.log ("**** T55 Parser Test Done ****");
}

module.exports = DevAdapter; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

