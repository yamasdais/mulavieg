#!/bin/sh
# Docker WORKDIR is /home this time.
cd mulavieg; git pull || echo "git pull failed."
mkdir -p www-data/lib
cp src/lib/* www-data/lib
cp src/*.js www-data
cp src/InputMachine.html www-data/index.html
cp src/webservice.py www-data/
cd www-data
exec python3 webservice.py