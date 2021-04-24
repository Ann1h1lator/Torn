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

const Blast = require(`./battle/blast.js`);
const Bullet = require(`./battle/bullet.js`);
const Missile = require(`./battle/missile.js`);
const Base = require(`./universe/base.js`);
const Orb = require(`./battle/orb.js`);
const Mine = require(`./battle/mine.js`);
const Beam = require(`./battle/beam.js`);
const Asteroid = require(`./universe/asteroid.js`);

class Player {
    constructor (id) {
        this.name = ``,
        this.type = `Player`,

        this.tag = ``,
        this.id = id, // unique identifier
        this.trail = 0,
        this.color = id > 0.5 ? `red` : `blue`,
        this.ship = 0,
        this.experience = 0,
        this.rank = 0,

        this.guest = false,
        this.dead = false,
        this.docked = false,

        // misc timers
        this.noDrift = 50, // A timer used for decelerating angular momentum
        this.jukeTimer = 0,
        this.hyperdriveTimer = -1,
        this.borderJumpTimer = 0, // for deciding whether to hurt the player
        this.planetTimer = 0,
        this.leaveBaseShield = 0,
        this.superchargerTimer = -1;
        this.empTimer = -1,
        this.disguise = -1,
        this.timer = 0,
        this.gyroTimer = 0,
        this.charge = 0,

        this.weapons = {}, // my equipped weapons and ammo counts
        this.ammos = {},
        this.bulletQueue = 0, // For submachinegun (5 bullet bursts)

        this.sx = 0, // sector
        this.sy = 0,
        this.x = sectorWidth / 2,
        this.y = sectorWidth / 2,
        this.vx = 0,
        this.vy = 0,
        this.cva = 0,
        this.angle = 0,
        this.speed = 0,
        this.driftAngle = 0,

        this.money = 8000,
        this.kills = 0,
        this.killStreakTimer = -1,
        this.killStreak = 0,
        this.baseKills = 0,

        this.shield = false,
        this.generators = 0,
        this.isLocked = false,
        this.lives = 20,
        this.quest = 0,
        this.health = 1,

        this.iron = 0,
        this.silver = 0,
        this.platinum = 0,
        this.copper = 0,

        // bot stuff
        this.net = 0, // where the neural network is stored
        this.isBot = false,
        this.isNNBot = false,

        /* please don't touch these
               nearestEnemyDist = 0,//for nnBots
               nearestFriendDist = 0,
               nearestBulletDist = 0,
               nearestEnemyAngle = 0,
               nearestFriendAngle = 0,
               nearestBulletAngle = 0,
               nearestEnemyDistV = 0,//velocities
               nearestFriendDistV = 0,
               nearestBulletDistV = 0,
               nearestEnemyAngleV = 0,
               nearestFriendAngleV = 0,
               nearestBulletAngleV = 0,
               */

        this.thrust = 1, // These are techs multiplied by ship stats, used for actual physics
        this.va = 1,
        this.capacity = 1,
        this.maxHealth = 2,

        this.thrust2 = 1, // these just track the player tech levels
        this.radar2 = 1,
        this.agility2 = 1,
        this.capacity2 = 1,
        this.maxHealth2 = 1,
        this.energy2 = 1,

        this.w = false, // what keys are pressed currently
        this.s = false,
        this.a = false,
        this.d = false,
        this.e = false,
        this.c = false,
        this.space = false,

        this.killsAchs = {}, // 13 of em
        this.moneyAchs = {}, // 12
        this.driftAchs = {}, // 12
        this.randmAchs = {}, // 12

        // various achievement stuff
        this.driftTimer = 0, // How many ticks this account has been drifting.
        this.cornersTouched = 0, // bitmask
        this.oresMined = 0, // bitmask
        this.questsDone = 0, // bitmask
        this.planetsClaimed = `000000000` + `000000000` + `000000000` + `000000000` + `000000000` + `000000000` + `000000000` + `000000000` + `000000000`,
        this.points = 0,

        this.equipped = 0;
    }

    tick () {
    // timer business
        if (this.killStreakTimer-- < 0) this.killStreak = 0; // Sensitive to off-by-ones.
        if (this.borderJumpTimer > 0) this.borderJumpTimer--;
        if (this.superchargerTimer >= 0) this.superchargerTimer--;
        if (this.empTimer >= 0) this.empTimer--;
        if (this.disguise >= 0) this.disguise--;

        const amDrifting = this.e || this.gyroTimer > 0;
        this.shield = (this.s && !amDrifting && this.gyroTimer < 1) || this.leaveBaseShield > 0;
        if ((this.disguise > 0 && this.weapons[this.equipped] != 18 && this.weapons[this.equipped] != 19 && this.weapons[this.equipped] != 21 && this.weapons[this.equipped] != 22 && this.weapons[this.equipped] != 29 && this.weapons[this.equipped] != 36) || (this.shield && this.weapons[this.equipped] > 0 && wepns[this.weapons[this.equipped]].type !== `Misc` && wepns[this.weapons[this.equipped]].type !== `Mine` && this.space)) this.charge = Math.min(this.charge, 0);
        this.leaveBaseShield--;

        if (!this.isBot) {
            this.checkPlanetCollision();
            if (tick % 50 == 0 && planets[this.sy][this.sx].color === this.color && !this.guest) this.money++; // Earn $.5/sec for being in a sector w/ your color planet
        }

        this.move();
        if (this.health < this.maxHealth && !this.shield) this.health += playerHeal;

        this.fire();

        let chargeVal = (this.energy2 + 1) / 1.8; // charge speed scales with energy tech
        for (let i = 0; i < this.generators; i++) chargeVal *= 1.05;
        if (this.charge < 0 || this.space || this.c) this.charge += chargeVal;
        else if (this.charge > 0 && !this.space && !this.c) this.charge = 0;
    }

    fire () {
        if (this.empTimer > 0) return; // Can't shoot while EMP'd
        if (this.c && this.charge > 0) this.shootEliteWeapon();
        if (this.bulletQueue > 0) this.shootBullet(40); // SMG
        const wepId = this.weapons[this.equipped];
        const wep = wepns[wepId];
        if (!wep || !wep.enabled) {
            return;
        }

        // In case of insufficient ammo
        if (this.ammos[this.equipped] == 0 && this.charge > 10) {
            this.charge = 0;
            this.emit(`sound`, { file: `noammo`, x: this.x, y: this.y });
            return;
        }

        if (this.canShoot(wepId)) {
            if (this.ammos[this.equipped] == 0) return;

            if (wep.level > this.ship) {
                this.emit(`chat`, { msg: `\`tThis weapon is incompatible with your current ship!\`t`, color: `red` });
                return;
            }

            if (wep.name === `Submachinegun`) { // Submachinegun physics
                if (this.bulletQueue == 0) {
                    this.bulletQueue += 5;
                    this.ammos[this.equipped] -= 5;
                    this.reload(false, wepId);
                    sendWeapons(this);
                }
                return;
            }

            if (this.ammos[this.equipped] > 0) this.ammos[this.equipped]--;

            // Traditional Weapons
            // <= 6 are traditional guns.
            if (wepId <= 6 || wep.name === `Gravity Bomb` || wep.name === `Spreadshot`) this.shootBullet(wepId);
            // <= 9 are plasma, laser, hadron beams.
            else if (wepId <= 9 || wep.name === `Jammer` || wep.name === `Mining Laser` || wep.name === `Ore Cannon` || wep.name === `Destabilizer` || wep.name === `Healing Beam`) this.shootBeam(this, false);
            // Traditional missiles
            else if (wepId <= 14 || wep.name === `Proximity Fuze`) this.shootMissile();
            // <= 17: Traditional Mines
            else if (wepId <= 17 || wep.name === `Impulse Mine` || wep.name === `Grenades` || wep.name === `Pulse Mine` || wep.name === `Campfire` || wep.name === `Magnetic Mine`) this.shootMine();
            else if (wep.name === `Energy Disk` || wep.name === `Photon Orb`) this.shootOrb();
            else if (wep.name === `Muon Ray` || wep.name === `EMP Blast` || wep.name === `Hypno Ray` || wep.name === `Lepton Pulse`) this.shootBlast(wepId);

            // Timery Weapons

            else if (wepId == 36 || wepId == 18 || wepId == 19 || wepId == 29) {
                if (wep.name === `Supercharger`) {
                    if (this.superchargerTimer <= 0) this.superchargerTimer = 1500 * (this.ship == 21 ? 2 : 1); // 1 min, more if rank 21
                    else this.superchargerTimer += 1500 * (this.ship == 21 ? 2 : 1); // Stackable
                } else if (wep.name === `Hull Nanobots`) this.health += Math.min(Math.max(-wepns[18].damage, this.maxHealth * 0.25), this.maxHealth - this.health); // min prevents overflow, the max ensures that small ships can still use it with some noticeable effect (and using the otherwise unused damage from the weapons.json)
                else if (wep.name === `Photon Cloak`) this.disguise += (333 + 110 * (this.energy2 - 1) + 10 * (this.ship - wepns[19].level)) * (this.superchargerTimer > 0 ? 2 : 1); // 10s + extra time for energy  + extra time for rank above minimum + extra time if using supercharger
                else if (wep.name === `Warp Drive`) {
                    this.speed = (wepns[29].speed * (this.ship == 16 ? 1.5 : 1) * (this.superchargerTimer > 0 ? 2 : 1) + 150 * (this.energy2 - 1) * (this.superchargerTimer > 0 ? 2 : 1)) * (((this.e || this.gyroTimer > 0) && this.w && (this.a != this.d)) ? 1.25 : 1); // R16 gets a 50% extra boost from it. The more energy tech, the more powerful warp field. Since it only works with the energy2 stat (only the tech), generators don't help with this, it's almost impossible to normally get any substantial boost from it, and supercharger boost is temporary.
                }
            }

            // Movey Weapons

            else if (wep.name === `Pulse Wave`) {
                sendAllSector(`sound`, { file: `bigboom`, x: this.x, y: this.y, dx: Math.cos(this.angle) * this.speed, dy: Math.sin(this.angle) * this.speed }, this.sx, this.sy);
                for (const i in players[this.sy][this.sx]) {
                    const p = players[this.sy][this.sx][i];
                    if (p.color !== this.color) { // only enemies
                        const d2 = squaredDist(this, p); // distance squared between me and them
                        if (d2 > square(10 * wep.range)) continue; // if out of range, then don't bother.
                        const ang = angleBetween(this, p); // angle from the horizontal
                        const vel = -6000 / Math.log(d2); // compute how fast to accelerate by
                        p.vx += Math.cos(ang) * vel; // actually accelerate them
                        p.vy += Math.sin(ang) * vel;
                        p.gyroTimer = 25; // Make sure the player is drifting or else physics go wonk
                        p.updatePolars(); // We changed their rectangular velocity.
                    }
                    for (const i in asts[this.sy][this.sx]) {
                        const a = asts[this.sy][this.sx][i];
                        const d2 = squaredDist(this, a);
                        if (d2 > square(10 * wep.range)) continue; // These 10* are because the user sees 1 pixel as .1 distance whereas server sees it as 1 distance... or something like that
                        const ang = angleBetween(this, a);
                        const vel = -200000 / Math.max(d2, 200000);
                        a.vx += Math.cos(ang) * vel;
                        a.vy += Math.sin(ang) * vel;
                    }
                    for (const i in missiles[this.sy][this.sx]) {
                        const m = missiles[this.sy][this.sx][i];
                        const d2 = squaredDist(this, m);
                        if (d2 > square(10 * wep.range)) continue;
                        const ang = angleBetween(this, m);
                        const vel = -100000000 / Math.max(d2, 2000000);
                        m.emvx += Math.cos(ang) * vel;
                        m.emvy += Math.sin(ang) * vel;
                        if (squaredDist(m, this) < square(20 + ships[this.ship].width)) m.die();
                    }
                    for (const i in mines[this.sy][this.sx]) {
                        const m = mines[this.sy][this.sx][i];
                        const d2 = squaredDist(this, m);
                        if (d2 > square(10 * wep.range)) continue;
                        const ang = angleBetween(this, m);
                        const vel = -10000 / Math.max(d2, 2000000);
                        m.vx += Math.cos(ang) * vel;
                        m.vy += Math.sin(ang) * vel;
                        if (squaredDist(m, this) < square(200 + ships[this.ship].width)) m.die();
                    }
                }
            } else if (wep.name === `Electromagnet`) { // identical structurally to pulse wave, see above for comments.
                if (global.tick % 2 == 0) {
                    for (const i in players[this.sy][this.sx]) {
                        const p = players[this.sy][this.sx][i];
                        if (p.color !== this.color) { // only enemies
                            const d2 = squaredDist(this, p); // distance squared between me and them
                            if (d2 > square(10 * wep.range)) continue; // if out of range, then don't bother.
                            const ang = angleBetween(this, p); // angle from the horizontal
                            const vel = -0.0000001; // this is just symbolic, to jam warp drive
                            p.vx += Math.cos(ang) * vel; // actually accelerate them nothing, but this jams Warp Drive
                            p.vy += Math.sin(ang) * vel;
                            p.gyroTimer = 25; // Make sure the player is drifting or else physics go wonk
                            p.updatePolars(); // We changed their rectangular velocity.
                        }
                    }
                    for (const i in asts[this.sy][this.sx]) {
                        const a = asts[this.sy][this.sx][i];
                        const d2 = squaredDist(this, a);
                        if (d2 > square(10 * wep.range)) continue; // These 10* are because the user sees 1 pixel as .1 distance whereas server sees it as 1 distance... or something like that
                        const ang = angleBetween(this, a);
                        const vel = -1000000 / Math.max(d2, 200000);
                        a.vx += Math.cos(ang) * vel;
                        a.vy += Math.sin(ang) * vel;
                    }
                    for (const i in missiles[this.sy][this.sx]) {
                        const m = missiles[this.sy][this.sx][i];
                        const d2 = squaredDist(this, m);
                        if (d2 > square(10 * wep.range)) continue;
                        const ang = angleBetween(this, m);
                        const vel = -10000000 / Math.max(d2, 2000000);
                        m.emvx += Math.cos(ang) * vel;
                        m.emvy += Math.sin(ang) * vel;
                    }
                    for (const i in orbs[this.sy][this.sx]) {
                        const o = orbs[this.sy][this.sx][i];
                        const d2 = squaredDist(this, o);
                        if (d2 > square(10 * wep.range)) continue;
                        const ang = angleBetween(this, o);
                        const vel = -25000000 / Math.max(d2, 2000000);
                        o.vx += Math.cos(ang) * vel;
                        o.vy += Math.sin(ang) * vel;
                    }
                    for (const i in mines[this.sy][this.sx]) {
                        const m = mines[this.sy][this.sx][i];
                        const d2 = squaredDist(this, m);
                        if (d2 > square(10 * wep.range)) continue;
                        const ang = angleBetween(this, m);
                        const vel = -5000000 / Math.max(d2, 2000000);
                        m.vx += Math.cos(ang) * vel;
                        m.vy += Math.sin(ang) * vel;
                    }
                }
            }

            // Misc

            else if (wep.name === `Turret`) {
                if (this.x < sectorWidth / 4 || this.x > 3 * sectorWidth / 4 || this.y < sectorWidth / 4 || this.y > 3 * sectorWidth / 4) {
                    this.emit(`chat`, { msg: `\`tYour turret must be closer to the center of the sector!\`t`, color: `cyan` });
                    this.space = false;
                    return;
                }
                if (bases[this.sy][this.sx] != 0) {
                    this.emit(`chat`, { msg: `\`tThere can only be one turret or sentry in any sector!\`t`, color: `yellow` });
                    this.space = false;
                    return;
                }
                const r = Math.random();
                const b = new Base(r, TURRET, this.sx, this.sy, this.color, this.x, this.y);
                b.owner = this.name;
                bases[this.sy][this.sx] = b;
                this.emit(`chat`, { msg: `\`tYou placed a turret! Name it with "/nameturret <name>".\`t`, color: `lime` });
            } else if (wep.name === `Sentry`) {
                if (bases[this.sy][this.sx] != 0) {
                    this.emit(`chat`, { msg: `\`tThere can only be one turret or sentry in any sector!\`t`, color: `orange` });
                    this.space = false;
                    return;
                }
                const r = Math.random();
                const b = new Base(r, SENTRY, this.sx, this.sy, this.color, this.x, this.y);
                b.owner = this.name;
                bases[this.sy][this.sx] = b;
                this.emit(`chat`, { msg: `\`tYou placed a turret! Name it with "/nameturret <name>".\`t`, color: `lime` });
            } else if (wep.name === `Turbo`) {
                const isDrifting = (this.e || this.gyroTimer > 0) && (this.a != this.d);
                const mult = wepns[21].speed * (isDrifting ? 1.014 : 1); // Faster when drifting.
                this.speed *= mult;
                this.vx *= mult;
                this.vy *= mult;
                // no need to updatePolars, since force is parallel with the player... i think? is that the case when drifting?

                if (isDrifting && !this.driftAchs[5] && this.w) { // Forced Induction
                    this.driftAchs[5] = true;
                    this.sendAchievementsDrift(true);
                } else if (isDrifting && this.s && !this.driftAchs[10]) { // Reverse Turbo Drift
                    this.driftAchs[10] = true;
                    this.sendAchievementsDrift(true);
                }
            } else if (wep.name === `Hyperdrive`) {
                const isDrifting = (this.e || this.gyroTimer > 0) && (this.a != this.d);
                this.emit(`sound`, { file: `hyperspace`, x: this.x, y: this.y });
                this.hyperdriveTimer = 200;
                if (isDrifting && this.w && !this.driftAchs[6]) { // Hyper-drift
                    this.driftAchs[6] = true;
                    this.sendAchievementsDrift(true);
                }
            }

            // If we run out of ammo on a one-use weapon, delete that weapon.
            if (this.ammos[this.equipped] == -2) {
                this.weapons[this.equipped] = -1;
                this.save(); // And save, to prevent people from shooting then logging out if they don't succeed with it.
            }

            sendWeapons(this);
            this.reload(false, wepId);
        }
    }

    shootEliteWeapon () {
        if (this.rank < this.ship) return;
        if (this.ship == 16) { // Elite Raider
            // if (this.disguise > 0) return;
            // This effectively just shoots turbo.
            const mult = wepns[21].speed * (((this.e || this.gyroTimer > 0) && this.w && (this.a != this.d)) ? 1.016 : 1.01);
            this.speed *= mult;
            this.vx *= mult;
            this.vy *= mult;
        } else if (this.ship == 17 && this.iron >= 250 && this.silver >= 250 && this.copper >= 250 && this.platinum >= 250) { // Quarrier
            if (this.disguise > 0 || this.shield) return;
            this.iron -= 250; // This just shoots an asteroid out of the ship as if it were a bullet.
            this.silver -= 250;
            this.copper -= 250;
            this.platinum -= 250;
            const randId = Math.random();
            const ast = new Asteroid(randId, health, this.sx, this.sy, this.x + Math.cos(this.angle) * 256, this.y + Math.sin(this.angle) * 256, Math.cos(this.angle) * 15, Math.sin(this.angle) * 15, Math.floor(Math.random() * 4));
            asts[this.sy][this.sx][randId] = ast;
        } else if (this.ship == 18) {
            if (this.disguise > 0 || this.shield) return;
            this.shootBullet(39);
        } // Built in spreadshot
        else if (this.ship == 19) {
            // if (this.disguise > 0) return;
            if (this.health < this.maxHealth) this.health++;
        } // Heals you
        else if (this.ship == 20) {
            this.shootBlast(41);
            this.save();
        } // Built in Hypno
        else if (this.ship == 22 && tick % 10 == 0) {
            const ox = this.x; const oy = this.y; // Current emitter coordinates
            let nearBEnemy = 0; // enemy turret target, which we will compute
            let nearPFriendly = 0; // friendly ship target, which we will compute
            let nearPEnemy = 0; // enemy ship target, which we will compute
            let nearA = 0; // asteroid target, which we will compute
            const range2 = square(100 * 10); // Range 100

            // base
            const b = bases[this.sy][this.sx];
            if ((b != 0) && b.baseType != DEADBASE && b.color != this.color && (hypot2(b.x, ox, b.y, oy) < range2)) {
                nearBEnemy = b;
            }

            // search players
            for (const i in players[this.sy][this.sx]) {
                const p = players[this.sy][this.sx][i];
                if (!(p.disguise > 0 || this.id == p.id)) { // You can only heal decloaked teammates.
                    const dx = p.x - ox; const dy = p.y - oy;
                    const dist2 = dx * dx + dy * dy;

                    if (dist2 < range2) {
                        if (p.color == this.color) {
                            if (nearPFriendly == 0 || dist2 < square(nearPFriendly.x - ox) + square(nearPFriendly.y - oy)) nearPFriendly = p;
                        } else {
                            if (nearPEnemy == 0 || dist2 < square(nearPEnemy.x - ox) + square(nearPEnemy.y - oy)) nearPEnemy = p;
                        }
                    }
                }
            }

            // search asteroids
            for (const i in asts[this.sy][this.sx]) {
                const a = asts[this.sy][this.sx][i];
                if (a.sx != this.sx || a.sy != this.sy || a.hit) continue;
                const dx = a.x - ox; const dy = a.y - oy;
                const dist2 = dx * dx + dy * dy;
                if (dist2 < range2 && (nearA == 0 || dist2 < square(nearA.x - ox) + square(nearA.y - oy))) nearA = a;
            }

            if (nearA != 0) {
                const rM = Math.random();
                const beamMe = new Beam(this, rM, 45, this, this); // Healing beam for myself when mining asteroids
                beams[this.sy][this.sx][rM] = beamMe;
                const rA = Math.random();
                const beamA = new Beam(this, rA, 30, nearA, this); // Ore Cannon
                beams[this.sy][this.sx][rA] = beamA;
            }

            if (nearPFriendly == 0 || (nearPEnemy == 0 && nearBEnemy == 0 && nearA == 0)) return;
            this.spoils(`money`, 250); // reward the player for healing a teammate
            this.spoils(`experience`, 10); // The medic gets more experience from healing
            const rfP = Math.random();

            if (nearA != 0) {
                if (nearPFriendly.maxHealth >= (nearPFriendly.health - wepns[45].damage)) {
                    const beamfP = new Beam(this, rfP, 45, nearPFriendly, this); // Healing beam
                    beams[this.sy][this.sx][rfP] = beamfP;
                }
            }
            if (nearPEnemy != 0) {
                const reP = Math.random();
                if (nearPFriendly.maxHealth >= (nearPFriendly.health - wepns[45].damage)) {
                    const beamfP = new Beam(this, rfP, 45, nearPFriendly, this); // Healing beam
                    beams[this.sy][this.sx][rfP] = beamfP;
                }
                const beameP = new Beam(this, reP, 8, nearPEnemy, this); // Laser beam
                beams[this.sy][this.sx][reP] = beameP;
            }
            if (nearBEnemy != 0) {
                const reB = Math.random();
                if (nearPFriendly.maxHealth >= (nearPFriendly.health - wepns[45].damage)) {
                    const beamfP = new Beam(this, rfP, 45, nearPFriendly, this); // Healing beam
                    beams[this.sy][this.sx][rfP] = beamfP;
                }
                const beameB = new Beam(this, reB, 8, nearBEnemy, this); // Laser beam
                beams[this.sy][this.sx][reB] = beameB;
            }

            sendAllSector(`sound`, { file: `beam`, x: ox, y: oy }, this.sx, this.sy);
        } // A healing leech beam, only for helping teammates, or when near an asteroid.

        this.reload(true, 0);
    }

    reload (elite, wepId) {
        if (elite) {
            if (this.ship == 20) this.charge = -wepns[41].charge * 0.95;
            if (this.ship == 18) this.charge = -wepns[39].charge * 0.95;
            if (this.ship == 19 && this.charge > -200) this.charge -= 10 / this.energy2;
            if (this.ship == 17) this.charge = -140;
            return;
        }
        if (wepns[wepId].charge > 12) this.charge = 0;
        else this.charge = -wepns[wepId].charge;
    }

    canShoot (wepId) {
        if (typeof wepns[wepId] === `undefined`) return false;
        if ((this.disguise > 0 && wepId != 18 && wepId != 19 && wepId != 21 && wepId != 22 && wepId != 29 && wepId != 36) || (this.shield && wepns[wepId].type !== `Misc`)) return false;
        const sufficientCharge = this.charge > (wepns[wepId].charge > 12 ? wepns[wepId].charge : 0);
        return this.space && sufficientCharge;
    }

    move () {
        if (this.hyperdriveTimer > 0) {
            this.hyperdriveTimer--;
            this.speed = (wepns[22].speed - square(100 - this.hyperdriveTimer)) / (this.ship == 16 ? 7 : 10);
        }

        if (this.isBot) this.botPlay(); // simulates a player and presses keys.

        const amDrifting = this.e || this.gyroTimer > 0;
        const ore = this.iron + this.silver + this.platinum + this.copper;

        // In english, your thrust is (this.thrust = your ship's thrust * thrust upgrade). Multiply by 1.8. Double if using supercharger. Reduce if carrying lots of ore. If drifting, *=1.6 if elite raider, *=1.45 if not.
        const newThrust = this.thrust * (this.superchargerTimer > 0 ? 2 : 1) * 1.8 / ((ore / this.capacity + 3) / 3.5) * ((amDrifting && this.w && (this.a != this.d)) ? (this.ship == 16 ? 1.6 : 1.45) : 1);

        // Reusable Trig
        const ssa = Math.sin(this.angle); const ssd = Math.sin(this.driftAngle); const csa = Math.cos(this.angle); const csd = Math.cos(this.driftAngle);

        this.vx = csd * this.speed; // convert polars to rectangulars
        this.vy = ssd * this.speed;
        this.vx *= (amDrifting && this.w && (Math.abs(this.cva) > this.va * 0.999)) ? 0.94 : 0.92;
        this.vy *= (amDrifting && this.w && (Math.abs(this.cva) > this.va * 0.999)) ? 0.94 : 0.92; // Air resistance

        if (this.w) { // Accelerate!
            this.vx += csa * newThrust;
            this.vy += ssa * newThrust;
        }
        if (this.s && amDrifting) { // Accelerate backwards, at half speed!
            this.vx -= csa * newThrust / 2;
            this.vy -= ssa * newThrust / 2;
        }

        this.updatePolars();// convert back to polars

        if (!amDrifting) { // Terraced angular decelerationy stuff to continuously match driftAngle (angle of motion) to the actual angle the ship is pointing
            this.noDrift++;
            if (this.noDrift > 18) this.driftAngle = this.angle;
            else if (this.noDrift > 12) this.driftAngle = findBisector(this.driftAngle, this.angle);
            else if (this.noDrift > 7) this.driftAngle = findBisector(findBisector(this.driftAngle, this.angle), this.driftAngle);
            else if (this.noDrift > 3) this.driftAngle = findBisector(findBisector(findBisector(this.driftAngle, this.angle), this.driftAngle), this.driftAngle);
            else this.driftAngle = findBisector(findBisector(findBisector(findBisector(this.driftAngle, this.angle), this.driftAngle), this.driftAngle), this.driftAngle);// This happens immediately after shift released, noDrift increases with time.
        } else { // In drift.
            this.gyroTimer--;
            if (this.a != this.d) {
                if (this.w) this.driftTimer++;
                else if (this.s && !this.driftAchs[7]) { // I can go backwards!?!
                    this.driftAchs[7] = true;
                    this.sendAchievementsDrift(true);
                }
            }
            this.noDrift = 0; // Time elapsed since last drift
        }

        this.x += this.vx; // Update position from velocity
        this.y += this.vy;
        if (this.jukeTimer > 1 || this.jukeTimer < -1) { // Q or E keys. Juke mechanics.
            this.x += this.jukeTimer * Math.sin(this.angle);
            this.y -= this.jukeTimer * Math.cos(this.angle);
            this.jukeTimer *= 0.8;
        }

        let angAccel = 0; // angular acceleration
        if (this.a) angAccel -= (this.va + this.cva / (amDrifting ? 1.5 : 1)) / 3;
        if (this.d) angAccel += (this.va - this.cva / (amDrifting ? 1.5 : 1)) / 3; // ternary reduces angular air resistance while drifting
        if (this.superchargerTimer > 0) angAccel *= 2;
        this.cva += angAccel; // update angular velofity from thrust
        if (!this.d && !this.a && !amDrifting) this.cva /= 2; // When not drifting, apply air resistance to angular velocity.

        // If we have a drift trail, we turn faster. Generators reduce turning speed.
        this.angle += this.cva * (1 - this.generators / 10) * (this.trail % 16 == 3 ? 1.05 : 1) / 1.5;

        // Make sure everything is in the range 0-2pi
        this.driftAngle += Math.PI * 4;
        this.angle += Math.PI * 4;
        this.driftAngle %= Math.PI * 2;
        this.angle %= Math.PI * 2;

        this.testSectorChange();

        if (tick % 15 == 0) this.checkQuestStatus(false);
        if (tick % 2 == 0) return;

        this.checkMineCollision();
    }

    checkMineCollision () {
        for (const i in mines[this.sy][this.sx]) {
            const m = mines[this.sy][this.sx][i];
            if (m.color != this.color && m.wepnID != 32 && m.wepnID != 44) { // enemy mine and not either impulse or campfire
                if (m.wepnID != 16 && squaredDist(m, this) < square(16 + ships[this.ship].width)) {
                    this.dmg(m.dmg, m); // damage me
                    if (m.wepnID == 17) this.EMP(160); // emp mine
                    m.die();
                    break;
                } else if (m.wepnID == 16 && squaredDist(m, this) < square(wepns[m.wepnID].range + ships[this.ship].width)) { // TODO range * 10?
                    const r = Math.random(); // Laser Mine
                    const beam = new Beam(m.owner, r, m.wepnID, this, m); // m.owner is the owner, m is the origin location
                    beams[this.sy][this.sx][r] = beam;
                    sendAllSector(`sound`, { file: `beam`, x: m.x, y: m.y }, m.sx, m.sy);
                    m.die();
                }
            }
        }
    }

    testSectorChange () {
        const old_sx = this.sx;
        const old_sy = this.sy;

        let giveBounce = false; // did they bounce on a galaxy edge?
        if (this.x > sectorWidth) { // check each edge of the 4 they could bounce on
            this.x = 1;
            if (this.guest || (trainingMode && this.isNNBot)) { // guests cant cross borders, nobody can go outside the galaxy
                giveBounce = true;
                this.x = (sectorWidth - 5);
                this.driftAngle = this.angle = 3.1415 - this.angle;
                this.vx *= -1;
            } else {
                this.sx = (this.sx + 1 + mapSz) % mapSz;
                this.borderJumpTimer += 100;
            }
        } else if (this.y > sectorWidth) {
            this.y = 1;
            if (this.sy == mapSz - 1 || this.guest || (trainingMode && this.isNNBot)) {
                giveBounce = true;
                this.y = (sectorWidth - 5);
                this.driftAngle = this.angle = -this.angle;
                this.vy *= -1;
            } else {
                this.sy++;
                this.borderJumpTimer += 100;
            }
        } else if (this.x < 0) {
            this.x = (sectorWidth - 1);
            if (this.guest || (trainingMode && this.isNNBot)) {
                giveBounce = true;
                this.x = 5;
                this.driftAngle = this.angle = 3.1415 - this.angle;
                this.vx *= -1;
            } else {
                this.sx = (this.sx - 1 + mapSz) % mapSz;
                this.borderJumpTimer += 100;
            }
        } else if (this.y < 0) {
            this.y = (sectorWidth - 1);
            if (this.sy == 0 || this.guest || (trainingMode && this.isNNBot)) {
                giveBounce = true;
                this.y = 5;
                this.driftAngle = this.angle = -this.angle;
                this.vy *= -1;
            } else {
                this.sy--;
                this.borderJumpTimer += 100;
            }
        }
        if (giveBounce && !this.randmAchs[5]) {
            if (this.guest) this.emit(`chat`, { msg: `~\`orange~\`\`tYou must create an account to explore the universe!\`t` });
            else {
                this.randmAchs[5] = true;
                this.sendAchievementsMisc(true);
            }
        }

        if (this.hyperdriveTimer <= 0 && this.borderJumpTimer > 100) { // damage for running away from fights, hyperdrive won't automatically trigger it
            this.health = (this.health - 1) * 0.9 + 1;
            this.borderJumpTimer = 50;
        }

        if (old_sx !== this.sx || old_sy !== this.sy) {
            delete players[old_sy][old_sx][this.id];

            players[this.sy][this.sx][this.id] = this;
            this.onChangeSectors();
        }
    }

    juke (left) {
        if (this.charge < 0) return;
        this.charge = -10;
        this.jukeTimer = (this.trail % 16 == 4 ? 1.25 : 1) * (left ? 50 : -50); // misc trail makes you juke further.
    }

    mute (minutes) {
        chatAll(`${this.nameWithColor()} has been ${minutes > 0 ? `muted for ${minutes} minutes!` : `unmuted!`}`);
    }

    onChangeSectors () {
    // track my touched corners
        if (this.sx == 0) {
            if (this.sy == 0 && (this.cornersTouched & 1) != 1) this.cornersTouched++;
            else if (this.sy == mapSz - 1 && (this.cornersTouched & 2) != 2) this.cornersTouched += 2;
        } else if (this.sx == mapSz - 1) {
            if (this.sy == 0 && (this.cornersTouched & 4) != 4) this.cornersTouched += 4;
            else if (this.sy == mapSz - 1 && (this.cornersTouched & 8) != 8) this.cornersTouched += 8;
        }
        if (this.cornersTouched == 15) {
            this.randmAchs[7] = true;
            this.sendAchievementsMisc(true);
        }

        if ((this.sx % 3 == 2 && this.sy == 4) && this.quest.type === `Secret3`) {
            this.spoils(`money`, this.quest.exp); // reward the player
            this.spoils(`experience`, Math.floor(this.quest.exp / 4000));

            this.hasPackage = false;
            if ((this.questsDone & 8) == 0) this.questsDone += 8;

            this.quest = 0; // reset quest and tell the client
            this.emit(`quest`, { quest: this.quest, complete: true });

            if (!this.moneyAchs[9]) { // Questor
                this.moneyAchs[9] = true;
                this.sendAchievementsCash(true);
            }
            if (this.questsDone == 15 && !this.moneyAchs[10]) { // Adventurer
                this.moneyAchs[10] = true;
                this.sendAchievementsCash(true);
            }
        }

        if (this.quest != 0 && this.quest.type === `Secret` && this.sx == this.quest.sx && this.sy == this.quest.sy) { // advance in secret quest to phase 2
            this.quest = { type: `Secret2`, exp: this.quest.exp, sx: this.quest.sx, sy: this.quest.sy };
            this.emit(`quest`, { quest: this.quest, complete: false });
        }

        // tell client what's in this sector
        this.getAllPlanets();

        // update list of visited sectors.
        const index = this.sx + this.sy * mapSz;
        const prevStr = this.planetsClaimed.substring(0, index);
        const checkStr = this.planetsClaimed.substring(index, index + 1);
        const postStr = this.planetsClaimed.substring(index + 1, mapSz * mapSz);
        if (checkStr !== `2`) this.planetsClaimed = `${prevStr}1${postStr}`;

        if (!this.planetsClaimed.includes(`0`) && !this.randmAchs[6]) {
            this.randmAchs[6] = true;
            this.sendAchievementsMisc(true);
        }
    }

    updateRank () {
        const prerank = this.rank;
        this.rank = 0;
        while (this.experience > ranks[this.rank]) this.rank++; // increment until we're in the right rank's range

        if (!this.isBot && this.rank > prerank && this.rank > 5) {
            this.emit(`rank`, {}); // congratulations!
            chatAll(`${this.nameWithColor()} just leveled up to rank ${this.rank}!`);
        }
    }

    checkPlanetCollision () {
        const p = planets[this.sy][this.sx];

        // if out of range, return. Only try this once every fifth of second.
        if (tick % 2 != 0 || squaredDist(p, this) > square(512)) return;

        // cooldown to prevent chat spam when 2 people are on the planet
        const cool = p.cooldown;
        if (cool < 0) {
            this.refillAllAmmo(); p.cooldown = 20;
            this.health += Math.min(Math.max(1, this.health * 0.01), this.maxHealth - this.health);
        }

        this.checkQuestStatus(true); // lots of quests are planet based

        if (this.guest) return; // You must create an account in the base before you can claim planets!

        if (typeof this.quest !== `undefined` && this.quest != 0 && this.quest.type === `Secret2` && this.quest.sx == this.sx && this.quest.sy == this.sy) { // move on to last secret stage
            // compute whether there are any unkilled enemies in this sector
            let cleared = true;
            for (const i in players[this.sy][this.sx]) {
                const player = players[this.sy][this.sx][i];
                if (player.color !== this.color) {
                    cleared = false;
                    break;
                }
            }
            if (bases[this.sy][this.sx] != 0 && bases[this.sy][this.sx].baseType != DEADBASE) cleared = false;// also check base is dead

            if (cleared) { // 2 ifs needed, don't merge this one with the last one
                this.hasPackage = true;
                this.quest = { type: `Secret3`, exp: this.quest.exp };
                this.emit(`quest`, { quest: this.quest, complete: false }); // notify client
            }
        }

        if (p.color === this.color || cool > 0) return;
        if (p.color === `yellow`) {
            chatAll(`Planet ${p.name} colonized by ${this.nameWithColor()}!`); // Colonizing planets. Since this will happen once per planet it will not be spammy
        }
        // else chatAll('Planet ' + p.name + ' claimed by ' + this.nameWithColor() + "!"); This gets bothersome and spammy when people fight over a planet
        p.color = this.color; // claim
        p.owner = this.name;

        for (const i in players[this.sy][this.sx]) players[this.sy][this.sx][i].getAllPlanets();// send them new planet data

        if (!this.randmAchs[8]) { // Astronaut
            this.randmAchs[8] = true;
            this.sendAchievementsMisc(true);
        }

        this.emit(`planetMap`, { x: p.x, y: p.y, sx: p.sx, sy: p.sy });

        // Update list of claimed planets.
        const index = this.sx + this.sy * mapSz;
        const prevStr = this.planetsClaimed.substring(0, index);
        const postStr = this.planetsClaimed.substring(index + 1, mapSz * mapSz);
        this.planetsClaimed = `${prevStr}2${postStr}`;
    }

    checkQuestStatus (touchingPlanet) {}

    shootBullet (currWep) {
        if (this.bulletQueue > 0) { // Submachinegun
            if (this.ammos[this.equipped] <= 0) return;
            this.bulletQueue--;
            this.reload(false, currWep);
            currWep = 40;
        }

        // how many bullets are we firing?
        let n = 1;
        if (currWep == 4) n = 4; // shotgun
        if (currWep == 39) n = 3; // spreadshot
        if (currWep == 6) n = 2; // minigun

        for (let i = 0; i < n; i++) {
            const r = Math.random();

            // find the angle of the bullets. Manipulate if one of the multi-bullet weapons.
            let bAngle = this.angle;
            if (currWep == 2) bAngle -= 3.1415; // reverse gun
            if (currWep == 39) bAngle += ((i - 1) / 3.5); // spreadshot
            if (currWep == 4) bAngle += Math.random() - 0.5; // shotgun
            if (currWep == 40) bAngle += (Math.random() - 0.5) * 0.08; // smg

            const bullet = new Bullet(this, r, currWep, bAngle, i * 2 - 1);
            bullets[this.sy][this.sx][r] = bullet;
            sendAllSector(`sound`, { file: (currWep == 5 || currWep == 6 || currWep == 39) ? `minigun` : `shot`, x: this.x, y: this.y }, this.sx, this.sy);
        }
    }

    shootMissile () {
        const r = Math.random();
        const bAngle = this.angle;
        const missile = new Missile(this, r, this.weapons[this.equipped], bAngle);
        missiles[this.sy][this.sx][r] = missile;
        sendAllSector(`sound`, { file: `missile`, x: this.x, y: this.y }, this.sx, this.sy);
    }

    shootOrb () {
        const r = Math.random();
        const orb = new Orb(this, r, this.weapons[this.equipped]);
        orbs[this.sy][this.sx][r] = orb;
        sendAllSector(`sound`, { file: `beam`, x: this.x, y: this.y }, this.sx, this.sy);
    }

    shootMine () {
        if (Object.keys(mines[this.sy][this.sx]).length >= 20 && (this.weapons[this.equipped] < 30 || this.weapons[this.equipped] == 48 || this.weapons[this.equipped] == 43)) {
            this.ammos[this.equipped]++;
            this.emit(`chat`, { msg: `\`tThis sector has reached its limit of 20 mines.\`t` });
            return;
        }
        if (square(this.sx - sectorWidth / 2) + square(this.sy - sectorWidth / 2) < square(600 * 10)) {
            this.ammos[this.equipped]++;
            this.emit(`chat`, { msg: `\`tYou may not place a mine here.\`t` });
            return;
        }
        const r = Math.random();
        const mine = new Mine(this, r, this.weapons[this.equipped]);
        mines[this.sy][this.sx][r] = mine;
        sendAllSector(`mine`, { x: this.x, y: this.y }, this.sx, this.sy);
    }

    shootBeam (origin, restricted) { // restricted is for recursive calls from quarriers
        const ox = origin.x; const oy = origin.y;
        let nearP = 0; // target, which we will compute
        const range2 = square(wepns[this.weapons[this.equipped]].range * 10);

        // base
        if (!restricted) {
            if (this.weapons[this.equipped] == 7 || this.weapons[this.equipped] == 8 || this.weapons[this.equipped] == 9 || this.weapons[this.equipped] == 45) {
                const b = bases[this.sy][this.sx];
                if (b != 0 && ((b.color == this.color) == (this.weapons[this.equipped] == 45)) && !(this.weapons[this.equipped] == 45 && b.health > baseHealth * 0.9995) && b.baseType != DEADBASE && hypot2(b.x, ox, b.y, oy) < range2) nearP = b;
            }
        }

        // search players
        if (!restricted) {
            for (const i in players[this.sy][this.sx]) {
                const p = players[this.sy][this.sx][i];
                if (p.ship != 17 && (this.weapons[this.equipped] == 26 || this.weapons[this.equipped] == 30)) continue; // elite quarrier is affected
                if (((p.color == this.color) != (this.weapons[this.equipped] == 45)) || p.disguise > 0 || this.id == p.id) continue;
                if (this.weapons[this.equipped] == 45 && p.health > p.maxHealth * 0.9995) continue;
                const dx = p.x - ox; const dy = p.y - oy;
                const dist2 = dx * dx + dy * dy;
                if (dist2 < range2 && (nearP == 0 || dist2 < square(nearP.x - ox) + square(nearP.y - oy))) nearP = p;
            }
        }

        // search asteroids
        if (nearP == 0 && this.weapons[this.equipped] != 35 && this.weapons[this.equipped] != 31 && this.weapons[this.equipped] != 45) {
            for (const i in asts[this.sy][this.sx]) {
                const a = asts[this.sy][this.sx][i];
                if (a.sx != this.sx || a.sy != this.sy || a.hit) continue;
                const dx = a.x - ox; const dy = a.y - oy;
                const dist2 = dx * dx + dy * dy;
                if (dist2 < range2 && (nearP == 0 || dist2 < square(nearP.x - ox) + square(nearP.y - oy))) nearP = a;
            }
        }

        if (nearP == 0) return;

        // gyrodynamite
        if (this.weapons[this.equipped] == 31 && nearP.sx == this.sx && nearP.sy == this.sy && nearP.color != this.color) {
            nearP.gyroTimer = 250;
            nearP.emit(`gyro`, { t: 250 });
        }

        // elite quarrier
        if (this.ship == 17 && nearP != 0 && nearP.type === `Asteroid`) {
            nearP.hit = true;
            for (let i = 0; i < 3; i++) this.shootBeam(nearP, true);
        }

        const r = Math.random();
        const beam = new Beam(this, r, this.weapons[this.equipped], nearP, origin);
        beams[this.sy][this.sx][r] = beam;
        sendAllSector(`sound`, { file: `beam`, x: ox, y: oy }, this.sx, this.sy);
    }

    shootBlast (currWep) {
        const r = Math.random();
        const blast = new Blast(this, r, currWep);
        blasts[this.sy][this.sx][r] = blast;
        sendAllSector(`sound`, { file: `beam`, x: this.x, y: this.y }, this.sx, this.sy);
    }

    // Bot specific
    async die (b) {
    }

    dmg (d, origin) {
        if (!players[this.sy][this.sx][this.id]) return; // multi-kill bug

        // reward nn bots for hurting other players
        if (this.isNNBot && origin.type === `Bullet` && origin.owner.type === `Player` && origin.owner.net != 0) {
            origin.owner.net.save(this.isNNBot ? this.net.id : Math.floor(Math.random()));
            this.health -= 10000;
        }

        d /= (this.trail % 16 == 1 ? 1.05 : 1); // blood trail: less damage
        d *= ((this.shield && d > 0) ? 0.25 : 1); // Shield- 1/4th damage. Won't block healing items
        d *= ((this.shield && this.ship == 19) ? 0.5 : 1); // Rank 19 suffers less damage when shielded.
        d *= ((this.shield && this.ship > 19) ? 0.75 : 1); // Ranks above 19 suffer slightly less damage when shielded.
        d *= (this.superchargerTimer > 1 ? 2 : 1); // supercharger inflicts double damage
        if ((this.ship >= 19) && d < 1.5 && d > 0) d = 0; // Too weak attacks won't strain the hull of the ship.

        this.health -= d;
        if (this.health > this.maxHealth) this.health = this.maxHealth;
        if (this.health < 0) this.die(origin);

        if (d > 0) note(`-${Math.floor(d)}`, this.x, this.y - 64, this.sx, this.sy); // e.g. "-8" pops up on screen to mark 8 hp was lost (for all players)
        if (d == 0) note(`No dmg`, this.x, this.y - 64, this.sx, this.sy); // e.g. "No dmg" pops up on screen to mark the attack didn't do damage (for all players)
        if (d < 0) note(`+${Math.floor(Math.abs(d))}`, this.x, this.y - 64, this.sx, this.sy); // e.g. "+8" pops up on screen to mark 8 hp were healed (for all players)
        this.emit(`dmg`, {});
        return this.health < 0;
    }

    EMP (t) {
        if (this.empTimer > 0) return; // emps don't stack. can't emp an already emp's ship.
        this.empTimer = t;
        if (!this.isBot) this.emit(`emp`, { t: t });
    }

    save () {}

    onKill (p) {
    // kill streaks
    // Don't award for guest kills
        if (!p.guest && p.color !== this.color) {
            this.killStreak++;
            this.killStreakTimer = 750;// 30s
        }

        if (this.ship == 19) {
            for (const i in players[this.sy][this.sx]) {
                const p = players[this.sy][this.sx][i];
                if (p.color !== this.color) {
                    if (p.isBot) p.EMP(100); // Original 70
                    else p.EMP(40); // Temporary measure until this EMP nonsense if fixed
                }
            }
            if (bases[this.sy][this.sx] != 0 && bases[this.sy][this.sx].color !== this.color && bases[this.sy][this.sx].baseType != DEADBASE) {
                const b = bases[this.sy][this.sx];
                b.EMP(150);
            }
            this.health += Math.min(Math.max(5, this.maxHealth * 0.03), this.maxHealth - this.health);
        }

        this.kills++;
    }

    // Player_MP stubs
    onMined (a) {}
    sendAchievementsKill (note) {}
    sendAchievementsCash (note) {}
    sendAchievementsDrift (note) {}
    sendAchievementsMisc (note) {}
    sendStatus () {}
    checkMoneyAchievements () {}
    checkDriftAchs () {}
    checkTrailAchs () {}
    baseKilled () {}
    getAllPlanets () {}

    updatePolars () { // Convert my rectangular motion/position data to polar
        this.driftAngle = Math.atan2(this.vy, this.vx);
        this.speed = Math.sqrt(square(this.vy) + square(this.vx));
    }

    refillAmmo (i) {
        if (typeof wepns[this.weapons[i]] !== `undefined`) this.ammos[i] = wepns[this.weapons[i]].ammo;
    }

    refillAllAmmo () {
        let ammoHasChanged = false;
        for (let i = 0; i < 10; i++) {
    	const beforeAmmo = this.ammos[i];
            this.refillAmmo(i);
            if (beforeAmmo != this.ammos[i]) ammoHasChanged = true;
        }
        if (!ammoHasChanged) return;
        sendWeapons(this);
        this.strongLocal(`Ammo Replenished!`, this.x, this.y + 256);
    }

    testAfk () {
        return false;
    }

    calculateGenerators () { // count how many gens I have
        this.generators = 0;
        if (this.ship == 22) {
            for (let slot = 0; slot < 10; slot++) {
                if (this.weapons[slot] == 20) this.generators++;
            }
        } else {
            for (let slot = 0; slot < ships[this.ship].weapons; slot++) {
                if (this.weapons[slot] == 20) this.generators++;
            }
        }
        if (this.ship <= wepns[20].level) this.generators = 0; // gotta have sufficiently high ship
    }

    spoils (type, amt) { /* gives you something. Called wenever you earn money / exp / w/e */ }

    nameWithColor () { // returns something like "~`green~`[O] 2swap~`yellow~`"
        return `~\`${this.color}~\`${this.name}~\`yellow~\``;
    }

    noteLocal (msg, x, y) {}
    strongLocal (msg, x, y) {}

    botPlay () {}
    emit (a, b) {}
}

module.exports = Player;
