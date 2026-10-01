# Deploy Fingertip to an Nginx VPS

Fingertip builds into a static website in `dist/`. Nginx serves these files directly. There is no Node.js process, database, API key, or reverse proxy required on the VPS. Port 4000 is only used by the local development server; public deployment uses HTTP port 80 and HTTPS port 443.

These instructions assume an Ubuntu/Debian VPS with Nginx already installed, SSH access, and a user with sudo privileges. They host Fingertip at the root of a dedicated domain or subdomain. Replace `deployuser`, `VPS_IP`, and `fingertip.example.com` with your own values. For other distributions, use the Nginx configuration directory and Certbot installation method appropriate to that distribution.

## 1. Build and package on your computer

Run from the project directory with Node.js 22.13 or newer:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
COPYFILE_DISABLE=1 tar -czf fingertip-production.tar.gz -C dist .
```

`corepack pnpm` runs the pnpm version pinned in `package.json`. If you already have that version installed, `pnpm` works too.

The archive contains `index.html`, `favicon.svg`, and the generated `assets/` directory. Upload only this static output, not the source tree or `node_modules/`. `COPYFILE_DISABLE=1` avoids macOS metadata entries when packaging on a Mac.

For a local production preview, run `corepack pnpm preview` and open <http://localhost:4173>. Vite preview is for local inspection, not the VPS production service. See [Vite's static deployment guide](https://vite.dev/guide/static-deploy.html).

## 2. Point your domain at the VPS

Create a DNS **A record** for your chosen hostname pointing to the VPS's public IPv4 address. Add an AAAA record only if IPv6 is configured and works on the VPS. Allow inbound TCP ports **80 and 443** in both the VPS firewall and your provider's firewall. Use a hostname that is not already assigned to another Nginx site.

## 3. Upload the archive and configuration

On your computer, from the project directory:

```sh
scp fingertip-production.tar.gz deploy/nginx.conf deployuser@VPS_IP:~/
ssh deployuser@VPS_IP
```

The remaining commands run on the VPS unless explicitly labeled otherwise.

## 4. Install the static files

Create a dedicated directory and extract the archive:

```sh
sudo mkdir -p /var/www/fingertip
sudo tar --no-same-owner --no-same-permissions -xzf ~/fingertip-production.tar.gz -C /var/www/fingertip
sudo chown -R root:root /var/www/fingertip
sudo find /var/www/fingertip -type d -exec chmod 755 {} \;
sudo find /var/www/fingertip -type f -exec chmod 644 {} \;
```

The resulting file must be `/var/www/fingertip/index.html`, not `/var/www/fingertip/dist/index.html`. Nginx needs read permission on files and traversal permission on the directories.

## 5. Configure Nginx

Install the supplied configuration as a separate site:

```sh
sudo cp ~/nginx.conf /etc/nginx/sites-available/fingertip
sudo nano /etc/nginx/sites-available/fingertip
```

Replace `fingertip.example.com` in `server_name` with your real hostname. Keep the existing sites' configuration files. The supplied [Nginx configuration](../deploy/nginx.conf) serves the app from `/var/www/fingertip`, revalidates HTML, caches hashed assets for a year, and compresses text assets. Missing `/assets/` files return 404 rather than HTML.

Enable it, validate the complete Nginx configuration, and reload only if validation succeeds:

```sh
sudo ln -s /etc/nginx/sites-available/fingertip /etc/nginx/sites-enabled/fingertip
sudo nginx -t && sudo systemctl reload nginx
```

Create the symlink once; skip that command when updating an existing deployment. If your installation uses `conf.d` rather than `sites-available`/`sites-enabled`, install the configuration at `/etc/nginx/conf.d/fingertip.conf` instead and skip the symlink. Use the directory actually included by your `/etc/nginx/nginx.conf`, and do not install the site in both places.

The main Nginx `http` block should already include `/etc/nginx/mime.types`, so JavaScript and CSS have the correct content types. See the official [Nginx serving guide](https://nginx.org/en/docs/beginners_guide.html), [try_files documentation](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files), and [cache header documentation](https://nginx.org/en/docs/http/ngx_http_headers_module.html).

Open `http://fingertip.example.com` to confirm the app loads before requesting a certificate. If DNS has not propagated, test Nginx locally on the VPS:

```sh
curl -I -H 'Host: fingertip.example.com' http://127.0.0.1/
```

## 6. Enable HTTPS

If your VPS already uses Certbot, use that existing installation. If it does not, follow the official [Certbot installation instructions for Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap). For an Ubuntu VPS with snapd available and no existing Certbot installation:

```sh
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d fingertip.example.com --redirect
sudo /snap/bin/certbot renew --dry-run
```

With Certbot already on your PATH, use `sudo certbot` instead of `sudo /snap/bin/certbot`. Certbot edits the matching Nginx site to install the certificate and redirect HTTP to HTTPS. Its installation schedules renewal; the dry run checks renewal works. DNS must point at this server and port 80 must be reachable from the Internet for this validation method.

Open `https://fingertip.example.com`. Verify both modes and practice input in your browser, then check real multitouch and sound on a phone using the checklist in [TESTING.md](TESTING.md). Automated tests do not establish real-device compatibility.

## 7. Publish future updates

On your computer, repeat the checks, build, archive, and `scp` command from steps 1 and 3. On the VPS, extract into a temporary directory, copy assets first, and then replace the entry HTML:

```sh
release_dir=$(mktemp -d)
tar --no-same-owner --no-same-permissions -xzf ~/fingertip-production.tar.gz -C "$release_dir"
sudo cp -R "$release_dir/assets/." /var/www/fingertip/assets/
sudo install -m 644 "$release_dir/favicon.svg" /var/www/fingertip/favicon.svg
sudo install -m 644 "$release_dir/index.html" /var/www/fingertip/index.html.next
sudo mv /var/www/fingertip/index.html.next /var/www/fingertip/index.html
sudo chown -R root:root /var/www/fingertip
sudo find /var/www/fingertip -type d -exec chmod 755 {} \;
sudo find /var/www/fingertip -type f -exec chmod 644 {} \;
```

This keeps older hashed assets available to tabs that loaded the previous HTML, and replaces `index.html` atomically. Static file updates do not need an Nginx reload. Keep the last working archive for rollback; repeat these update commands with that archive if necessary. The temporary extraction directory can be removed after confirming the update.

Keep the HTTPS configuration Certbot created. Do not replace it with the original HTTP-only template during an app update.

## Troubleshooting

- **Wrong website:** check DNS, the `server_name`, and whether another enabled site declares the same hostname.
- **403:** confirm `index.html` exists at the configured root and the Nginx worker can read/traverse its files and directories.
- **Blank page:** check browser developer tools for failed JS/CSS requests. Upload all of `dist/`, preserve its `assets/` directory, and confirm Nginx includes `mime.types`.
- **Certificate failure:** check public DNS, any AAAA record, and inbound port 80 before retrying.
- **Subdirectory hosting:** this build assumes `/`. For a URL such as `/fingertip/`, rebuild with `corepack pnpm build --base=/fingertip/` and adapt Nginx to that path; the supplied configuration is for a dedicated hostname.

Inspect errors on the VPS with `sudo tail -n 50 /var/log/nginx/error.log` and validate configuration changes with `sudo nginx -t`.
