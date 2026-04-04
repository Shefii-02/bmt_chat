module.exports = {
  apps: [{
    name: "class-chat",
    script: "src/server.js",
    instances: "max",
    exec_mode: "cluster"
  }]
};
