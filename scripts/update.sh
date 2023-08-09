#!/usr/bin/env bash
export PATH=$PATH:$HOME/.local/share/pnpm
git pull
echo Pulled!
# Parse command-line options using getopt
ARGS=$(getopt -o "" --long install -n "$0" -- "$@")
eval set -- "$ARGS"

while true; do
    case "$1" in
        --install)
            pnpm install
            echo "Installed!"
            shift
            ;;
        --)
            shift
            break
            ;;
        *)
            echo "Invalid option"
            exit 1
            ;;
    esac
done
pnpm run build
echo Built!
sudo systemctl restart josh.service
echo Restarted and done!
