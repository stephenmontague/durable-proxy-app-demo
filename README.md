# Durable Proxy — Reference Demo Stack

Runnable reference apps for the [**durable Cloud ↔ Edge proxy**](https://github.com/stephenmontague/durable-proxy-app):
a stand-in **cloud** app, a stand-in **edge** device, and the **Switchyard** operations console. They
exist to *demonstrate and exercise* the proxy end to end — you do **not** need any of them to run the
proxy against your own cloud app and devices.

> The proxy integrates **by contract, not by shared code** — the cloud side is just a Temporal client
> speaking a handful of agreed names + wire-compatible JSON (see
> [The contract](https://github.com/stephenmontague/durable-proxy-app#the-contract-works-from-any-language)
> in the proxy README). These apps are one concrete implementation of that contract, in Java/Spring +
> Next.js.

| Module | What it is |
| --- | --- |
| [`dummy-cloud/`](dummy-cloud/README.md) | Reference cloud app (:8091) — Temporal **client only** (dispatch + control + receive endpoints) |
| [`dummy-edge/`](dummy-edge/README.md) | Reference edge device (:8092, TCP 9001, FTP 2222) — auto-confirms every delivery |
| [`management-ui/`](management-ui/README.md) | **Switchyard** console (:3000, Next.js) — lifecycle, catalog, routing wizard, live Temporal feed |
| [`config/`](config/) | Demo routing/catalog JSON, posted to the cloud's `/control/*` endpoints |

The proxy itself is the [`durable-proxy-app`](https://github.com/stephenmontague/durable-proxy-app)
repo. This stack builds and launches it from **`PROXY_DIR`** (default `../durable-proxy-app`).

---

## Prerequisites

- Java 21, Maven, [`just`](https://github.com/casey/just), Node 20+, Temporal CLI **v1.7.0+**
- A local Temporal server on `localhost:7233` (**Server 1.31+** with the `activity.enableStandalone`
  dynamic-config flag — the Standalone Activities the inbound path uses are a Public Preview feature).
  A Docker stack works (`temporalio/server:1.31+`, Web UI <http://localhost:8080>); without Docker,
  `just temporal-dev` starts an equivalent CLI dev server (Web UI <http://localhost:8233>).
- The **proxy repo checked out next to this one** (or `PROXY_DIR` pointed at it):

  ```
  ~/code/
  ├── durable-proxy-app/        # the proxy (product)
  └── durable-proxy-app-demo/   # this repo
  ```

## Quick start — one command

`just up` starts Temporal (if needed), builds the proxy (from `PROXY_DIR`) + cloud + edge, and
launches all four services on the `demo` namespace, backgrounding each to `logs/`:

```sh
just up                  # whole stack on the `demo` namespace  (just up <ns> for another)
just logs proxy          # tail any service: temporal | proxy | cloud | edge | ui
just restart edge        # rebuild + bounce one service, leave the rest up
just down                # stop everything just up started
```

Point at a proxy checkout elsewhere with `PROXY_DIR=/path/to/durable-proxy-app just up`.

Once up: **Switchyard** at <http://localhost:3000>, cloud API at <http://localhost:8091>, Temporal UI
at <http://localhost:8080>.

## Drive a few round trips

With the stack up, from another terminal:

```sh
just demo-command        # DEVICE_COMMAND → device → COMMAND_RESULT → cloud (HTTP)
just demo-config-tcp     # CONFIG_UPDATE  → device → CONFIG_ACK     → cloud (TCP)
just demo-report-ftp     # REPORT_REQUEST → device → REPORT_UPLOAD  → cloud (FTP)
just demo-disable        # remote soft-off (ingress stops, outbound pauses, egress stays up)
just demo-enable         # remote resume
just demo-apply-config   # hot routing reload (config/sample-routes.json), no restart
just demo-catalog        # define a custom message type at runtime (xml codec), no restart
```

> **These type names and paths are the harness's, not the proxy's.** `DEVICE_COMMAND`,
> `COMMAND_RESULT`, the ingress path `/command-result`, and the cloud endpoint `/api/command-result`
> come from these reference apps. The proxy bakes in none of it — a fresh proxy boots with the
> `empty` profile (no types at all). Against your own device and cloud you use whatever names *they*
> use. See the proxy README's
> [Message Types & Devices](https://github.com/stephenmontague/durable-proxy-app#message-types--devices).

## Run the apps individually

Prefer separate terminals? Start Temporal and the proxy first, then:

```sh
just temporal-dev        # (no-Docker Temporal, if you don't have the Docker stack)
just run-dummy-cloud     # reference cloud  (:8091)
just run-dummy-edge      # reference edge   (:8092 + TCP 9001 + FTP 2222)
just run-ui              # Switchyard console at http://localhost:3000
```

Run the proxy from its own repo (`just run-proxy` / `just run-proxy-managed` there).

## More demos

- **Persistent TCP sessions** — the proxy keeps a heartbeated socket open to the device:
  `just run-dummy-edge-persistent` then `just demo-config-persistent`. Design + internals:
  [persistent-tcp-sessions.md](https://github.com/stephenmontague/durable-proxy-app/blob/main/docs/persistent-tcp-sessions.md)
  in the proxy repo.
- **Multi-sandbox** — the same binaries become two totally different clients (warehouse + smart-grid)
  by config alone: [`docs/multi-sandbox-demo.md`](docs/multi-sandbox-demo.md).

## How the apps reach each other

Egress-only proxy: devices connect to the proxy on the LAN (or the proxy dials them); the proxy only
dials out to Temporal and to the cloud app.

| App | Reaches | Via |
| --- | --- | --- |
| `dummy-cloud` | Temporal + proxy | `cloud.temporal.target 127.0.0.1:7233`; workflow id `proxy-control`, queues `proxy-main`/`proxy-control` (contract only) |
| `dummy-edge` | proxy ingress | `edge.proxy.http-base http://localhost:8090`, TCP `127.0.0.1:6001`, FTP `127.0.0.1:2221` |
| `management-ui` | Temporal (reads/lifecycle) + `dummy-cloud` (config writes/demo) | `TEMPORAL_ADDRESS localhost:7233`, `DUMMY_CLOUD_URL http://localhost:8091` (see `management-ui/.env.example`) |
| proxy → cloud | edge→cloud delivery POSTs | `proxy.cloud.base-url http://localhost:8091` (set in the proxy repo) |

Ports: proxy `8090` · cloud `8091` · edge `8092` · UI `3000` · Temporal `7233` (UI 8080 Docker / 8233 dev-server).

## License

[MIT](LICENSE)
