# Josh

[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/jackssrt/josh/main)](https://github.com/jackssrt/josh/commits/main) [![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/jackssrt/josh/check.yml)](https://github.com/jackssrt/josh/actions)

A Splatoon-oriented discord bot for my server! Josh is written in typescript with [discord.js](https://github.com/discordjs/discord.js).

## Features

- Rich integration with the [splatoon3.ink](https://www.splatoon3.ink) API
  - [Handwritten type definitions](https://github.com/jackssrt/josh/blob/main/src/types/schedulesApi.ts)
  - Automatic maps and modes rotation updates
  - Automatic event creation for challenges
  - And semi-automatic events for splatfests
- A hide and seek game timer and team manager
- A statistics channel with a super cool invite graph!
- Server join and leave logs and dynamic welcome messages
- Automatic role category assignment
- A text-to-speech channel where each message is spoken in a voice channel
- Voice join and leave announcements
- Automatic voice channel creation and removal to meet demand
- An extensive command, event and context menu item handler

### Screenshots

<details>
<summary>Open</summary>
<ul>
<li><img alt="Maps and modes rotation" src="https://github.com/jackssrt/josh/tree/main/docs/images/mapsAndModes.png" /></li>
<li><img alt="Salmon run rotation" src="https://github.com/jackssrt/josh/tree/main/docs/images/salmonRun.png" /></li>
<li><img alt="Maps and modes rotation in channel topic" src="https://github.com/jackssrt/josh/tree/main/docs/images/channelTopic.png"></li>
<li><img alt="Splatfest Event" src="https://github.com/jackssrt/josh/tree/main/docs/images/splatfestEvent.png"></li>
<li><img alt="Challenge Event" src="https://github.com/jackssrt/josh/tree/main/docs/images/challengeEvent.png"></li>
<li><img alt="Hide and seek" src="https://github.com/jackssrt/josh/tree/main/docs/images/hideAndSeek.png"></li>
</ul>
</details>

## Contributing

- This repo follows [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/), any contributions should also follow it
- [package.json](https://github.com/jackssrt/josh/blob/main/package.json) defines a check script, make sure it exits with a 0 status code

## Setup

- Clone the repo
- Install node v19 and the dependencies with pnpm preferably
- Create a .env file following the zod schema in [env.ts](https://github.com/jackssrt/josh/blob/main/src/env.ts)
- Run the dev script in [package.json](https://github.com/jackssrt/josh/blob/main/package.json) or the build and start scripts
