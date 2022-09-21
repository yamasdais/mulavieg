#!/bin/sh
# Docker WORKDIR is /home this time.
cd mulavieg; git pull || echo "git pull failed."
mkdir -p www-data/
cd www-data
ln -sf ../src/lib .
ln -sf ../src/js .
ln -sf ../src/style .
ln -sf ../src/index.html .
ln -sf ../src/webservice.py .
exec python3 webservice.py