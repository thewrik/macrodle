import assert from 'node:assert/strict';
import { DATA } from '../data.js';
import { createMacrodleGame, COLS, computeRanges, pickCountriesForTier } from '../app.js';

assert.equal(DATA.length, 20);
assert.equal(COLS.some(c => c.key === 'geo'), true);
assert.equal(computeRanges(DATA).gdp > 0, true);
assert.equal(pickCountriesForTier(DATA, 'surprise').some(c => c.name === 'Turkey'), true);
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
