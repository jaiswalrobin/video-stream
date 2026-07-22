// config/aws.js

const { S3Client } = require("@aws-sdk/client-s3");

const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY;

const s3Config = {
  region: process.env.AWS_REGION || "us-east-1",
};

if (accessKeyId && secretAccessKey) {
  s3Config.credentials = {
    accessKeyId,
    secretAccessKey,
  };
}

const s3 = new S3Client(s3Config);

module.exports = {
  s3,
};
