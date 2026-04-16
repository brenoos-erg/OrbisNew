const assert = require('node:assert/strict')
const fs = require('node:fs')

const access = fs.readFileSync('src/lib/sst/access.ts', 'utf8')

assert.match(access, /SST_MODULE_ALIASES = \['sgi-qualidade', 'sgi_qualidade'\]/)
assert.match(access, /SST_MODULE_ALIASES\.map\(\(key\) => levels\[key\] \?\? levels\[key\.toUpperCase\(\)\]\)\.find\(Boolean\)/)

console.log('sgi-quality-access-aliases ok')
