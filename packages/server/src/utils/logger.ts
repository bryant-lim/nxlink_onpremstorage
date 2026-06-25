import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

const logDir = path.join(process.cwd(), "logs");

const fileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "30d",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    }),
  ),
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: [fileTransport, consoleTransport],
});
