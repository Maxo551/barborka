// Loads the panel's catalogue (a browser script) in Node, so the Resolve build
// generates its templates from the same cards, defaults and controls.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const window = { GR: { Glyphs: { CHOICES: ['SYMBOLS', 'LETTERS', 'NUMBERS', 'BINARY', 'KANA', 'CODE', 'BLOCKS', 'ASCII', 'WORDS'] } } };
  const code = fs.readFileSync(path.join(__dirname, '../../js/catalog.js'), 'utf8');
  vm.runInNewContext(code, { window });
  return window.GR;
}

module.exports = { load };
