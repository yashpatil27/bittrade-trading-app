module.exports = {
  apps: [{
    name: 'bittrade',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/bittrade/error.log',
    out_file: '/var/log/bittrade/out.log',
    log_file: '/var/log/bittrade/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
}
