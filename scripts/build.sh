#!/usr/bin/env bash

##=========
# Modified form vscode-ng-language-service
##=========

set -ex -o pipefail

# Enable extended pattern matching features
shopt -s extglob

# Clean up from last build
rm -rf client/out
rm -rf server/out
rm -rf typescript-deno-plugin/out
rm -rf dist
rm -rf **/*.tsbuildinfo

# Build the client and server
yarn compile

# Copy files to package root
cp package.* yarn.lock deno.png README.md dist
cp Releases.md dist/Changelog.md
cp -r schemas dist
# Copy files to client directory
cp client/package.json client/yarn.lock dist/client
# Copy files to server directory
cp server/package.json server/yarn.lock dist/server

pushd dist
yarn install --production --ignore-scripts

pushd client
yarn install --production --ignore-scripts
popd

pushd server
yarn install --production --ignore-scripts
popd

# rename "./client/out/extension" --> "./client"
sed -i -e 's#./client/out/extension#./client#' package.json

# package
../node_modules/.bin/vsce package --yarn --out deno.vsix

popd
