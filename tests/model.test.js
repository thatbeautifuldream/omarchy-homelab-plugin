#!/usr/bin/env node

const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const context = {}
const source = fs.readFileSync(path.join(__dirname, "..", "Model.js"), "utf8")
vm.runInNewContext(source, context, { filename: "Model.js" })

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

function test(name, callback) {
  callback()
  console.log("ok - " + name)
}

test("parses IPv4, IPv6, and bare socket endpoints", function() {
  assert.deepEqual(plain(context.parseEndpoint("127.0.0.1:8080")), {
    address: "127.0.0.1",
    port: 8080,
  })
  assert.deepEqual(plain(context.parseEndpoint("[::1]:443")), {
    address: "::1",
    port: 443,
  })
  assert.deepEqual(plain(context.parseEndpoint("5432")), {
    address: "5432",
    port: 0,
  })
})

test("parses Docker host mappings and container-only ports", function() {
  assert.deepEqual(plain(context.parseDockerAddress("0.0.0.0:5432")), {
    address: "0.0.0.0",
    port: 5432,
  })
  assert.deepEqual(plain(context.parseDockerAddress("5432")), {
    address: "container",
    port: 5432,
  })
})

test("merges Docker mappings and partitions system services", function() {
  const input = [
    'SS\ttcp\tLISTEN\t0\t128\t0.0.0.0:8080\t0.0.0.0:*\tusers:(("node",pid=42,fd=1))\tOMH_START=12345\tOMH_COMM=node',
    'SS\ttcp\tLISTEN\t0\t128\t127.0.0.1:8080\t0.0.0.0:*\tusers:(("node",pid=42,fd=1))\tOMH_START=12345\tOMH_COMM=node',
    'DOCKER\tweb\t0.0.0.0:8080->80/tcp, :::8080->80/tcp',
    'DOCKER\tdb\t5432/tcp',
  ].join("\n")
  const services = context.parsePorts(input)
  const partitions = context.partitionServices(services)

  assert.equal(services.length, 4)
  assert.deepEqual(plain(services[0].pids), [42])
  assert.deepEqual(plain(services[0].pidIdentities), [{ pid: 42, start: "12345", comm: "node" }])
  assert.deepEqual(plain(partitions.primary.map(context.serviceTitle)), ["web", "node"])
  assert.deepEqual(plain(partitions.system.map(context.endpointText)), ["[::]:8080", "db:5432"])
  assert.equal(context.likelyUrl(partitions.primary[0]), "http://127.0.0.1:8080")
  assert.equal(context.killable(partitions.primary[0]), false)
  assert.equal(context.killable(partitions.primary[1]), true)
  assert.equal(context.killPid(partitions.primary[1]), 42)
  assert.deepEqual(plain(context.killIdentity(partitions.primary[1])), {
    pid: 42,
    start: "12345",
    comm: "node",
    proto: "TCP",
    address: "127.0.0.1",
    port: 8080,
  })
})

test("requires stable process identity before kill", function() {
  const input = 'SS\ttcp\tLISTEN\t0\t128\t127.0.0.1:3000\t0.0.0.0:*\tusers:(("node",pid=77,fd=1))'
  const services = context.parsePorts(input)

  assert.equal(context.killable(services[0]), false)
  assert.equal(context.killPid(services[0]), 0)
  assert.equal(context.killIdentity(services[0]), null)
})

test("caps parsed service count", function() {
  const lines = []
  for (let i = 0; i < context.MAX_SERVICES + 100; i++) {
    lines.push('SS\ttcp\tLISTEN\t0\t128\t127.0.0.1:' + (10000 + i) + '\t0.0.0.0:*\tusers:(("n",pid=' + (1000 + i) + ',fd=1))\tOMH_START=' + (2000 + i) + '\tOMH_COMM=n')
  }

  const services = context.parsePorts(lines.join("\n"))
  assert.equal(services.length, context.MAX_SERVICES)
})

test("caps parser input rows and process text", function() {
  const longName = "n".repeat(context.MAX_TEXT_CHARS * 2)
  const lines = []
  for (let i = 0; i < context.MAX_INPUT_LINES + 100; i++) {
    lines.push('SS\ttcp\tLISTEN\t0\t128\t127.0.0.1:' + (10000 + i) + '\t0.0.0.0:*\tusers:(("' + longName + '",pid=' + (1000 + i) + ',fd=1))\tOMH_START=' + (2000 + i) + '\tOMH_COMM=' + longName)
  }

  const services = context.parsePorts(lines.join("\n"))
  assert.equal(services.length > 0, true)
  assert.equal(services.length <= context.MAX_SERVICES, true)
  assert.equal(services[0].processes[0].length <= context.MAX_TEXT_CHARS + 8, true)
  assert.equal(services[0].process.length <= context.MAX_PROCESS_TEXT_CHARS, true)
})
