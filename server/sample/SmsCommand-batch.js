/* simple SMS batch file */

'use strict';

var SmsBatch =
 [ {cmd: 'CHECK_DEVID' , args: {}}
 , {cmd: 'OBD_MOD'    , args: {mod: '1'}}
 , {cmd: 'TRACK_MANY' , args: {delay: '030m'}}
 , {cmd: 'TRACK_DIST' , args: {dist: '0300'}}
 , {cmd: 'SAVSD_ON'   , args: {delay: '180s'}}
 , {cmd: 'TRACK_ANGLE', args: {angle: '030'}}
 ];

module.exports = SmsBatch;
