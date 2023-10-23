#!/usr/bin/env bash
curl https://frozenpandaman.github.io/Splatoon2.otf -o assets/Splatoon2.otf
mkdir -p ~/.fonts
cp ./assets/Splatoon2.otf ~/.fonts/
fc-cache -vf