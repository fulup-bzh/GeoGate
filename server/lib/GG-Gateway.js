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

'use strict';

process.env['TZ'] = 'UTC'; // Update gateway internal time to UTC

var async           = require("async");
var EventEmitter    = require("events").EventEmitter;

var Controller = require("./GG-Controller");
var Debug     = require("./_Debug");

var availableBackends = require("./_ScanPlugin").Backend();

// timer in ms in between two commands to devices
var JOB_QUEUE_TIMER= 3* 1000; // 3s  in between each commands
var JOB_RETRY_TIMER=30* 1000; // 30s in between two retry


// this function scan active device table and remove dead one based on inactivity timeout
function SetCrontab (gateway, inactivity) {
    // let's call back ourself after inactivity*1000/4
    gateway.Debug (5, "SetCrontab inactivity=%d", inactivity);
    setTimeout (function(){SetCrontab (gateway, inactivity);}, inactivity*250);
    
    // let compute inactivity timeout limit
    var timeout = new Date().getTime() - (inactivity *1000);
    
    for (var devid in gateway.activeClients) {
        var device = gateway.activeClients[devid];
        if (device.lastshow < timeout) {
            gateway.Debug (1, "Removed ActiveDev Id=%s uid=%s", device.devid, device.uid);
            delete gateway.activeClients [devid];
        }
    }
      
};

// Callback notify Async API that curent JobQueue processing is done
function JobCallback (job) {
    if (job !== null) {
       job.gateway.Debug (6,"Queued Request:%s command=%s devid=%s [done]", job.request, job.command, job.devId);
    }
}

// Pop jon from queue is called outside of gateway object context
function JobQueue (job, callback) {
     // ignore null job but notify the queue.
     var device;

    if (job === null) {
         callback (null);
         return;
    }
    
    var gateway = job.gateway;
    var status = 0;
    
    // set few defaults
    if (job.timeout === undefined) job.timeout=0;  // no retry
    if (job.retry   === undefined) job.retry  =0;  // retry counter
    if (job.args    === undefined) job.args   =""; // optional arguments
    
    gateway.Debug (4,"Queue Request=%s DevId=%s Command=%s Retry=%d", job.request, job.devId, job.command, job.retry);
    
    // broadcast command loop on active device list to split commands
    if (parseInt (job.devId) === 0) {
        var subrqst=1;
        for (var devid in gateway.activeClients) {
            // we only broadcast to device with a valid TCP session
            if (device && device.socket !== null) {
                var request = {
                  gateway : job.gateway,
                  devId  : gateway.activeClients[devid].devid,
                  command: job.command,
                  request: [job.request, subrqst++],
                  retry  : job.retry, 
                  timeout: job.timeout
                };
            gateway.queue.push (request, JobCallback); // broadcast to all active devices
            }
        }
        var broadcast = {
            gateway  : job.gateway,
            command : 'Broadcast',
            request : [request, subrqst++]
        };
        callback (broadcast);
        return;
    };
    
    // search for devId withing global active devices list
    if (gateway.activeClients [job.devId] !== undefined) {
        // device is present check if it is logged
        gateway.Debug (5,"Queue Request=%s DevId=%s Command=%s args=%s Sent", job.request, job.devId, job.command, job.args);
        device  = gateway.activeClients [job.devId];
        status  = device.RequestAction (job.command, job.args);
    } else {
        gateway.event.emit ("queue","NOTLOG",job);
        status = 1; // device not present in active list
    }

    // process status result and notify callback function
    switch (status) {
        case 0 : // command was accepted by device
            // wait JOB_QUEUE_PAUSE time before processing Job next request
            gateway.queue.pause ();
            setTimeout(function () {gateway.queue.resume();}, JOB_QUEUE_TIMER);
            gateway.event.emit ("queue", "ACCEPT", job);
            break;
            
        case 1: // device not present command will be retry later  
            if (job.timeout === 0) break;     // no retry
            if (job.timeout >= new Date()) {  // check time out and either push or notify users
                job.retry ++;
                gateway.event.emit ("queue", "RETRY", job);
                setTimeout(function () {gateway.queue.push (job, JobCallback);}, JOB_RETRY_TIMER);
            } else {
                gateway.event.emit ("queue", "TIMEOUT", job);
            }                
            break;
               
        case -1 : // device exits but command was refused
            gateway.event.emit ("queue", "REFUSED", job);
            break;
            
        case -2 : // device does not exist in active device list
            gateway.event.emit ("queue", "UNKNOWN", job);
            break;
               
        default:
            gateway.Debug (2,"Hoops invalid status code: Device DevId=%s Status=%s", job.devId, status);
            break;
    }
    callback (job);
};

// Main user entry point to create gpstracking service
function Gateway(opts) {

    this.controllers = []; // Hold controller objectHandler by device name
    this.activeClients = []; // Hold all active clients sort by uid

    // Add DebugTool to log messages
    this.uid  = "Gateway:" + opts.name;
    this.debug =  opts.debug;   
    
    // simple counter for job queue
    this.request = 1;
    
    // Database backend and user event handler are shared amont all servers
    this.event = new EventEmitter();
    this.opts     = opts;
    
    // Compute some opts and provide some defaults
    this.opts.name       = opts.name         || "Gateway-Track";
    this.opts.debug      = opts.debug        || 1;      // default 1
    this.opts.backend    = opts.backend      || "file"; // file-backend.js
    this.opts.inactivity = opts.inactivity   || 600;    // default 10mn
      
    // Call constructor
    this.Gateway (opts);
};

// Import debug method 
Gateway.prototype.Debug = Debug;

// Attache database backend and start one Controller for each selected device
Gateway.prototype.Gateway=function(opts) {


    this.Debug (0, "Gateway Start: %s ", opts.name );
    
    //  Create databaseObj and attach it to Gateway
    try {
        var dbBackend = require(availableBackends[opts.backend]);      
    } catch (err) {
        this.Debug (0, "Fail loading: %s file=%s", opts.backend, availableBackends[opts.backend]);
        console.log ("Gateway stop");
        process.exit(-1);
    }
    
    // this.backend.connect (opts);
    this.backend = new dbBackend (this, opts);
    if (this.backend.error) {
        this.Debug (0, "Fail connecting dbBackend: %s", this.backend.info);
        console.log ("Gateway aborted");
        process.exit(-1);
    }
    
    // Queue handler to process sendcmd to device in serial mode 
    this.queue  =  async.queue  (JobQueue, 1);
    
    // Cron is an even handler executed outside of current object
    SetCrontab (this, parseInt (opts.inactivity) || 3600);

    // For each adapter start a dedicated device server
    for (var svc in opts.services) {
        if (svc.toLowerCase() !== 'debug') this.controllers [svc] = new Controller (this, opts.services[svc], svc);
    }
};

// export the class
module.exports = Gateway; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/


