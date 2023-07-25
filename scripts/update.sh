#!/usr/bin/env bash
git pull
echo Pulled!
if [[ $1 -eq "--install" ]]; then
	pnpm install
	echo Installed!
fi
pnpm run build
echo Built!
sudo systemctl restart josh.service
echo Restarted and done!