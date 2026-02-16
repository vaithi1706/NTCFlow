module.exports = {
  apps: [
    {
      name: 'dkflow-api',
      cwd: '/home/ubuntu/dkflow/apps/api',
      interpreter: 'node',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/index.ts',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: 'postgresql://postgres:dkflow123@localhost:5432/dkflow',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: '89bda9f31e6aac82fd996eda83b023e662a4e103fa69ee824d94f5c2595d9e72',
        APP_URL: 'http://72.61.173.123'
      }
    },
    {
      name: 'dkflow-web',
      cwd: '/home/ubuntu/dkflow/apps/web',
      interpreter: 'node',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'http://72.61.173.123'
      }
    }
  ]
};
