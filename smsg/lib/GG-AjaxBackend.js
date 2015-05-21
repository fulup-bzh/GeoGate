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
 * This file make the interface through MySQL in between backend that is written
 * in PHP/Laravel and the GeoGate SMSc interface with backend. 
 */

'use strict';

var Debug = require ('./_Debug');
var mysql = require ('mysql'); // https://www.npmjs.org/package/mysql

var MYSQL_RECONNECT_TIMER=10*1000; // 10s timeout in bewteen two MYSQL reconnects

// ConnectDB is done on at creation time and asynchronously on PROTOCOL_CONNECTION_LOST
function CreateConnection (backend, credentials) {


    backend.Debug (4, "MySQL creating connection [%s]", backend.uid);
    backend.base = mysql.createConnection(credentials);

    // register event for asynchronous server errors
    backend.base.on('error', function(err) {
        backend.Debug (1, "MySQL server error=[%s]", err);

        // Sever was restarted or network connection was lost let restart connection
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log ("retry" + backend.uid)
            backend.Debug.call (backend,3, "MySQL connection lost [%s/%d] automatic connect retry in 10s]", backend.uid);
            setTimeout(function () {CreateConnection (backend, credentials);}, MYSQL_RECONNECT_TIMER);
        } else {
            throw err;  // server variable configures this)
        }
    });

    // force an initial connectiion at object construction time
    backend.base.connect (function(err) {
        if (err) {
            backend.Debug.call (backend,1, "MySQL connection fail [%s] automatic connect retry in 10s]", err);
            setTimeout(function () {CreateConnection (backend, credentials);}, MYSQL_RECONNECT_TIMER);

        } else {
            backend.Debug.call (backend,5,"MySQL Connect Done [%s]",  backend.uid);
        }
    });
}

function AjaxBackend (gateway, opts)  {

    this.uid = 'AjaxBackend://' + opts.username + "@" + opts.hostname +'/' + opts.basename;
    this.debug= opts.debug || gateway.debug;
    this.Debug (2, 'New %s', this.uid);

    // clean up options for MySQL
    var credentials =
    {  host    : opts.hostname  || "localhost"
     , user    : opts.username
     , database: opts.basename
     , password: opts.password
    };


    // connect to MySQL server
    CreateConnection (this, credentials);
}

// import Debug helper
AjaxBackend.prototype.Debug = Debug;

// receive SMS from inbox.
AjaxBackend.prototype.getByEmei = function (callback, emei) {

    var sqlQuery= "Select token from trackers " + " WHERE emei=" + emei ;

    this.Debug (3, "sqlQuery=%s", sqlQuery);
    this.base.query (sqlQuery , callback);
};

if (process.argv[1] === __filename) {
   console.log ("Hoops no unit test for backendMySql");
}

module.exports = AjaxBackend;