import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

const logDir = process.env.LOG_DIR || path.join(process.cwd(), "logs");

const isStdoutEnabled = process.env.LOG_STDOUT_ENABLED !== "false";
const isStderrEnabled = process.env.LOG_STDERR_ENABLED !== "false";
const isConsoleEnabled = process.env.LOG_CONSOLE_ENABLED !== "false";

const fileTextFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaStr}`;
  }),
);

const transports: winston.transport[] = [];

// Standard output log file (out-YYYY-MM-DD.log)
if (isStdoutEnabled) {
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "out-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d",
      format: fileTextFormat,
    }),
  );
}

// Error output log file (error-YYYY-MM-DD.log)
if (isStderrEnabled) {
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "warn",
      maxSize: "20m",
      maxFiles: "30d",
      format: fileTextFormat,
    }),
  );
}

// Console output (stdout)
if (isConsoleEnabled || transports.length === 0) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        }),
      ),
    }),
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports,
});

