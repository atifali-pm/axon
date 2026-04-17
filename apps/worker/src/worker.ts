console.log(
  JSON.stringify({
    service: "worker",
    msg: "worker ready",
    ts: new Date().toISOString(),
  }),
);

process.on("SIGTERM", () => {
  console.log(JSON.stringify({ service: "worker", msg: "SIGTERM, exiting" }));
  process.exit(0);
});

setInterval(() => {
  console.log(
    JSON.stringify({
      service: "worker",
      msg: "heartbeat",
      ts: new Date().toISOString(),
    }),
  );
}, 30_000);
