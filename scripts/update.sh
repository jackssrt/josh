#!/usr/bin/env bash
git pull
echo Pulled!
if [[ $1 -eq "--install" ]]; then
	$HOME/.local/share/pnpm/pnpm install
	echo Installed!
fi
$HOME/.local/share/pnpm/pnpm run build
echo Built!
sudo systemctl restart josh.service
echo Restarted and done!