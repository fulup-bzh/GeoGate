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

var util        = require("util");
var fs          = require('fs');
var path        = require('path');


function ScanAdapter () {
    var availableAdapters = [];
    var adaptersDir = __dirname + "/../adapters/";
    var directory = fs.readdirSync(adaptersDir);
    for (var i in directory) {
        var filename = directory [i];
        var adapter = path.basename(filename, "-adapter.js");
        var name = adaptersDir + adapter + "-adapter.js";
        try {
            if (fs.statSync(name).isFile()) {
                availableAdapters [adapter] = name;
                console.log("Adapter: " + adapter + " Registered file=" + availableAdapters [adapter]);
            }
        } catch (err) {/* ignore errors */}
    }
    return (availableAdapters);
}


function ScanBackend () {
    var availableBackends =[];
    var backendsDir = __dirname  + "/../backends/";
    var directory   = fs.readdirSync(backendsDir);
    for (var i in directory) {
        var filename = directory [i];
        var backend  = path.basename (filename,"-backend.js");
        var name = backendsDir + backend + "-backend.js";
        try {
            if (fs.statSync(name).isFile()) {
                availableBackends [backend] = name;
                console.log ("Backend: " + backend + " Registered file: " + availableBackends [backend]);
            }
        } catch (err) {/* ignore errors */}
    }
    return (availableBackends);
}

function ScanConfig () {
    var availableConfigs =[];
    var configsDir = __dirname  + "/../config/";
    var directory   = fs.readdirSync(configsDir);
    for (var i in directory) {
        var filename = directory [i];
        var config  = path.basename (filename,"-config.js");
        var name = configsDir + config + "-config.js";
        try {
            if (fs.statSync(name).isFile()) {
                availableConfigs [config] = name;
                console.log ("Config: " + config + " Registered file: " + availableConfigs [config]);
            }
        } catch (err) {/* ignore errors */}
    }
    return (availableConfigs);
}

var ScanPlugin =
   { Config : ScanConfig
   , Adapter: ScanAdapter
   , Backend: ScanBackend
};

module.exports = ScanPlugin; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

