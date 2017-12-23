#!/usr/bin/env node
'use strict';

// Author   : Fulup Ar Foll
// Date     : June-2016
// Licence  : What ever please you until you fixe bug by yourself
// Object   : Configure USR-TCP232-Config (tested with USR-TCP232-2)

// Prerequisite

// make sure your are connected on the same physical network
// stop your firewall (or open UDP port 1500)
// leave config switch in gound (midle position, not serial, not UDP)


// Usage: 

//    1- update config to mach your need (factory config is config_index:1)
//    2- type in a terminal "sudo node.js USR-TCP232-Config.js" (will read and display all config before uploading new one
//    3- check your converter respond to ping.

// Debug:

// if you only see the discover message then your discovery command is sent but the adapteur cannot respond
// typically this mean that you are not on the same physical network

// Note:

// while you need to get Linux box and adaptor on the same physical network for config,
// the IP address does not have to match. If is possible to configure from one network for an other one.

// Bugs: Does not discover multiple USR-TCP232-xx. Converter should be alone of LAN branche during configuration time

// choose config index
var config_index = 2;

switch (config_index) {
    
    case 0:
        var DST_ADDR="192.168.0.201";  // target IP for RS232 data (should be routable fro mlocal network)
        var DST_PORT=8234;             // target port
        var USR_ADDR="192.168.0.7";    // wanted IP for USR-TCP232-Config: (should match local network)
        var USR_GATW="192.168.0.201";  // Gateway on localnetwork 
        var USR_PORT=20108;            // USR Port (should match firewall rules if any)
        var USR_SNET="255.255.255.0";  // local network mask (should match existing network)
        var USR_MODE=1;                // client (0=UDP, 1=TCP) server(2=UDP, 3=TCP)
        var USR_BAUD=115200;           // baud rate
        var USR_STOP=3;                // Stopbit 3=N,8,1
        break;

    case 1:
        var DST_ADDR="10.10.95.1"; 
        var DST_PORT=2000;  
        var USR_ADDR="10.20.101.21"; 
        var USR_GATW="10.20.101.1"; 
        var USR_SNET="255.255.255.0"; 
        var USR_BAUD=38400;
        break;

    case 2:
        var DST_ADDR="5.39.78.33"; 
        var DST_PORT=56860;  
        var USR_ADDR="192.168.1.9"; 
        var USR_GATW="192.168.1.254"; 
        var USR_SNET="255.255.255.0"; 
        var USR_BAUD=38400;
        break;

    default:
        console.log ("ERROR: invalid config_index=%d", config_index);
        process.exit(1);
}

// if needed complete config with defaults
if (!USR_MODE) var USR_MODE=0;     // default send with UDP
if (!USR_BAUD) var USR_BAUD=9600;  // why not
if (!USR_STOP) var USR_STOP=3;     // Stopbit 3=N,8,1
if (!USR_PORT) var USR_PORT=20108; // Default factory value
if (!OLD_PWD)  var OLD_PWD= "110415";
if (!NEW_PWD)  var NEW_PWD= OLD_PWD;

var configport=1500;
var broadcastAddress = "255.255.255.255";
var discovery = new Buffer("123456789012345678901234567890123456789");
var done=false;

var dgram = require('dgram');
var client = dgram.createSocket('udp4');
var addr; // adapter address at discovery

// parse IP Addr and add it to config buffer
function  WriteIpAddr (buffer, offset, ipstring) {
    var addr= ipstring.split('.');
    buffer.writeUInt8(parseInt(addr[3]), offset);
    buffer.writeUInt8(parseInt(addr[2]), offset + 1);
    buffer.writeUInt8(parseInt(addr[1]), offset + 2);
    buffer.writeUInt8(parseInt(addr[0]), offset + 3);
}

client.on('listening', function () {
    var listenaddr = client.address();
    client.setBroadcast(true);
    console.log('\nUSR-TCP232-Config: Configurator listening on ' + listenaddr.address + ":" + listenaddr.port);

    // Broadcast packet to discover USR-TCP232-Config:
    console.log ("USR-TCP232-Config: Configurator broadcast (%d bytes) onto %s:%s for discovery", discovery.length,broadcastAddress, configport);
    client.send(discovery, 0, discovery.length, configport, broadcastAddress);
});

client.on('message', function (message, rinfo) {    
    // console.log (message);
    
    switch (message.length) {
        case 39:
            if (!done) {
                console.log('USR-TCP232-Config: Message from: ' + rinfo.address + ':' + rinfo.port +' - length=' + message.length);
                console.log ("USR-TCP232-Config: Discovery OK");
            } else {
                console.log ("USR-TCP232-Config: Config Stored");
                process.exit(0);
            }
            break;
        case 28:
            // discovery message as 28 bytes
            var macaddr=message.slice(0,6);
            var status =message.readInt8(6);
            console.log ("USR-TCP232-Config: MACADDR=0x%s, Status:%d", macaddr.toString('hex'), status);

            if (status !== 0) {
                console.log ("Invalid status should be 0x00");
                process.exit();
            }
            
            var oldcfg = message.slice(7,30);
            
            // 
            var destAddr=oldcfg.readUInt8(3) +'.'+ oldcfg.readUInt8(2) +'.'+ oldcfg.readUInt8(1) +'.'+ oldcfg.readUInt8(0);
            var destPort=oldcfg.readUInt16LE(4);
            var usrAddr=oldcfg.readUInt8(9) +'.'+ oldcfg.readUInt8(8) +'.'+ oldcfg.readUInt8(7) +'.'+ oldcfg.readUInt8(6);
            var usrPort=oldcfg.readUInt16LE(10);
            var usrGatw=oldcfg.readUInt8(15) +'.'+ oldcfg.readUInt8(14) +'.'+ oldcfg.readUInt8(13) +'.'+ oldcfg.readUInt8(12);
            var usrMode=oldcfg.readInt8(16);
            var usrBaud=oldcfg.readUIntLE(17,3);
            var usrSerl=oldcfg.readInt8(20);
            
            // console.log ("oldcfg:", oldcfg);
            console.log ("USR-TCP232-Config: OLD => DestAddr=%s:%d UsrAddr=%s:%d UsrGateway=%s UsrMode=%d usrBaud=%d usrSerial=%d"
                        , destAddr, destPort, usrAddr,usrPort, usrGatw, usrMode, usrBaud, usrSerl);
                                               
            // push new config
            var newcfg = Buffer (39);
            macaddr.copy (newcfg);
            newcfg.write (OLD_PWD, 6, "ascii");
            
            // create new config from user params
            var params = Buffer(20);
            WriteIpAddr (params, 0, DST_ADDR);
            params.writeUInt16LE(DST_PORT, 4);
            WriteIpAddr (params, 6, USR_ADDR);
            params.writeUInt16LE(USR_PORT, 10);
            WriteIpAddr (params, 12, USR_GATW);
            params.writeInt8(USR_MODE, 16);
            params.writeUIntLE(USR_BAUD, 17,3);
            
            // include params into paramsuration newcfg
            params.copy (newcfg, 12); 

            newcfg.write (NEW_PWD, 32, "ascii");
            newcfg.writeInt8(USR_STOP, 38);

            // console.log ("New Config:", newcfg);           
            console.log ("USR-TCP232-Config: NEW => DestAddr=%s:%d UsrAddr=%s:%d UsrGateway=%s UsrMode=%d usrBaud=%d usrSerial=%d"
                        , DST_ADDR, DST_PORT, USR_ADDR, USR_PORT, USR_GATW, USR_MODE, USR_BAUD, USR_STOP);
            
            // writing new config
            client.send(newcfg, 0, newcfg.length, configport, broadcastAddress);
            done=true;
            break;
        default: 
            console.log ("ERROR invalid message size");
            console.log(message);
    }
});

client.bind(configport);








