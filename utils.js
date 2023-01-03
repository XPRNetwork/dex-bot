import config from 'config';
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.prettyPrint(),
  transports: [new winston.transports.Console()],
});

export const getLogger = () => logger;

const botConfig = config.get('bot');
// TODO: apply env. variables for username and private key
export const getConfig = () => botConfig;
