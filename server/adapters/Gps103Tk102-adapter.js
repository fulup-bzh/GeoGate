/* 
 * Copyright 2014 Fulup Ar Foll.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http//www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 */

'use strict';

var util = require("util");
var Debug = require("../lib/_Debug");
var TcpClient = require("../lib/_TcpClient");
var TrackerCmd= require("../lib/_TrackerCmd");

// Adapter is an object own by a given device controller that handle data connection
function DevAdapter (controller) {
    this.id        = controller.svc;
    this.uid       = "//" + controller.svcopts.adapter + "/" + controller.svc + ":" +  controller.svcopts.port;;
    this.control   = 'tcpsock';
    this.info      = 'Tk102-Gps103';
    this.debug     = controller.svcopts.debug;
    this.controller= controller;
    this.Debug (1,"uid=%s", this.uid);
};

DevAdapter.prototype.ProcessDate = function (info, utc) {
    var date;
    // Note: process is preset globaly for UTC in GpsDaemon
    if (info === undefined) {
        date  = new Date().getTime();
    } else {
        // TK103 data.time format "1409152220"
        var y='20' + info.substring (0,2);
        var m=info.substring (2,4)-1;  //warning january=0 !!!
        var d=info.substring (4,6);
        var h = info.substring(6, 8);
        var n = info.substring(8, 10);
        var s = info.substring(10, 12);
    }
    date = Date.UTC (y,m,d,h,n,s);
    return (date);
};


// tracker-command, 141111061820,,F,221824.000,A,4737.1076,N,00245.6550,W,0.04,0.00,,1,0,0.0%,,;"
DevAdapter.prototype.ParseTrackerGps = function (cmd, args) {
  var data;
  function  ProcessCardinal (val,uni) {
        // TK103 sample 4737.1024,N for 47°37'.1024
        var deg= parseInt (val/100);
        var min= val - (deg*100);
        var dec= deg + (min/60);

        if (uni === 'S' || uni === 'W' || uni === 'P') dec= dec * -1;
        return (dec);
  }

  function CheckArg (arg) {
        if (arg !== undefined) if (arg.length > 1) return (arg);
        else return 0;
  }

  // No Gps Data
  switch (args[4]) {
        case 'L' : // No GPS date
            data =
            { cmd: cmd
                , gps  : false
                , valid: false
                , devid: args[1].split(':') [1]
                , date: this.ProcessDate (args[2])
                , unk:  parseInt(args[3])

            };
            break;
        case 'F':  // Full Gps Date
            // console.log ("**** args length %s", args.length);
            // Try to clean up obvious wrong data
            if (isNaN (args[7]) ||  isNaN (args[9]) || isNaN (args[11]) || isNaN (args[12])) {
                return ({cmd: cmd, valid: false});
            }

            switch (args.length) {
                case 13: //old protocol [sms protocol 12]
                    data =
                    {
                        cmd: cmd,
                        gps: true,
                        valid: true,
                        devid: args[1].split(':') [1],
                        date: this.ProcessDate(args[2]),
                        arg: args[3],
                        utc: args[5],
                        lat: ProcessCardinal(args[7], args[8]),
                        lon: ProcessCardinal(args[9], args[10]),
                        //sog: parseInt (args[11] * 1853 / 360)/10,  // MS/S
                        sog: parseInt (args[11]*10)/10,  // KNTS
                        cog: args[12],
                        alt: -1
                    };
                    break;
                case 19: // new protocol [sms protocol123456 18]
                    data =
                    {
                        cmd: cmd,
                        gps: true,
                        valid: true,
                        devid: args[1].split(':') [1],
                        date: this.ProcessDate(args[2]),
                        arg: args[3],
                        utc: args[5],
                        lat: ProcessCardinal(args[7], args[8]),
                        lon: ProcessCardinal(args[9], args[10]),
                        //sog: parseInt (args[11] * 1853 / 360)/10, // MS/S
                        sog: parseInt (args[11]*10)/10,  // KNTS
                        cog: args[12],
                        alt: CheckArg(args[13]),
                        yyy: args[14],
                        zzz: args[15],
                        kkk: args[16]
                    };
                    break;
                default: data=null;
            };
            break;
        default:


  }
  return (data);
};
// tracker-command, 141111061820,,F,221824.000,A,4737.1076,N,00245.6550,W,0.04,0.00,,1,0,0.0%,,;"
DevAdapter.prototype.ParseTrackerObd = function (cmd, args) {

    function CheckArg (arg) {
        if (arg.length > 1) return (arg);
        else return '';
    }

    var data=
            { cmd: cmd
            , obd  : true
            , devid : args[1].split(':') [1]
            , date : this.ProcessDate (args[2])
            , trip : args[3]  // remaining fuel
            , rfuel: args[4]  // remaining fuel
            , afuel: args[5]  // Average Fuel
            , dtime: args[6]  // Driving time
            , speed: args[7]  // speed
            , pload: args[8]  // Power load
            , temp : CheckArg (args[9])   // Water Temperature
            , atp  : args[10] // Throttle %
            , rpm  : args[11] // RPM engine
            , bat  : args[12] // Battery Voltage
            , diag : args[13] // Diag code
            };
  return (data);
};

DevAdapter.prototype.ParseData = function (line) {
    var packetype;
    var data;

    // extract values from line
    var args = line.split (',');

    // check 1st character of 1st argument
    switch (args [0][0]) {
        case "#":     // Login "##,imei:359710043551135,A;"
            packetype= 0;
            break;
        case "i":     // Track "imei:865328021048227,...
            packetype= 3;
            break;
        case undefined:
            return (null);

        default:      // Ping  "359710043551135;"
            packetype= 2;
            break;
    }


    switch (packetype)  {
        case 0:   // Login "##,imei:359710043551135,A;"
            if (args[2] !== 'A') return (null);
            //extract devid
            var info = args[1].split(':');
            data =
              { cmd : TrackerCmd.GetFrom.LOGIN
              , devid: info[1]
              };
            break;

        case 2:  // Ping  "359710043551135;"
            if (isNaN(args[0])) return (null);
            data=
            { cmd  : TrackerCmd.GetFrom.PING
            , devid : args[0]
            };
            break;

        case 3: // every other tracker commands
            // console.log ("**** args[1].substring (0,2)=|%s|", args[1].substring (0,2))
            switch (args[1].substring (0,2)) {

                case 'OB': // ,OBD,141112020400,,,0.0,,000,0.0%,+,0.0%,00000,,,,,
                    data= this.ParseTrackerObd (TrackerCmd.GetFrom.OBD, args);
                    break;

                case 'tr': // tracker,141111061820,,F,221824.000,A,4737.1076,N,00245.6550,W,0.04,0.00,,1,0,0.0%,,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.TRACK, args);
                    break;

                case 'he': // help me,1409050559,1234,F,215931.000,A,4737.1058,N,00245.6524,W,0.00,0;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.HELPME, args);
                    break;

                case 'sp': // help me,1409050559,1234,F,215931.000,A,4737.1058,N,00245.6524,W,0.00,0;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.ALARMSPEED, args);
                    break;

                case 'lo': // low battery,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.BATLOW, args);
                    break;

                case 'st': // stokage,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.STOCKADEON, args);
                    break;

                case 'do': // door alarm,1010181112,00420777123456,F,101216.000,A,5004.5502,N,01426.7268,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.ALARMDOOR, args);
                    break;

                case 'ac': // acc alarm,1010181112,00420777123456,F,101256.000,A,5004.5485,N,01426.7260,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.ALARMACC, args);
                    break;

                case 'kt': // Resume Engine: kt,1010181052,00420777123456,F,095256.000,A,5004.5635,N,01426.7346,E,0.58,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.ENGINE_ON, args);
                    break;

                case 'jt': // Stop Engine: jt,1010181051,00420777123456,F,095123.000,A,5004.5234,N,01426.7295,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.ENGINEOFF, args);
                    break;

                case 'gt': // Turn alarm: gt,1010181046,00420777123456,F,094657.000,A,5004.5251,N,01426.7298,E,0.00,;
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.ALARMON, args);
                    break;

                case 'ht': // Speed on; ht,1010181032,00420777123456,F,093203.000,A,5004.5378,N,01426.7328,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.SPEEDON, args);
                    break;

                case 'mt': // Park off: mt,1010181029,00420777123456,F,092913.000,A,5004.5392,N,01426.7344,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.PARKOFF, args);
                    break;

                case 'lt': // Park On: lt,1010181025,00420777123456,F,092548.000,A,5004.5399,N,01426.7352,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.PARKON, args);
                    break;

                case 'et': // Stop SOS: et,1010181049,00420777123456,F,094922.000,A,5004.5335,N,01426.7305,E,0.00,;"
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.HELPOFF, args);
                    break;

                case 'it': // Set Time: it,141112230446,,F,110446.000,A,4737.1068,N,00245.6503,W,0.31,269.97,,1,0,0.0%,,
                    data= this.ParseTrackerGps (TrackerCmd.GetFrom.TIMEZONE, args);
                    break;

                default: data=null;
            }

            break;

        default: data=null;

    }

 return (data);
};

// Import debug method
DevAdapter.prototype.Debug = Debug;

/*
 * send a command to activate GPS tracker see protocol reference at
 *   http//old.forum.gps-trace.com/viewtopic.php?id=4108
 *   http//old.forum.gps-trace.com/viewtopic.php?id=4092
 */
DevAdapter.prototype.SendCommand = function(device, action, args) {
        var socket = device.socket;
        var param;
        var packet;

        switch (action) {
          case TrackerCmd.SendTo.WELLCOME: break; // special init sequence
          case TrackerCmd.SendTo.LOGOUT  :
              device.socket.end (); // force socket termination controller will call adapter logout function
              break; // warning socket not valid anymore
          // Get current position (1 position only)
          case TrackerCmd.SendTo.GET_TRACK: // **,devid999999999999999,B;
              packet= util.format ("**,devid:%s,B;", socket.device.devid);
              socket.write (packet);
              break;
          // Set multiple positions
          case TrackerCmd.SendTo.SET_TRACK_BY_TIME: // **,devid999999999999999,C,##x; [15m,60s]
              packet= util.format ("**,devid:%s,C,%s;", socket.device.devid,args);
              socket.write (packet);
              break;
          //  Stop sending positions
          case TrackerCmd.SendTo.STOP_TRACK: // **,devid999999999999999,d;
              packet= util.format ("**,devid:%s,D;", socket.device.devid,args);
              socket.write (packet);
              break;
          // Stop sending alarm messages (door alarm, acc alarm, power alarm, S.O.S. alarm)
          case TrackerCmd.SendTo.STOP_SOS: // **,devid999999999999999,E;
              packet= util.format ("**,devid:%s,E;", socket.device.devid);
              write (packet);
              break;
            // Set positioning by distance (tracker only sends position if vehicle has travelled XXXX meters)
          case TrackerCmd.SendTo.SET_BY_DISTANCE: // **,devid999999999999999,F,XXXXm;
                packet= util.format ("**,devid:%s,F,%s;", socket.device.devid, args);
                socket.write (packet);
                break;
            // Activate movement alarm if move more than 200m
          case TrackerCmd.SendTo.SET_MOVE_ALARM: // **,devid999999999999999,G;
              packet= util.format ("**,devid:%s,G,%s;", socket.device.devid, args);
              socket.write (packet);
              break;
          // Activate the speed alarm (send SMS if speed goes above XXX km/h)
          case TrackerCmd.SendTo.SET_SPEED_ALARM: // **,devid999999999999999,H,XXX;
                packet= util.format ("**,devid:%s,H,%s", socket.device.devid, args);
                socket.write (packet);
                break;
          // Set the timezone to GMT+0 (this tracker only works properly on gps-trace with timezone set to +0
          case TrackerCmd.SendTo.SET_TIMEZONE: //**,devid999999999999999,I,0;
                packet= util.format ("**,devid:%s,I,%s", socket.device.devid, args);
                socket.write (packet);
                break;
          // Stop/block the engine
          case TrackerCmd.SendTo.ENGINE_OFF:  //**,devid999999999999999,J;
                packet= util.format ("**,devid:%s,J", socket.device.devid);
                socket.write (packet);
                break;
          // Resume/unblock the engine
          case TrackerCmd.SendTo.ENGINE_ON: //**,devid999999999999999,K;
                packet= util.format ("**,devid:%s,K", socket.device.devid);
                socket.write (packet);
                break;
          // Arm alarm (door, acc, shock sensor)
          case TrackerCmd.SendTo.ALARM_ON: //**,devid999999999999999,L;
                packet= util.format ("**,devid:%s,L", socket.device.devid);
                socket.write (packet);
                break;
          case TrackerCmd.SendTo.ALARM_OFF: //**,devid999999999999999,M;
                // ime is formated in +x
                packet= util.format ("**,devid:%s,M", socket.device.devid);
                socket.write (packet);
                break;
          // Turn off GPRS (returns to SMS mode. This can only be undone by sending an SMS)
          case TrackerCmd.SendTo.GPRS_OFF: //**,devid999999999999999,N;
                packet= util.format ("**,devid:%s,N", socket.device.devid);
                socket.write (packet);
                break;
          // Create a Geofence alarm between points A,B and C,D
          case TrackerCmd.SendTo.GEOFENCE: // **,devid012497000324230,O,-30.034173,-051.167557;-30.044679,-051.146198;
                packet= util.format ("**,devid:%s,O,%s", socket.device.devid, args);
                socket.write (packet);
                break;
          //  Request upload of SD card saved points (only on trackers with sd card)
          case TrackerCmd.SendTo.GET_SDCARD:  //**,devid999999999999999,Q,date;
                packet= util.format ("**,devid:%s,Q,%s", socket.device.devid,args);
                socket.write (packet);
                break;
          // Activate GPRS economy mode (not sure what this does, only on trackers that support this. GPS103 does not)
          case TrackerCmd.SendTo.SET_ECOMOD:  // **,devid999999999999999,T;
                packet= util.format ("**,devid:%s,T;", socket.device.devid);
                socket.write (packet);
                break;
          // Request a photo from camera (only on trackers that support this, GPS103 does not)
          case TrackerCmd.SendTo.GET_PHOTO:  // **,devid012497000419790,V;
                packet= util.format ("**,devid:%s,V;", socket.device.devid);
                socket.write (packet);
                break;
          case TrackerCmd.SendTo.HELP:  // return supported commands by this adapter
                var listcmd=["GET_POS", "SET_TRACK_BY_TIME", "STOP_TRACK", "STOP_SOS"
                    ,"SET_BY_DISTANCE", "SET_MOVE_ALARM", "SET_SPEED_SMS", "SET_TIMEZONE"
                    ,"ENGINE_OFF", "ENGINE_ON", "ALARM_ON", "ALARM_OFF", "GPRS_OFF"
                    ,"GEOFENCE", "GET_SDCARD", "SET_ECOMOD", "GET_PHOTO", "LOGOUT"];

                // push a notice HELP action event to gateway
                device.controller.gateway.event.emit ("notice", "HELP", listcmd, this.uid, socket.uid);
                break;
          default: // ignore any other messages
             this.Debug (1,"Hoops unknow Command=[%s]", action);
             return (-1);
         };
    // return OK status
    this.Debug (4,"SendCommand action=[%s] args=[%s] packet=%s", action, args, packet);
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
    socket.device.LogoutDev ();
};

DevAdapter.prototype.ParseBuffer = function(socket, buffer) {
    this.Debug  (9, "request=[%s]", buffer);

    // split buffer multiple lines if any and remove \r\n
    for (var idx=0; idx < buffer.length; idx++) {
        switch (buffer [idx]) {
            // ; is the end of GPS103 command
            case 0x0A:  // newline \n
            case 0x3B:  // ';' remove Gps103 end of command
                this.ParseLine (socket, socket.linebuf.toString ('ascii',0, socket.lineidx));
                socket.lineidx=0;
                break;
            case 0x0D: break;  // carriage return \r
            default:
                socket.linebuf[socket.lineidx] = buffer [idx];
                socket.lineidx++;
            }
    }
};

// This routine is call from DevClient each time a new line arrive on socket
DevAdapter.prototype.ParseLine = function(socket, line) {
    var data;

    socket.count ++;
    data = this.ParseData (line); // call jison parser
    if (data === null || data.valid === false ) {
        this.Debug (5,'Invalid data=[%s]', line);
        socket.write ("GeoGate " + this.uid + " ignored=[" + line + "\n");
        return;
    }

    // final processing of device.data return from parser
    this.count=socket.count++;
    switch (data.cmd) {
        case TrackerCmd.GetFrom.LOGIN:  // on login force tracker time to UTC
            socket.write ("LOAD");
            break;

        case TrackerCmd.GetFrom.PING: // update last online time
            this.Debug (4,'Ping=%s', line);
            socket.write ("ON");
            break;

        default:   // provide a copy of parsed device.data to device
            this.Debug (3,'Trac=%s', line);
            this.Debug (5,'Data=%j', data);
            break;
    };

    socket.device.ProcessData (data);
};

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename)  {
    var data;

    // Add here any paquet you would like to test
    var testParser = { "Start     ":  "##,devid:359710043551135,A"
        ,"Bug Login ":  "imei:865328021054936,tracker,150219091637,,F,091652.000,A,4738.2522,N,00256.7727,P,10.39,332.39,,1,0,0.0%,,"
        ,"Gps106b   ":  "imei:865328021048227,tracker,141111061820,,F,221824.000,A,4737.1076,N,00245.6550,W,0.04,0.00,,1,0,0.0%,,"        
        ,"Gps103b1  ":  "imei:359710043551135,tracker,1604101403  ,,F,140355.000,A,4737.0370,N,00246.8439,W,0.00,0   ,,0,0,0.00%,,"
        ,"Gps103b2  ":  "imei:359710043551135,tracker,1604101145  ,,F,114556.000,A,4737.0370,N,00246.8439,W,0.00,0"
        ,"date      ":  "imei:865328021054936,tracker,16614828111646,,F,111649.000,A,4736.9955,N,00245.5026,W,24.50,294.23,,1,0,0.0%,,"
        ,"????      ":  "imei:865328021054936,dt,1503082494102,,F,094104.000,A,4737.1657,N,00244.3707,W,0.00,296.93,,1,0,0.0%,,"
        ,'wrongdate ':  "imei:865328021054936,tracker,1586190240145621,,F,145621.000,A,4737.1065,N,00245.6554,W,0.33,237.31,,1,0,0.0%,,"
        ,"ODBD      ":  "imei:865328021048227,OBD,141112020400,,,0.0,,000,0.0%,+,0.0%,00000,,,,,"
        ,"SPORT     ":  "imei:359710045716587,tracker,141123023317,,F,183317.000,A,4737.1233,N,00245.6569,W,0.00,0"    
        ,"NO-GPS    ":  "imei:865328021054936,tracker,150225200217,,L,,,2601,,CDF7,,,,,1,0,0.0%,,"
        ,"Ping      ":  "359710043551135"
        ,"Help-GPS1 ":  "imei:359710043551135,help me,1409050559,1234,F,215931.000,A,4737.1058,N,00245.6524,W,0.00,0"
        ,"Help-GPS2 ":  "imei:359710043551135,help me,1409050559,,F,215931.000,A,4737.1058,N,00245.6524,W,0.00,0"
        ,"Help-NOGPS":  "imei:359710043551135,help me,1409050559,13554900601,L,"
        ,"Track1    ":  "imei:359710043551135,tracker,1409060521,,F,212147.000,A,4737.1076,N,00245.6561,W,0.00,0"
        ,"NOGPS     ":  "imei:359586015829802,low battery,000000000,13554900601,L,"
        ,"BAT       ":  "imei:359586015829802,low battery,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,"
        ,"Stockad   ":  "imei:359586015829802,stockade,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,"
        ,"Speed     ":  "imei:359586015829802,speed,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,"
        ,"Move      ":  "imei:359586015829802,move,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,"
        ,"Sensor    ":  "imei:359710043551135,sensor alarm,1409070008,,F,160844.000,A,4737.0465,N,00245.6099,W,21.21,306.75"
        ,"Door      ":  "imei:012497000419790,door alarm,1010181112,00420777123456,F,101216.000,A,5004.5502,N,01426.7268,E,0.00,"
        ,"Acc-On    ":  "imei:012497000419790,acc alarm,1010181112,00420777123456,F,101256.000,A,5004.5485,N,01426.7260,E,0.00,"
        ,"Resume Eng":  "imei:012497000419790,kt,1010181052,00420777123456,F,095256.000,A,5004.5635,N,01426.7346,E,0.58,"
        ,"Stop Engin":  "imei:012497000419790,jt,1010181051,00420777123456,F,095123.000,A,5004.5234,N,01426.7295,E,0.00,"
        ,"Turn Alarm":  "imei:012497000419790,gt,1010181046,00420777123456,F,094657.000,A,5004.5251,N,01426.7298,E,0.00,"
        ,"Speed On  ":  "imei:012497000419790,ht,1010181032,00420777123456,F,093203.000,A,5004.5378,N,01426.7328,E,0.00,"
        ,"Speed two" :  "imei:865328021054936,ht,150301045926,            ,F,125926.000,A,4737.1061,N,00245.6529,W,0.03,148.34,,1,0,0.0%,,"
        ,"Park Off  ":  "imei:012497000419790,mt,1010181029,00420777123456,F,092913.000,A,5004.5392,N,01426.7344,E,0.00,"
        ,"Park On   ":  "imei:012497000419790,lt,1010181025,00420777123456,F,092548.000,A,5004.5399,N,01426.7352,E,0.00,"
        ,"Stop SOS  ":  "imei:012497000419790,et,1010181049,00420777123456,F,094922.000,A,5004.5335,N,01426.7305,E,0.00,"
    };


    // Jison is quite picky, heavy testing is more than recommended
    console.log ("\n#### Starting Test ####");
    // Create a dummy object controller for test
    var dummy = [];  dummy.svcopts=[];  dummy.svcopts.debug = 9;
    var adapter  = new DevAdapter (dummy);
    for (var test in testParser) {
        var line = testParser[test];
        console.log ("### %s = [%s]", test, line);
        data = adapter.ParseData (testParser[test]);
        if (data !== null)
          console.log ("  --> %j", data);
        else console.log (" --> Error processing Test [%s]", test);
    }
    console.log ("**** GPS103 Parser Test Done ****");
}; // end if __filename

module.exports = DevAdapter; // http//openmymind.net/2012/2/3/Node-Require-and-Exports/
