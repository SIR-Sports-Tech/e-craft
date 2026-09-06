#!/usr/bin/env node
/**
 * E-CRAFT → Vultr ONLY (never Vercel).
 * Host: 209.222.20.20
 * Files: /opt/e-craft/public → https://linealgo.com/e-craft/
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOST = process.env.ECRAFT_VULTR_HOST || '209.222.20.20';
const REMOTE_DIR = '/opt/e-craft/public';
const yes = process.argv.includes('--yes');

if (!yes && process.env.ECRAFT_ALLOW_VULTR_DEPLOY !== '1') {
  console.error('Refusing: set ECRAFT_ALLOW_VULTR_DEPLOY=1 or pass --yes');
  process.exit(2);
}

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status || 1);
}

function ssh(remoteCmd) {
  run('ssh', ['-o', 'BatchMode=yes', `root@${HOST}`, remoteCmd]);
}

// Build for path-hosted site on linealgo.com (/e-craft/)
run('npm', ['run', 'build'], {
  env: { ...process.env, GITHUB_PAGES: '1' },
});

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html missing after build');
  process.exit(1);
}

ssh(`mkdir -p ${REMOTE_DIR}`);
run('rsync', ['-az', '--delete', 'dist/', `root@${HOST}:${REMOTE_DIR}/`]);

const snippet = `# E-CRAFT static game — Vultr only (scripts/deploy_vultr.mjs)
location ^~ /e-craft/ {
    alias /opt/e-craft/public/;
    index index.html;
    try_files $uri $uri/ /e-craft/index.html;
    add_header Cache-Control "public, max-age=60" always;
    add_header X-ECRAFT-Origin "vultr" always;
}

location = /e-craft {
    return 301 /e-craft/;
}
`;

const localSnippet = join(tmpdir(), 'e-craft-nginx.conf');
writeFileSync(localSnippet, snippet);
run('scp', ['-o', 'BatchMode=yes', localSnippet, `root@${HOST}:/etc/nginx/snippets/e-craft.conf`]);

const injectPy = `
from pathlib import Path
p = Path("/etc/nginx/sites-available/linealgo")
t = p.read_text()
if "snippets/e-craft.conf" in t:
    print("nginx: include already present")
else:
    parts = t.split("server {")
    out = [parts[0]]
    for part in parts[1:]:
        if "location / {" in part and "snippets/e-craft.conf" not in part:
            part = part.replace(
                "    location / {",
                "    include /etc/nginx/snippets/e-craft.conf;\\n\\n    location / {",
                1,
            )
        out.append(part)
    p.write_text("server {".join(out))
    print("nginx: injected e-craft include into server blocks")
`;

const pyFile = join(tmpdir(), 'ecraft_nginx_inject.py');
writeFileSync(pyFile, injectPy);
run('scp', ['-o', 'BatchMode=yes', pyFile, `root@${HOST}:/tmp/ecraft_nginx_inject.py`]);
ssh('python3 /tmp/ecraft_nginx_inject.py && nginx -t && systemctl reload nginx && test -f /opt/e-craft/public/index.html && ls /opt/e-craft/public | head && echo DEPLOY_OK');

console.log(`
E-CRAFT Vultr deploy complete.
Live: https://linealgo.com/e-craft/?skiptitle=1
`);
