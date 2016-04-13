## Object
    Display AIS target into a WebView using OpenSeaMap

## Online demo
    http://sinagot.net/aisweb

## Installation
    Install HTML5 development toolchain on your host

    1) Install NodeJs [not used on target] 
       zypper install nodejs
       yum install nodejs

    2) Install building tools [bower, gulp, ....]
       npm install # this install all development tool chain dependencies
       sudo npm install --global gulp  # this is not mandatory but it will make your live simpler

### Build project
    gulp help
    gulp build-app-dev (*) check note for at the end of the page about build-app-dev
    gulp watch-dev 

### Configure Apache to serv both HTML and proxy websock to GeoGate server

    # include following plugins to Apache 
        rewrite
        proxy
        proxy_wstunnel

    # Check mode are effectively loaded
        systemctl restart httpd  (use apache2 in place of httpd on OpenSuSe)
        apachectl -t -D DUMP_MODULES

    <VirtualHost *:80>
        ServerName localhost
        DirectoryIndex index.html

        # Rootdir should point of your local dist.dev
        DocumentRoot  xxxxxxx/dist.dev

        # For test you can use public Sinagot.net public port
        ProxyPass /ais-simu     ws://sinagot.net:5122

        ErrorLog  /var/log/httpd/sinagot-error.log
        CustomLog /var/log/httpd/sinagot-acces.log  common

       <Directory "xxxxxxx/dist.dev">
          Options -Indexes +FollowSymLinks
          Require all granted
          AllowOverride All
       </Directory>
    </VirtualHost>
    
### Bugs
You're more than welcome to help contributing in finding bugs. Please feel
free to fork and propose patches.

Note: currently "gulp build-app-prod" cannot compact all JS vendor files into
a single package. This due to a bug in "Trangram" kit that force the name to
tangram.[debug|min].js. I tried to used worker_url but fail having it work.
As a result vendors files are compressed but not compacted.
