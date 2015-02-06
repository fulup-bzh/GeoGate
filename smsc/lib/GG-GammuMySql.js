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
 * This is a small interface to send and receive Gammu MySql Backend
 * reference: http://wammu.eu/docs/manual/smsd/tables.html
 */

'use strict';

var Debug = require ('./_Debug');
var mysql = require ('mysql'); // https://www.npmjs.org/package/mysql

var MYSQL_RECONNECT_TIMER=10*1000; // 10s timeout in bewteen two MYSQL reconnects

// ConnectDB is done on at creation time and asynchronously on PROTOCOL_CONNECTION_LOST
function CreateConnection (gammu, opts) {

    gammu.Debug (3, "MySQL creating connection [%s]", gammu.uid);
    gammu.base = mysql.createConnection(opts);

    // register event for asynchronous server errors
    gammu.base.on('error', function(err) {
        gammu.Debug (1, "MySQL server error=[%s]", err);

        // Sever was restarted or network connection was lost let restart connection
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            gammu.Debug.call (gammu, 4, "MySQL connection lost [%s/%d] automatic connect retry in 10s]", gammu.uid);
            setTimeout(function () {CreateConnection (gammu,opts);}, MYSQL_RECONNECT_TIMER);
        } else {
            throw err;  // server variable configures this)
        }
    });

    // force an initial connectiion at object construction time
    gammu.base.connect (function(err) {
        if (err) {
            gammu.Debug.call (gammu, 1, "MySQL connection fail [%s] automatic connect retry in 10s]", err);
            setTimeout(function () {CreateConnection (gammu,opts);}, MYSQL_RECONNECT_TIMER);

        } else {
            gammu.Debug.call (gammu, 5,"MySQL Connect Done [%s]",  gammu.uid);
        }
    });
}

function GammuSms (opts)  {

    // setup default values for missing options
    this.opts =
    { debug   : opts.debug

    , report  : opts.report  || true
    , limit   : opts.limit   || 10
    , delay   : opts.delay   || 2000// default 2s
    , retry   : opts.retry   || 20
    }

    this.uid = 'GammuSms://' + opts.username + "@" + opts.hostname +'/' + opts.basename;
    this.debug= opts.debug;
    this.Debug (2, 'New %s', this.uid);

    // connect to MySQL server
    // clean up options for MySQL

    var mysqlopts =
    {   host      : opts.hostname  || "localhost"
        , user    : opts.username
        , database: opts.basename
        , password: opts.password
    };

    CreateConnection (this, mysqlopts);
}

// import Debug helper
GammuSms.prototype.Debug = Debug;

// receive SMS from inbox.
GammuSms.prototype.GetFrom = function (callback, phone) {

    var sqlQuery= "Select Id, ReceivingDateTime, SMSCNumber, SenderNumber, TextDecoded from inbox "
        + " WHERE SenderNumber=" + phone + " ORDER BY ID LIMIT " +  this.opts.limit ;

    this.Debug (7, "sqlQuery=%s", sqlQuery);
    this.base.query (sqlQuery , callback);
};

// receive SMS from inbox.
GammuSms.prototype.GetAll = function (callback) {
    var sqlQuery= "Select Id, ReceivingDateTime, SMSCNumber, SenderNumber, TextDecoded from inbox "
                + "ORDER BY ID LIMIT " + this.opts.limit ;

    this.Debug (7, "sqlQuery=%s", sqlQuery);
    this.base.query (sqlQuery , callback);
};

GammuSms.prototype.DelById = function (callback, id) {
    var sqlQuery = "DELETE from inbox WHERE ID=" + id;

    this.Debug(7, "sqlQuery=%s", sqlQuery);
    this.base.query(sqlQuery, callback);
};

GammuSms.prototype.CheckById = function (callback, id) {
    var sqlQuery = "select ID from outbox WHERE ID=" + id;

    this.Debug(7, "sqlQuery=%s", sqlQuery);
    this.base.query(sqlQuery, callback);
};

GammuSms.prototype.SendTo = function (callback, smscmd) {

    function swapBytes(buffer) {
        var l = buffer.length;
        if (l & 0x01) {
            throw new Error('Buffer length must be even');
        }
        for (var i = 0; i < l; i += 2) {
            var a = buffer[i];
            buffer[i] = buffer[i+1];
            buffer[i+1] = a;
        }
        return buffer;
    }

    function toHex(buffer) {
        var result = '';
        for (var i = 0; i < buffer.length; i++) {
            var b = buffer[i];
            if (b < 16) result += '0';
            result += b.toString(16);
        }
        return result;
    }

    function encodeSmsText(input) {
        var ucs2le = new Buffer(input, 'ucs2');
        var ucs2be = swapBytes(ucs2le);
        return toHex(ucs2be);

    }


    var phonenum= smscmd.phone.toString ().trim();
    switch (phonenum.charAt (0)) {
        case '0': break;
        case '+': break;
        default: phonenum = '+' + phonenum;
    }

    var queryString = "INSERT INTO outbox set ?";
    var post  =
        { DestinationNumber: phonenum
        , MultiPart: 'false'
        , RelativeValidity: 255
        , Text :     encodeSmsText (smscmd.msg)
        , UDH : ''
        , Class: -1  // -1=unknown 0=NormalSMS 1=flash
        , InsertIntoDB: new Date() // insert timestamp
        , TextDecoded: smscmd.msg
        , DeliveryReport: this.opts.report
        , CreatorID: phonenum || "GeoToBe"
    };

    // added ALTER TABLE devices ADD UNIQUE INDEX devid (uniqueId);
    this.Debug (0,"Sending phone=%s message=[%s]", smscmd.phone, smscmd.msg);
    this.base.query(queryString, post, callback);
};

if (process.argv[1] === __filename) {
   console.log ("Hoops no unit test for GammuMySql");
}

module.exports = GammuSms;