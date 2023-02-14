import config from "config";
import winston from "winston";
import { BotConfig } from "./interfaces";

const logger = winston.createLogger({
  format: winston.format.prettyPrint(),
  transports: [new winston.transports.Console()],
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
