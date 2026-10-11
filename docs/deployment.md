# Docker deployment notes

The short installation path lives in the Polish [README](../README.md):

```sh
sh scripts/prepare-docker.sh
docker compose up -d --build
```

Use a non-root account with Docker access. The setup script checks Docker,
creates writable directories and updates the container UID/GID in `.env`.
It preserves the port and other existing settings, including when run after
moving the project. It does not change ownership of existing manuals: the
account must already have access to the copied files. Rootless Docker or
user-namespace remapping may require adjusted host ownership.

## Reading the configuration

- `Dockerfile`: two stages, **build** and **runtime**, both on official
  `node:24-bookworm-slim`. Only the runtime server, its traced dependencies,
  static assets, public files and the complete PDF extractor are copied.
  Debian Python uses `/app/.venv` with binary PyMuPDF/Pillow wheels.
- `compose.yaml`: one service. Short bind-mount declarations show exactly
  which host directories are writable inside the otherwise read-only container.
  Setup must run first to prevent Docker creating root-owned mount directories.
- `.env`: `GLOVEBOX_PORT` changes the host port, not the server's internal
  `PORT=3000`. UID/GID are maintained by setup, not manually selected during
  normal installation. `.env` is not passed wholesale to the application.
- `.dockerignore`: an allowlist of build inputs. User data, host dependencies,
  PDFs, environment settings and local runtime files never enter the context.

Compose derives the project and image names from the folder, so independent
copies do not share a fixed container name or image tag. Stop the original
project before renaming/moving it; run setup in the new location and rebuild.
Use another host port if running two copies at once.

| Host directory    | Container directory | Contents                                       |
| ----------------- | ------------------- | ---------------------------------------------- |
| `database/`       | `/app/database/`    | Manuals, import staging, catalogue/logo caches |
| `.runtime/tmp/`   | `/app/tmp/`         | Temporary uploaded PDFs, disk-backed           |
| `.runtime/cache/` | `/app/.next/cache/` | Disposable runtime cache                       |

No host mount hides `/app`, `node_modules` or `.venv`. There are no named
or anonymous application volumes. Normal import success/failure removes PDFs;
a force kill or power failure may leave temporary uploads or `.import-*`
staging. Inspect specific leftovers while stopped before deleting them.

## Small-server build

Next.js standalone output is enabled by `GLOVEBOX_STANDALONE=1` only during
Docker builds. Ordinary `pnpm build` / `pnpm start` remain supported.
`experimental.cpus: 1` reduces page-generation workers, not all Turbopack
threads. `preloadEntriesOnStart: false` reduces initial route loading, but
does not unload modules after use. Type checking remains enabled.

Docker caches the dependency-installation layer; changing source alone does
not reinstall dependencies. There is no additional pnpm cache mount.
JS dependencies use the frozen lockfile and pnpm 11, pinned by `packageManager`
in `package.json` and installed by Corepack. Base images receive
updates with `docker compose build --pull`; Python requirements specify
minimums, not an immutable lock. Rebuild and test updates together.

The runtime has one Node process and at most one import job. Do not scale
replicas: import locks and job state live in memory. Uploaded PDFs use disk,
not tmpfs, but multipart parsing and extraction still need RAM. No arbitrary
memory/CPU limits are set without knowing the host's resources.

For a host too small to build, build on a stronger machine targeting its
architecture. Transfer the image using `docker image save` / `load`;
the technical commands for amd64, run from the source project, are:

```sh
docker buildx build --platform linux/amd64 --load -t glovebox-transfer .
docker image save -o glovebox-image.tar glovebox-transfer
```

On the target, after setup:

```sh
docker image load -i glovebox-image.tar
docker image tag glovebox-transfer "$(docker compose config --images)"
docker compose up -d --no-build
docker image rm glovebox-transfer
```

Remove the transfer archive after use. Prefer native builders; cross-platform
emulation is slower. Do not copy macOS `node_modules` to Linux.

## Runtime and validation configuration

Node.js 24 and pnpm 11 are the recommended reference environment. `.nvmrc`
selects Node 24 locally and in CI; the Docker base image also uses Node 24.
Corepack and CI use the pnpm 11 version in `packageManager`.

`package.json` declares minimums of Node.js 22.22.2 and pnpm 10.26.0 without
upper bounds. Next itself only requires Node 20.9, but PDF.js and pnpm 11
require 22.13+, and jsdom raises the full-validation minimum to 22.22.2.
On the Node 24 branch, jsdom requires 24.15+. Test dependencies target
supported LTS releases, so accepting a newer runtime is not a guarantee
that every test tool supports non-LTS or future releases.
pnpm 10.26 is the first version supporting the project's `allowBuilds`.
There is no strict engine enforcement. `pmOnFail: ignore` disables automatic
pnpm switching on pnpm 11+; users may keep a newer installed version instead
of using Corepack's recommendation. pnpm 10 users can keep their version with
`pnpm --config.manage-package-manager-versions=false <command>`; its legacy setting
is not stored in the workspace because pnpm 11 removed it.
The wizard checks the Node minimum, including
the patch version, and accepts newer majors. Node type definitions remain
on the recommended 24.x branch. Python support remains 3.10+.

Ignore files follow each tool's semantics, not identical copied lists.
`.gitignore` contains only project data, environments and generated artifacts.
Prettier already reads it and ignores `node_modules`; `.prettierignore` adds
only the generated lockfile. Handwritten public CSS and the service worker
are formatted. ESLint inherits Next's build/type-file ignores and adds local
data, runtime, Python environment and coverage exclusions. TypeScript selects
application source, typed configs and Next's generated route types, rather
than scanning local data. Knip's public-file exclusion remains intentional:
the service worker and assets are loaded by URL, not the import graph.
Ruff keeps its Python 3.10 target and built-in/Git ignores.

## Access and operation

The host port binds to `127.0.0.1` for access from the computer running
the application. There is no authentication. Localhost also preserves
the secure context required by service workers/PWA features.

For an intentionally trusted LAN, use a local `compose.override.yaml` to
override the port mapping and set `MANUALS_ALLOW_REMOTE_IMPORT=1` if importing
remotely. This is advanced configuration: HTTP on a LAN IP does not support
service workers; a private HTTPS proxy needs access control and correct
Host/Origin forwarding. Same-origin checks are not authentication.
Docker-published ports may bypass ufw rules.

```sh
docker compose ps
docker compose logs --tail=50
docker compose stats --no-stream
curl --fail http://localhost:3000/api/system
```

Use the configured host port in the last command. The setup check should show
`nodeReady`, `pythonReady`, `extractor`, `database.writable` and `localAccess`
as true; zero manuals is valid. `/api/health` checks HTTP responsiveness only.
Health status alone does not restart the service; `restart: unless-stopped`
restarts exited containers. `init: true` reaps child processes.

Back up `database/` while stopped, plus browser exports. Do not rebuild or stop
during an import. Changing browser origin (including port) creates a separate
profile; export before switching.

## Removal boundary

`docker compose down` removes the project's container (including bounded logs)
and network, keeping the image for a quick restart.
`docker compose down --rmi local` additionally removes the Compose-built
application image, provided it is not in use elsewhere. Delete the stopped
project folder to remove its bind-mounted data. Browser data is separate.

Docker's daemon still owns shared base layers and build cache outside the
project. Deleting an image is not a guarantee of freeing all build-cache disk
space. Do not run global `docker system prune` or `docker builder prune` from
application setup/removal: those can affect unrelated projects. A literally
self-contained Docker installation requires isolated daemon storage, not a
Compose setting; this project does not alter host-wide Docker configuration.

## Official references

- [Docker Engine installation](https://docs.docker.com/engine/install/)
- [Multi-stage builds and caching](https://docs.docker.com/build/building/best-practices/)
- [Compose services](https://docs.docker.com/reference/compose-file/services/)
- [Compose down](https://docs.docker.com/reference/cli/docker/compose/down/)
- [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js memory use](https://nextjs.org/docs/app/guides/memory-usage)
- [pnpm engines and package manager](https://pnpm.io/package_json)
- [Prettier ignore rules](https://prettier.io/docs/ignore)
- [ESLint ignore rules](https://eslint.org/docs/latest/use/configure/ignore)
