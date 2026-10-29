# Deployment

The site runs on the owner's home server. GitHub never connects to it: there is no self-hosted runner and no server credential in the repository or in GitHub settings.

## How a commit reaches the site

1. **CI** (`.github/workflows/ci.yml`, GitHub-hosted runners): every pull request and every push to `main` runs `pnpm check` and `pnpm build`.
2. **Promote**: after green checks on `main`, CI force-moves the `production` branch to that commit, using only the built-in `GITHUB_TOKEN`.
3. **Pull**: on the server, `system-design-deploy.timer` runs `poll.sh` every 30 seconds as the app user. When `production` points to a new commit, `release.sh`:
   - fetches it and builds it next to the running version (`releases/<date>-<sha>/`);
   - backs up every SQLite database in `data/` to `backups/` (last 10 are kept);
   - switches the `current` link and restarts `system-design-web`;
   - waits up to 60 s for `/api/health` to report the new version.
   If the new version does not answer, the previous one is restored and the commit is recorded in `state/failed`, so it is not rebuilt until `production` moves again.
4. **Verify**: CI polls `https://system-design.oleksandr-antonenko.com/api/health` until it reports the commit, for up to 10 minutes.

## Layout on the server

In the app user's home:

```
apps/system-design/
  releases/<date>-<sha>/   builds, the last 5 are kept
  current -> releases/…    the running version
  src.git/                 shallow cache of the repository
  .env                     secrets (mode 600), shared by all versions
  data/  backups/  logs/{web,deploy}.log  state/{deployed,failed,deploy.lock}
bin/poll.sh, bin/release.sh       copies from the last successful release
.config/systemd/user/system-design-{web.service,deploy.service,deploy.timer}
```

The app user has no sudo rights. nginx (`deploy/nginx.conf`) proxies the domain to `127.0.0.1:3620`; certbot manages TLS.

## Everyday operations

Roll back to an earlier commit (it is reused without rebuilding if still on disk):

```sh
git push --force origin <sha>:production
```

The next push to `main` moves `production` forward again.

Retry a commit that failed after fixing the cause on the server: remove its line from `state/failed`.

Logs, as the app user:

```sh
tail -f ~/apps/system-design/logs/deploy.log
tail -f ~/apps/system-design/logs/web.log
systemctl --user status system-design-web system-design-deploy.timer
```

## One-time setup (server administrator)

1. Create the app user without sudo rights, enable lingering for it (`loginctl enable-linger`), create `~/apps/system-design/.env` with mode 600.
2. As that user, copy `poll.sh` and `release.sh` to `~/bin/`, the three unit files to `~/.config/systemd/user/`, then `systemctl --user daemon-reload` and `systemctl --user enable --now system-design-deploy.timer`.
3. Install `nginx.conf` as a site, run `nginx -t`, reload nginx, then `certbot --nginx -d system-design.oleksandr-antonenko.com --redirect`.
