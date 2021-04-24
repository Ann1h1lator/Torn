/*
Copyright (C) 2021  torn.space (https://torn.space)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

declare const BRANCH: string;
declare const COMMITHASH: string;
declare const VERSION: string;

declare const TORN_API_URL: string;
declare const TORN_GAMESERVER_URL: string;

const core = {
    branch: BRANCH,
    commitHash: COMMITHASH,
    version: VERSION,

    apiURL: `${TORN_API_URL}/api`,
    gameServerURL: TORN_GAMESERVER_URL,

    audio: [],
    images: [],

    muted: {
        music: false,
        sfx: false
    }
};

export default core;
