function parseEndpoint(value) {
  var text = String(value || "")
  var bracket = text.match(/^\[(.*)\]:(\d+)$/)
  if (bracket) return { address: bracket[1], port: parseInt(bracket[2], 10) }

  var index = text.lastIndexOf(":")
  if (index < 0) return { address: text, port: 0 }

  return {
    address: text.slice(0, index),
    port: parseInt(text.slice(index + 1), 10) || 0,
  }
}

function appendProcess(service, proc) {
  if (service.processes.indexOf(proc) < 0) service.processes.push(proc)
}

function processName(line) {
  var match = String(line || "").match(/users:\(\(\"([^\"]+)\",pid=(\d+)/)
  if (!match) return "system"
  return match[1] + " #" + match[2]
}

function scopeFor(address) {
  var value = String(address || "")
  if (value === "127.0.0.1" || value === "::1") return "local"
  if (value.indexOf("127.0.0.") === 0) return "local"
  if (value === "0.0.0.0" || value === "*") return "all interfaces"
  if (value === "::") return "all interfaces"
  if (value.indexOf("224.") === 0 || value.toLowerCase().indexOf("ff") === 0) return "multicast"
  return "network"
}

function addService(byEndpoint, order, proto, state, address, port, scope, proc) {
  if (!port) return

  var key = proto + "|" + address + "|" + port
  if (!byEndpoint[key]) {
    byEndpoint[key] = {
      proto: proto,
      state: state,
      address: address,
      port: port,
      scope: scope,
      processes: [],
    }
    order.push(key)
  }

  appendProcess(byEndpoint[key], proc)
}

function parseSsLine(payload, byEndpoint, order) {
  var parts = String(payload || "").trim().split(/\s+/)
  if (parts.length < 5) return

  var proto = parts[0].toUpperCase()
  var state = parts[1]
  var endpoint = parseEndpoint(parts[4])
  addService(byEndpoint, order, proto, state, endpoint.address, endpoint.port, scopeFor(endpoint.address), processName(payload))
}

function parseDockerAddress(value) {
  var text = String(value || "")
  var bracket = text.match(/^\[(.*)\]:(\d+)$/)
  if (bracket) return { address: bracket[1], port: parseInt(bracket[2], 10) }

  var index = text.lastIndexOf(":")
  if (index < 0) return { address: "container", port: parseInt(text, 10) || 0 }

  return {
    address: text.slice(0, index),
    port: parseInt(text.slice(index + 1), 10) || 0,
  }
}

function parseDockerLine(payload, byEndpoint, order) {
  var fields = String(payload || "").split("\t")
  if (fields.length < 2) return

  var name = fields[0] || "container"
  var ports = fields.slice(1).join("\t")
  var entries = ports.split(/,\s*/)

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i]
    if (entry === "") continue

    var mapped = entry.match(/^(.+)->(\d+)(?:-\d+)?\/(tcp|udp)$/i)
    if (mapped) {
      var host = parseDockerAddress(mapped[1])
      addService(byEndpoint, order, mapped[3].toUpperCase(), "DOCKER", host.address, host.port, scopeFor(host.address), "docker: " + name)
      continue
    }

    var exposed = entry.match(/^(\d+)(?:-\d+)?\/(tcp|udp)$/i)
    if (exposed)
      addService(byEndpoint, order, exposed[2].toUpperCase(), "DOCKER", name, parseInt(exposed[1], 10) || 0, "container", "docker: " + name)
  }
}

function parsePorts(text) {
  var byEndpoint = {}
  var order = []
  var lines = String(text || "").split(/\r?\n/)

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (line.trim() === "") continue

    if (line.indexOf("SS\t") === 0) parseSsLine(line.slice(3), byEndpoint, order)
    else if (line.indexOf("DOCKER\t") === 0) parseDockerLine(line.slice(7), byEndpoint, order)
    else parseSsLine(line, byEndpoint, order)
  }

  var services = order.map(function(key) {
    var service = byEndpoint[key]
    service.process = service.processes.join(", ")
    service.endpoint = service.address + ":" + service.port
    return service
  })

  services.sort(function(a, b) {
    if (a.scope === "container" && b.scope !== "container") return 1
    if (a.scope !== "container" && b.scope === "container") return -1
    if (a.port !== b.port) return a.port - b.port
    if (a.proto !== b.proto) return a.proto < b.proto ? -1 : 1
    if (a.address !== b.address) return a.address < b.address ? -1 : 1
    return 0
  })

  return services
}
