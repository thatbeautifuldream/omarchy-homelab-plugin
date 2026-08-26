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
    'SS\ttcp\tLISTEN\t0\t128\t0.0.0.0:8080\t0.0.0.0:*\tusers:(("node",pid=42,fd=1))',
    'SS\ttcp\tLISTEN\t0\t128\t127.0.0.1:8080\t0.0.0.0:*\tusers:(("node",pid=42,fd=1))',
    'DOCKER\tweb\t0.0.0.0:8080->80/tcp, :::8080->80/tcp',
    'DOCKER\tdb\t5432/tcp',
  ].join("\n")
  const services = context.parsePorts(input)
  const partitions = context.partitionServices(services)

  assert.equal(services.length, 4)
  assert.deepEqual(plain(partitions.primary.map(context.serviceTitle)), ["web", "node"])
  assert.deepEqual(plain(partitions.system.map(context.endpointText)), ["[::]:8080", "db:5432"])
  assert.equal(context.likelyUrl(partitions.primary[0]), "http://127.0.0.1:8080")
})
