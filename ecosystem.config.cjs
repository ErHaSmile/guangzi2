/**
 * PM2 process file — unique name per app on the same server.
 * Start: pm2 start ecosystem.config.cjs
 * Multi-app: each project under /opt/sites/<name>/ has its own file & port.
 */
const path = require('path')

const appName = process.env.APP_NAME || 'guanzi'
const root = __dirname

module.exports = {
  apps: [
    {
      name: appName,
      cwd: root,
      script: path.join(root, 'server/index.js'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: path.join(root, 'logs', 'pm2-error.log'),
      out_file: path.join(root, 'logs', 'pm2-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
}
