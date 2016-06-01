#!/bin/sh

DIR=`pwd`
cd `dirname $0`

SERVICES="GeoToBeServer  JsonTcp2AisUdp"

LOGDIR=/var/log/geogate
RUNDIR=/var/run/geogate
USERID=debugtest

mkdir -p $LOGDIR
mkdir -p $RUNDIR
chown -R $USERID $RUNDIR

for SERVICE in $SERVICES
do
  if ! test -f $SERVICE.js; then
     echo "ERROR: File $SERVICE.js not found [ignored]"
     continue;
  fi

  # kill existing process
  pkill -f "runuser $USERID -c node $SERVICE.js"

  if test -f $LOGDIR/$SERVICE.log; then
    mv $LOGDIR/$SERVICE.log $LOGDIR/$SERVICE.old
  fi
  echo "Starting $SERVICE `date`"  >$LOGDIR/$SERVICE.log
  runuser $USERID -c "node $SERVICE.js $RUNDIR/$SERVICE.pid" >>$LOGDIR/$SERVICE.log 2>&1 &
  if test "$?" -eq 0; then 
     echo "$!" >$RUNDIR/$SERVICE.pid
  fi
done
