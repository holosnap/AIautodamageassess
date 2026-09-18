// Local S3-compatible server for development/testing without a real AWS
// account. Run with `npm run dev:s3`, then set in .env.local:
//   AWS_ACCESS_KEY_ID=S3RVER
//   AWS_SECRET_ACCESS_KEY=S3RVER
//   AWS_S3_ENDPOINT=http://127.0.0.1:4569
//   S3_BUCKET_NAME=vehicle-damage-reports-dev
import S3rver from "s3rver";

const instance = new S3rver({
  port: 4569,
  address: "127.0.0.1",
  silent: false,
  directory: "./.s3rver-data",
  configureBuckets: [{ name: "vehicle-damage-reports-dev" }],
});

instance.run().then((addr) => {
  console.log(`s3rver listening on http://${addr.address}:${addr.port}`);
});
