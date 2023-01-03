import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.prettyPrint(),
  transports: [new winston.transports.Console()],
});

const getLogger = () => logger;
export default getLogger;
