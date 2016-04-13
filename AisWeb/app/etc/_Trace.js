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
 */

var util       = require("util");
var path       = require("path");
var config= require('./_Config');

function TracePoint () {
        var saved = Error.prepareStackTrace;                           // save default prepareStack function
        Error.prepareStackTrace = function(_, stack){ return stack; }; // overload err stack handling
        Error.captureStackTrace(this, arguments.callee);               // request a stack
        this.trace = this.stack;                                       // effectively build trace
        Error.prepareStackTrace = saved;                               // restore original nodejs function  
}

// ------- Public Methods --------------
var dbgLevel = function(target, level, format) {  //+ arguments
    // try to get debugLevel from calling object or global config
    if (target && target.dbgLevel)  dbgLevel = target.dbgLevel;
    else dbgLevel = config.DBG_LVL || 1;
    
    if (dbgLevel >= level ) {

        var args = [].slice.call(arguments, 2); // copy argument in a real array leaving out level
        var message = util.format.apply(null, args);
        
        var trace = new TracePoint().trace;
        var info = {
            fullpath : trace[1].getFileName(),
            linenum  : trace[1].getLineNumber(),
            basename : path.basename (trace[1].getFileName())
        };
        
        if (dbgLevel >= 5) {
            console.log("%s:%d", info.fullpath, info.linenum);
            console.log("\t[%d] %j", dbgLevel, message);
        }
        else console.log("--%d-- [%s:%d] -- %j", dbgLevel, info.basename, info.linenum, message);
    }
};

module.exports = dbgLevel;
