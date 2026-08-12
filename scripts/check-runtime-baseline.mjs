import process from 'node:process'

const [major, minor] = process.versions.node.split('.').map(Number)
const supported = (major === 22 && minor >= 13) || major === 23 || major === 24

if (!supported) {
  process.stderr.write(`Unsupported Node.js ${process.versions.node}. Use Node 22.13 through Node 24 (see .nvmrc).\n`)
  process.exit(1)
}

process.stdout.write(`OK - Node.js ${process.versions.node} satisfies the release runtime baseline.\n`)
