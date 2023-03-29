import { getConfig, getLogger, getUsername } from './utils';
import * as dexapi from './dexapi';
import { WebClient } from '@slack/web-api';
import { JsonRpc } from "@proton/light-api";

const config = getConfig();
const logger = getLogger();
const username = getUsername();

export const postSlackMsg = async (): Promise<void> => {

  const channelId = config.channelId;
  const slackBotToken = config.slackBotToken;

  if(!channelId || !slackBotToken) {
    logger.info(' Slack bot configuration is missing, so not sharing details(balance, open-orders) to slack channel');
    return;
  }

  const chain = process.env.NODE_ENV === 'test' ? 'protontest' : 'proton';
  const rpc = new JsonRpc(chain);
  const web = new WebClient(config.slackBotToken);
  
  const balance = await rpc.get_balances(username);
  var obj = JSON.stringify(balance);
  const res1 = await web.chat.postMessage({ channel: config.channelId, text: obj });

  let orders = [];
  let i = 0;
  while(true) {
    const ordersList = await dexapi.fetchOpenOrders(username, 150, 150 * i);
    if(!ordersList.length) break;
    orders.push(...ordersList);
    i++;
  }
  obj = JSON.stringify(orders);
  const res2 = await web.chat.postMessage({ channel: config.channelId, text: obj });
  // `res` contains information about the posted message
  logger.info('Message sent: ', res2.ts);
}


