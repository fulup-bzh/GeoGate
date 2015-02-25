/* simple SMS batch file */

'use strict';

var SmsBatch =
 [ {cmd: 'CHECK_IMEI' , args: {}}
 , {cmd: 'GPRS_APN'    , args: {apn: 'FREE'} }
 , {cmd: 'GPRS_URI'    , args: {host: '46.105.45.122', port:5003} }
 , {cmd: 'GPRS_PROTO'  , args: {proto: 18} }
 , {cmd: 'GPRS_MOD'    , args: {} }
 , {cmd: 'GPRS_LESS'   , args: {} }
 , {cmd: 'LOCALTIME'   , args: {zone:'+0'} }
 , {cmd: 'CHECK_GRPS'  , args: {}}

 , {cmd: 'TRACK_MANY' , args: {delay: '030m'}}
 , {cmd: 'TRACK_DIST' , args: {dist:  '0300'}}
 , {cmd: 'SAVSD_ON'   , args: {delay: '180s'}}
 , {cmd: 'TRACK_ANGLE', args: {angle: '030'}}
 ];

module.exports = SmsBatch;
