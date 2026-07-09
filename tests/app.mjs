import assert from 'node:assert/strict';
import { DATA } from '../data.js';
import { createMacrodleGame, COLS, computeRanges, pickCountriesForTier } from '../app.js';

assert.ok(DATA.length >= 180, `expected broad macro coverage, got ${DATA.length}`);
assert.ok(DATA.every(c => Number.isFinite(c.lat) && Number.isFinite(c.lng)), 'all countries need coordinates');
assert.ok(DATA.every(c => Number.isFinite(c.gdp) && Number.isFinite(c.inf) && Number.isFinite(c.rate) && Number.isFinite(c.ca) && Number.isFinite(c.debt)), 'all countries need numeric macro fields');
assert.ok(DATA.some(c => c.name === 'United States' && c.aliases?.includes('USA')), 'United States should include common aliases');
assert.ok(DATA.some(c => c.name === 'Türkiye' || c.aliases?.includes('Türkiye')), 'Türkiye/Turkey spelling should be accepted');
assert.equal(COLS.some(c => c.key === 'geo'), true);
assert.equal(computeRanges(DATA).gdp > 0, true);
assert.equal(pickCountriesForTier(DATA, 'surprise').some(c => c.name === 'Türkiye' || c.aliases?.includes('Türkiye')), true);
assert.equal(pickCountriesForTier(DATA, 'easy').some(c => c.name === 'United States'), true);

const game = createMacrodleGame(DATA);
const first = game.guess('usa');
assert.equal(first.ok, true);
assert.equal(first.evaluation.row.length, COLS.length);
assert.equal(game.guess('United States').reason, 'duplicate');
assert.equal(game.guess('Atlantis').reason, 'not_found');

const practiceTarget = DATA.find(c => c.name === 'Japan');
game.start({ target: practiceTarget });
const win = game.guess('Japan');
assert.equal(win.win, true);
assert.equal(win.answer.name, 'Japan');
assert.match(game.shareText(), /MACRODLE/);

console.log('macrodle tests passed');
