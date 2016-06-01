cd `dirname $0`

echo Rebuild Production Tree
gulp build-app-prod

echo Sync Sinagot.net AisWeb
rsync -az dist.prod root@fridu.net:/srv/www/fulup-asso/geoloc
