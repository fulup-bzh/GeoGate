cd `dirname $0`

echo Manual Sync Sinagot.net Server
rsync -az *   root@fridu.net:/srv/www/gpsdtracking/DemoProd/node_modules/ggserver
echo Restarting Service
ssh root@fridu.net /srv/www/gpsdtracking/StartService.sh 
