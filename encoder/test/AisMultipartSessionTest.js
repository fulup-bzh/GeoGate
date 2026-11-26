/*
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
 * Multipart AIS messages: the session must stay bounded whatever the fragment
 * numbering of the incoming sentences is.
 *
 *      node --use_strict AisMultipartSessionTest.js
 *
 * Exits with status 1 when a check fails.
 */
'use strict';

var AisDecode = require ('../ApiExport').AisDecode;

var failed = 0;

function check (name, ok, detail) {
    if (ok) console.log ("## OK Test [%s] ##", name);
    else {
        failed ++;
        console.log ("** FX Test [%s] %s **", name, detail === undefined ? "" : detail);
    }
}

function checksum (body) {
    var sum = 0;
    for (var i = 1; i < body.length; i++) sum ^= body.charCodeAt (i);
    return ("0" + sum.toString (16).toUpperCase ()).slice (-2);
}

// build a VDM sentence with a valid checksum
function vdm (count, id, seq, payload) {
    var body = "!AIVDM," + count + "," + id + "," + seq + ",A," + payload + ",0";
    return body + "*" + checksum (body);
}

// fragments are stored under numeric keys; everything else belongs to the caller
function fragmentKeys (session) {
    return Object.keys (session).filter (function (key) { return !isNaN (Number (key)); });
}

var PAYLOAD = "11111111111111111111111111111111111111111111111111111111";

// 1. a regular two part message still decodes and leaves nothing behind
(function () {
    var session = {};
    new AisDecode ("!AIVDM,2,1,3,B,59NWwC@2>6th7Q`7800858l8Dd00000000000018Cp:A:6a=0G@TQCADR0EQ,0*09", session);
    var ais = new AisDecode ("!AIVDM,2,2,3,B,CP000000000,2*37", session);
    check ("two part message decodes", ais.valid === true && ais.mmsi === "636092237" && ais.shipname === "BARMBEK",
           "valid=" + ais.valid + " mmsi=" + ais.mmsi + " shipname=" + ais.shipname + " error=" + ais.error);
    check ("fragments released after completion", fragmentKeys (session).length === 0, "left: " + fragmentKeys (session));
}) ();

// 2. the same message can be decoded again on the same session
(function () {
    var session = {};
    var ais;
    for (var round = 0; round < 3; round ++) {
        new AisDecode ("!AIVDM,2,1,9,B,C43NbT0008VGWDVHNs0000N10PHb`NL00000,0*6D", session);
        ais = new AisDecode ("!AIVDM,2,2,9,B,00000000N0`90RPP,0*59", session);
    }
    check ("repeated two part message decodes", ais.valid === true && ais.shipname === "PLUTON", "valid=" + ais.valid + " error=" + ais.error);
}) ();

// 3. a message that never completes must not grow the session
(function () {
    var session = {};
    var last;
    for (var id = 1; id <= 1000; id ++) last = new AisDecode (vdm (999999999, id, 1, PAYLOAD), session);
    check ("oversized fragment count is rejected", last.valid === false && last.error.length > 0, "valid=" + last.valid);
    check ("session bounded for a never completing message", fragmentKeys (session).length <= 9, "keys=" + fragmentKeys (session).length);
}) ();

// 4. fragment numbers that are not 1..count must not be stored
(function () {
    var session = {};
    var ids = ["0", "-1", "-2", "0.5", "0.25", "1e-3", "", "x", "3", "1.5"];
    for (var i = 0; i < ids.length; i ++) new AisDecode (vdm (2, ids [i], 1, PAYLOAD), session);
    check ("invalid fragment numbers are not stored", fragmentKeys (session).length === 0, "left: " + fragmentKeys (session));

    session = {};
    new AisDecode (vdm (2.5, 1, 1, PAYLOAD), session);
    new AisDecode (vdm ("1e3", 1, 1, PAYLOAD), session);
    check ("invalid fragment counts are not stored", fragmentKeys (session).length === 0, "left: " + fragmentKeys (session));
}) ();

// 5. a later fragment announcing another count does not complete the message
(function () {
    var session = {};
    new AisDecode (vdm (3, 1, 1, PAYLOAD), session);
    new AisDecode (vdm (3, 2, 1, PAYLOAD), session);
    var ais = new AisDecode (vdm (2, 2, 1, PAYLOAD), session);
    check ("fragment count mismatch is rejected", ais.valid === false && ais.error.length > 0, "valid=" + ais.valid + " error=" + ais.error);
}) ();

// 6. starting a new message drops the fragments of an unfinished one
(function () {
    var session = {};
    new AisDecode (vdm (3, 1, 1, PAYLOAD), session);
    new AisDecode (vdm (3, 2, 1, PAYLOAD), session);
    new AisDecode (vdm (2, 1, 2, PAYLOAD), session);
    check ("new message drops stale fragments", session [2] === undefined && fragmentKeys (session).length === 1, "keys: " + fragmentKeys (session));
}) ();

// 7. nine fragments, the most a sentence can announce, still assemble
(function () {
    var session = {};
    var ais;
    for (var id = 1; id <= 9; id ++) ais = new AisDecode (vdm (9, id, 4, PAYLOAD), session);
    check ("nine fragments assemble", ais.msglen === 9 * PAYLOAD.length && fragmentKeys (session).length === 0,
           "msglen=" + ais.msglen + " keys=" + fragmentKeys (session).length + " error=" + ais.error);
}) ();

// 8. keys owned by the caller are left alone
(function () {
    var session = {mine: 42};
    new AisDecode ("!AIVDM,2,1,3,B,59NWwC@2>6th7Q`7800858l8Dd00000000000018Cp:A:6a=0G@TQCADR0EQ,0*09", session);
    new AisDecode ("!AIVDM,2,2,3,B,CP000000000,2*37", session);
    check ("caller keys untouched", session.mine === 42);
}) ();

if (failed > 0) {
    console.log ("** %d check(s) failed **", failed);
    process.exit (1);
}
console.log ("## all multipart session checks passed ##");
