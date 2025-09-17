module.exports = {
  apps: [
    {
      name: "roas-web",
      script: "bash",
      args: ["-lc", "dotenv -e .env.local -- next start -p 3000"]
    },
    {
      name: "roas-worker",
      script: "bash",
      args: ["-lc", "dotenv -e .env.local -- tsx ./scripts/dispatchSignals.ts"]
    }
  ]
}
