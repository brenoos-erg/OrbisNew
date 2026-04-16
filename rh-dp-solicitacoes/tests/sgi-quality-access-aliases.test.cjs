const assert = require('node:assert/strict')
const fs = require('node:fs')

const access = fs.readFileSync('src/lib/sst/access.ts', 'utf8')

assert.match(access, /SST_MODULE_ALIASES = \['sgi-qualidade', 'sgi_qualidade', 'sgi\/qualidade', 'sgi \/ qualidade'\]/)
assert.match(access, /levels\[key\.replace\(\/\\\/\/g, '-'\)\] \?\? levels\[key\.replace\(\/\\\/\/g, '_'\)\]/)

console.log('sgi-quality-access-aliases ok')
