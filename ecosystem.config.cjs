module.exports = {
  apps: [
    {
      name: 'cloud-playout-server',
      cwd: './server',
      script: 'src/server.js',
      instances: 1, // Single instance to coordinate FFmpeg processes and dynamic ZMQ ports
      exec_mode: 'fork',
      autorestart: true,
      watch: false, // Do not watch in production to avoid restarts on uploads/HLS writes
      max_memory_restart: '1G',
      kill_timeout: 6000, // 6 seconds for graceful shutdown to terminate FFmpeg child processes cleanly
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      }
    }
  ]
};
