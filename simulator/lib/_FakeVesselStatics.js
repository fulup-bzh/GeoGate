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
 * 

 * in order to keep configuration simple, we compute automatically
 * most vessel characteristics. Speed name, MMSI, etc ....
 * In real world the application should obviously be more serious about it.
 * 
 */
'use strict';

var globalcount= 0; // we use counter to built fake MMSI

function FakeVesselStatics (gpxfile) {
    this.route = gpxfile;
    this.args  = gpxfile.split ("-");
    this.count = globalcount++;  // counter for dummy mmsi
}

FakeVesselStatics.prototype.Shipname = function () {

    return (this.args[0]);
};

FakeVesselStatics.prototype.Mmsi = function () {
    var mmsi;
    if (this.args[1] !== 'undefined') {
       mmsi =  parseInt (this.args[1]);
    } else {
       if (globalcount === 0)  mmsi = 0;
       else mmsi = parseInt ('1000000' + this.count);
    }
    return (mmsi);
};

FakeVesselStatics.prototype.Callsign = function () {
    var callsign = 'SIM00' + this.count;
    return (callsign);
};

FakeVesselStatics.prototype.Speed = function () {
    var sog;
    if (this.args[2] !== undefined) {
       sog =  parseInt (this.args[2]);
       if (sog === 0)  sog = 5 + Math.random() * 30;
    } else {
        sog = 5 + Math.random() * 30;
    }
    this.sog=sog;
    return (sog);
};

FakeVesselStatics.prototype.Len = function () {
    var len;
    if (this.sog <  20) len = 10 + Math.random() * 20;
    if (this.sog >= 20) len = 20 + Math.random() * 100;
    this.len=len;
    return (len);
};
FakeVesselStatics.prototype.Wid = function () {
    var wid;
    if (this.len <   30)  wid = this.len / 3; 
    if (this.len >=  30)  wid = this.len / 3; 
    this.wid=0;
    return (wid);
};

FakeVesselStatics.prototype.Uway = function () {
    var uway=0;
    if (this.cargo === 30) uway = 7; // fishing
    if (this.cargo === 36) uway = 8; // sailling
    this.uway=uway;
    return (uway);
};

FakeVesselStatics.prototype.Cargo = function () {
    var cargo=70;
    if (this.len > 15  &&  this.sog <15)  cargo = 30;  // fishing
    if (this.len < 15  &&  this.sog <10)  cargo = 36;  // sailling
    if (this.len < 15  &&  this.sog <15)  cargo = 37;  // pleasure
    if (this.len >= 15 &&  this.sog >=20)  cargo = 70;  // cargo
    if (this.len >= 15 &&  this.sog >=30) cargo = 60; // passenger
    this.cargo=cargo;
    return (this.cargo);
};

FakeVesselStatics.prototype.Class = function () {
    if (this.len > 15)  this.class='A';
    else this.class='B';
    return (this.class);
};

module.exports = FakeVesselStatics; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
