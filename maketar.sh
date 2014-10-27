#!/bin/bash

thisdir=`dirname $0`
thisversion=`sed -e 's/^VERSION: //p' -e 'd' "$thisdir/CHANGES"`
outfile="jstour-$thisversion.tar.gz"
tar --exclude="jstour-*.tar.gz" --exclude=".hg" --exclude=".git" --exclude="._*" --exclude="node_modules" -czf "/tmp/$outfile" "$thisdir"
mv "/tmp/$outfile" "$thisdir"
