var MAX_INPUT_CHARS = 65536
var MAX_INPUT_LINES = 512
var MAX_SERVICES = 256
var MAX_DOCKER_ENTRIES = 64
var MAX_PROCESSES_PER_SERVICE = 4
var MAX_TEXT_CHARS = 192
var MAX_PROCESS_TEXT_CHARS = 768

function boundedText(value, max) {
  var text = String(value || "")
  var limit = Number(max || MAX_TEXT_CHARS)
  return text.length > limit ? text.slice(0, limit) : text
}

function parseHostPort(value, defaultAddress, parseBarePort) {
  var text = boundedText(value, MAX_TEXT_CHARS)
  var bracket = text.match(/^\[(.*)\]:(\d+)$/)
  if (bracket) return { address: bracket[1], port: parseInt(bracket[2], 10) }

  var index = text.lastIndexOf(":")
  if (index < 0) {
    return {
      address: defaultAddress === undefined ? text : defaultAddress,
      port: parseBarePort ? parseInt(text, 10) || 0 : 0,
    }
  }

  return {
    address: text.slice(0, index),
    port: parseInt(text.slice(index + 1), 10) || 0,
  }
}

function parseEndpoint(value) {
  return parseHostPort(value)
}

function appendProcess(service, proc) {
  var value = boundedText(proc || "system", MAX_TEXT_CHARS)
  if (service.processes.length >= MAX_PROCESSES_PER_SERVICE) return
  if (service.processes.indexOf(value) < 0) service.processes.push(value)
}

function appendPid(service, pid, start, comm) {
  var value = Number(pid) || 0
  if (value <= 0 || service.pids.length >= MAX_PROCESSES_PER_SERVICE) return
  if (service.pids.indexOf(value) >= 0) return

  service.pids.push(value)
  service.pidIdentities.push({
    pid: value,
    start: boundedText(start, MAX_TEXT_CHARS),
    comm: boundedText(comm, MAX_TEXT_CHARS),
  })
}

function processInfo(line) {
  var text = String(line || "")
  var match = text.match(/users:\(\(\"([^\"]+)\",pid=(\d+)/)
  if (!match) return { name: "system", pid: 0, start: "", comm: "" }

  var pid = parseInt(match[2], 10)
  var start = text.match(/\tOMH_START=([0-9]+)/)
  var comm = text.match(/\tOMH_COMM=([^\t\s]+)/)
  var name = boundedText(match[1], MAX_TEXT_CHARS)
  return {
    name: name + " #" + pid,
    pid: pid,
    start: start ? start[1] : "",
    comm: comm ? boundedText(comm[1], MAX_TEXT_CHARS) : name,
  }
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

function addService(byEndpoint, order, proto, address, port, scope, proc, pid, start, comm) {
  if (!port) return

  proto = boundedText(proto, MAX_TEXT_CHARS)
  address = boundedText(address, MAX_TEXT_CHARS)
  scope = boundedText(scope, MAX_TEXT_CHARS)

  var key = proto + "|" + address + "|" + port
  if (!byEndpoint[key]) {
    if (order.length >= MAX_SERVICES) return
    byEndpoint[key] = {
      proto: proto,
      address: address,
      port: port,
      scope: scope,
      processes: [],
      pids: [],
      pidIdentities: [],
    }
    order.push(key)
  }

  appendProcess(byEndpoint[key], proc)
  appendPid(byEndpoint[key], pid, start, comm)
}


function parseSsLine(payload, byEndpoint, order) {
  var parts = String(payload || "").trim().split(/\s+/)
  if (parts.length < 5) return

  var proto = parts[0].toUpperCase()
  var endpoint = parseEndpoint(parts[4])
  var process = processInfo(payload)
  addService(byEndpoint, order, proto, endpoint.address, endpoint.port, scopeFor(endpoint.address), process.name, process.pid, process.start, process.comm)
}

function parseDockerAddress(value) {
  return parseHostPort(value, "container", true)
}

function parseDockerLine(payload, byEndpoint, order) {
  var fields = String(payload || "").split("\t")
  if (fields.length < 2) return

  var name = boundedText(fields[0] || "container", MAX_TEXT_CHARS)
  var ports = boundedText(fields.slice(1).join("\t"), MAX_PROCESS_TEXT_CHARS)
  var entries = ports.split(/,\s*/)

  for (var i = 0; i < entries.length && i < MAX_DOCKER_ENTRIES; i++) {
    var entry = boundedText(entries[i], MAX_TEXT_CHARS)
    if (entry === "") continue

    var mapped = entry.match(/^(.+)->(\d+)(?:-\d+)?\/(tcp|udp)$/i)
    if (mapped) {
      var host = parseDockerAddress(mapped[1])
      addService(byEndpoint, order, mapped[3].toUpperCase(), host.address, host.port, scopeFor(host.address), "docker: " + name)
      continue
    }

    var exposed = entry.match(/^(\d+)(?:-\d+)?\/(tcp|udp)$/i)
    if (exposed)
      addService(byEndpoint, order, exposed[2].toUpperCase(), name, parseInt(exposed[1], 10) || 0, "container", "docker: " + name)
  }
}


function parsePorts(text) {
  var byEndpoint = {}
  var order = []
  var lines = boundedText(text, MAX_INPUT_CHARS).split(/\r?\n/)

  for (var i = 0; i < lines.length && i < MAX_INPUT_LINES; i++) {
    var line = boundedText(lines[i], MAX_PROCESS_TEXT_CHARS)
    if (line.trim() === "") continue

    if (line.indexOf("SS\t") === 0) parseSsLine(line.slice(3), byEndpoint, order)
    else if (line.indexOf("DOCKER\t") === 0) parseDockerLine(line.slice(7), byEndpoint, order)
    else parseSsLine(line, byEndpoint, order)
  }

  var services = order.map(function(key) {
    var service = byEndpoint[key]
    service.process = boundedText(service.processes.join(", "), MAX_PROCESS_TEXT_CHARS)
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

function portIn(port, ports) {
  for (var i = 0; i < ports.length; i++) {
    if (port === ports[i]) return true
  }
  return false
}

var internalProcessHints = [
  "avahi", "chatgpt", "chrome", "code", "cups", "dnsmasq", "electron",
  "mdns", "omp", "quickshell", "resolved", "sshd", "systemd", "tailscale"
]

var infrastructurePorts = [
  22, 53, 67, 68, 111, 123, 137, 138, 139, 161, 162, 389, 445,
  500, 514, 515, 546, 631, 1900, 3306, 5353, 5355, 5432, 6379,
  11211, 27017
]

var webPorts = [
  80, 443, 3000, 3001, 3002, 4000, 4173, 4200, 5000, 5001, 5173,
  5174, 5601, 7000, 8000, 8001, 8008, 8080, 8081, 8082, 8090,
  8123, 8200, 8443, 8888, 9000, 9001, 9090, 9091, 9443, 10000
]

function serviceTextBlob(service) {
  return String(service && service.process || "").toLowerCase()
}

function hasNamedProcess(service) {
  var process = serviceTextBlob(service)
  return process !== "" && process !== "system"
}

function processLooksInternal(service) {
  var process = serviceTextBlob(service)
  for (var i = 0; i < internalProcessHints.length; i++) {
    if (process.indexOf(internalProcessHints[i]) !== -1) return true
  }
  return false
}

function dockerName(service) {
  var parts = String(service && service.process || "").split(/,\s*/)
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].indexOf("docker:") === 0) return parts[i].replace(/^docker:\s*/, "")
  }
  return ""
}

function shortProcess(service) {
  var process = String(service && service.process || "system")
  if (process.indexOf("docker:") !== -1) return dockerName(service)
  return process.replace(/\s+#\d+\b/g, "")
}

function addressClass(address) {
  var value = String(address || "")
  if (value === "0.0.0.0" || value === "*" || value === "::") return "any"
  if (value === "127.0.0.1" || value === "::1" || value.indexOf("127.0.0.") === 0) return "local"
  return value
}

function addressRank(address) {
  var value = String(address || "")
  if (value === "0.0.0.0" || value === "*") return 0
  if (value.indexOf("127.0.0.") === 0) return 1
  if (value === "::") return 2
  if (value === "::1") return 3
  return 4
}

function serviceSignature(service) {
  var docker = dockerName(service)
  var process = docker !== "" ? "docker:" + docker : shortProcess(service)
  return String(service && service.proto || "") + "|" + String(service && service.port || "") + "|" + String(process || "").toLowerCase()
}

function isDuplicateAddress(service, list) {
  if (!service || !list) return false
  var signature = serviceSignature(service)
  var currentClass = addressClass(service.address)
  var currentRank = addressRank(service.address)

  for (var i = 0; i < list.length; i++) {
    var other = list[i]
    if (other === service) continue
    if (serviceSignature(other) !== signature) continue
    if (addressClass(other.address) !== currentClass) continue
    if (addressRank(other.address) < currentRank) return true
  }
  return false
}

function serviceLooksHumanOpenable(service) {
  if (!service) return false

  var proto = String(service.proto || "")
  var scope = String(service.scope || "")
  var port = Number(service.port || 0)
  var docker = dockerName(service)

  if (proto !== "TCP") return false
  if (scope === "container" || scope === "multicast") return false
  if (portIn(port, infrastructurePorts)) return false
  if (docker !== "") return true
  if (processLooksInternal(service)) return false
  if (portIn(port, webPorts)) return true
  if (hasNamedProcess(service) && port >= 1024) return true
  return false
}

function serviceIsSystem(service, list) {
  return !serviceLooksHumanOpenable(service) || isDuplicateAddress(service, list)
}

function partitionServices(list) {
  var primary = []
  var system = []
  var services = list || []

  for (var i = 0; i < services.length; i++) {
    if (serviceIsSystem(services[i], services)) system.push(services[i])
    else primary.push(services[i])
  }

  return { primary: primary, system: system }
}

function endpointText(service) {
  if (!service) return ""
  var address = String(service.address || "")
  if (address.indexOf(":") !== -1 && address.charAt(0) !== "[") address = "[" + address + "]"
  return address + ":" + String(service.port || "")
}

function scopeLabel(service) {
  var scope = String(service && service.scope || "network")
  if (scope === "all interfaces") return "public"
  return scope
}

function serviceTitle(service) {
  var docker = dockerName(service)
  if (docker !== "") return docker

  var process = shortProcess(service)
  if (process !== "" && process !== "system") return process

  return endpointText(service)
}

function serviceSubtitle(service) {
  if (!service) return ""
  var process = shortProcess(service)
  var label = scopeLabel(service)
  var endpoint = endpointText(service)

  if (process !== "" && process !== "system" && process !== serviceTitle(service))
    return endpoint + " · " + label + " · " + process

  return endpoint + " · " + label
}

function urlHost(service) {
  var address = String(service && service.address || "")
  if (address === "0.0.0.0" || address === "*" || address === "::" || address === "") return "127.0.0.1"
  if (address.indexOf(":") !== -1 && address.charAt(0) !== "[") return "[" + address + "]"
  return address
}

function launchable(service, list) {
  if (!service || serviceIsSystem(service, list)) return false
  var scope = String(service.scope || "")
  var address = String(service.address || "")
  if (scope === "container" || scope === "multicast") return false
  return address !== ""
}

function likelyUrl(service) {
  var port = Number(service && service.port || 0)
  var scheme = (port === 443 || port === 8443 || port === 9443 || port === 9444) ? "https" : "http"
  return scheme + "://" + urlHost(service) + ":" + String(port)
}

function killable(service) {
  if (!service || String(service.proto || "") !== "TCP") return false
  if (dockerName(service) !== "") return false
  if (service.scope === "container" || service.scope === "multicast") return false

  var pids = service.pids || []
  var identities = service.pidIdentities || []
  return pids.length === 1
    && Number(pids[0]) > 0
    && identities.length === 1
    && Number(identities[0].pid) === Number(pids[0])
    && String(identities[0].start || "") !== ""
    && String(identities[0].comm || "") !== ""
}

function killPid(service) {
  return killable(service) ? Number(service.pids[0]) : 0
}

function killIdentity(service) {
  if (!killable(service)) return null
  var identity = service.pidIdentities[0]
  return {
    pid: Number(identity.pid),
    start: boundedText(identity.start, MAX_TEXT_CHARS),
    comm: boundedText(identity.comm, MAX_TEXT_CHARS),
    proto: boundedText(service.proto, MAX_TEXT_CHARS),
    address: boundedText(service.address, MAX_TEXT_CHARS),
    port: Number(service.port || 0),
  }
}
