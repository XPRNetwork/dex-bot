import config from "config";
import winston from "winston";
import path from "path";
import fs from "fs";
import { BotConfig } from "./interfaces";

// Ensure logs directory exists
const logsDir = path.resolve("./logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `bot-${new Date().toISOString().split("T")[0]}.log`);

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] ${typeof message === 'object' ? JSON.stringify(message) : message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.prettyPrint(),
    }),
    new winston.transports.File({
      filename: logFile,
      maxsize: 50 * 1024 * 1024, // 50MB per file
      maxFiles: 10,              // Keep 10 rotated files
    }),
  ],
});

export const getLogger = () => logger;

const botConfig = config.get<BotConfig>("bot");
export const getConfig = () => botConfig;

export const getUsername = () => botConfig.username;

export const configValueToFloat = (value: string | number) => {
  return typeof value == "number" ? value : parseFloat(value);
};

export const configValueToInt = (value: string | number) => {
  return typeof value == "number" ? value : parseInt(value);
};
