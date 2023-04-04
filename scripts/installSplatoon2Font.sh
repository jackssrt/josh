#!/usr/bin/env bash
cd ~
mkdir -p .fonts
cd .fonts
curl https://frozenpandaman.github.io/Splatoon2.otf -o Splatoon2.otf
fc-cache -vf