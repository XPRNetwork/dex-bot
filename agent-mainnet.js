// agent-mainnet.js

import { JsonRpc, Api, JsSignatureProvider } from '@proton/js';
import fetch from 'node-fetch';
import readline from 'readline';
import dotenv from 'dotenv';
import { argv } from 'process';

// Load environment variables from a .env file if present
dotenv.config();

// ***** Configuration *****

// Your Proton account username
const USERNAME = process.env.PROTON_USERNAME;

// Your Proton private key
const PRIVATE_KEY = process.env.PROTON_PRIVATE_KEY;

// OpenAI API Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Proton RPC endpoints
const ENDPOINTS = ['https://proton.eoscafeblock.com'];

// List of potential recipient accounts
const RECIPIENT_ACCOUNTS = ['protonnz', 'paul', 'rockerone']; // Update with your actual accounts

// *************************

// Check if all required environment variables are set
if (!USERNAME || !PRIVATE_KEY || !OPENAI_API_KEY) {
  console.error('Please set the PROTON_USERNAME, PROTON_PRIVATE_KEY, and OPENAI_API_KEY environment variables.');
  process.exit(1);
}

// Parse command-line arguments
let autoMode = false;
let delaySeconds = 0;

argv.forEach((arg, index) => {
  if (arg === '--auto') {
    autoMode = true;
  } else if (arg === '--delay') {
    const delayArg = argv[index + 1];
    if (delayArg && !isNaN(delayArg)) {
      delaySeconds = parseInt(delayArg, 10);
    } else {
      console.error('Invalid or missing value for --delay. Please provide the delay in seconds.');
      process.exit(1);
    }
  }
});

// Initialize Proton API
const rpc = new JsonRpc(ENDPOINTS, { fetch });
const signatureProvider = new JsSignatureProvider([PRIVATE_KEY]);
const api = new Api({
  rpc,
  signatureProvider,
});

// Function to interact with OpenAI's ChatGPT
async function askChatGPT(question) {
  console.log('\n=== Prompt to ChatGPT ===\n', question); // Print the prompt

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4', // Use 'gpt-4' if you have access, otherwise 'gpt-3.5-turbo'
      messages: [
        {
          role: 'system',
          content:
            'You are an AI assistant that decides which account to send XPR tokens to. This is just a fun experiment. You cannot send more than 5 XPR. Provide your answer in the specified format.',
        },
        {
          role: 'user',
          content: question,
        },
      ],
      max_tokens: 150,
      n: 1,
      stop: null,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`OpenAI API error: ${data.error.message}`);
  }

  const aiResponse = data.choices[0].message.content.trim();
  console.log('\n=== ChatGPT Response ===\n', aiResponse); // Print the AI response

  return aiResponse;
}

// Function to perform the transfer
async function transferTokens(from, to, quantity, memo = '') {
  const actions = [
    {
      account: 'eosio.token',
      name: 'transfer',
      authorization: [
        {
          actor: from,
          permission: 'active',
        },
      ],
      data: {
        from,
        to,
        quantity,
        memo,
      },
    },
  ];

  try {
    const result = await api.transact(
      { actions },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    console.log('Transfer successful:', result.transaction_id);
  } catch (error) {
    console.error('Error during transfer:', error.message);
  }
}

// Function to fetch the account's XPR balance
async function fetchBalance(account) {
  const response = await rpc.get_currency_balance('eosio.token', account, 'XPR');
  if (response.length === 0) {
    return '0.0000 XPR';
  }
  return response[0];
}

// Function to get user input from the console
function promptInput(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

// Function to execute the main logic once
async function executeTransfer() {
  try {
    // Fetch current balance
    const balanceStr = await fetchBalance(USERNAME);
    console.log(`Your current balance: ${balanceStr}`);

    // Extract numeric balance
    const balanceMatch = balanceStr.match(/(\d+\.\d{4})\s*XPR/);
    const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0.0;

    // Prepare question for ChatGPT
    const question = `I have ${balanceStr} in my account. Here is a list of recipient accounts: ${RECIPIENT_ACCOUNTS.join(
      ', '
    )}. Please decide which account I should send some XPR to, and how much. Remember, you cannot send more than 5 XPR. Provide your answer in the following format:

Recipient: <recipient_account>
Amount: <amount> XPR

Do not include any additional text.`;

    // Get decision from ChatGPT
    const aiResponse = await askChatGPT(question);

    // Parse AI response
    const recipientMatch = aiResponse.match(/Recipient:\s*(\w+)/);
    const amountMatch = aiResponse.match(/Amount:\s*(\d+(?:\.\d{1,4})?)\s*XPR/);

    if (!amountMatch || !recipientMatch) {
      console.error('Could not parse the amount or recipient account from ChatGPT response.');
      return;
    }

    const amount = amountMatch[1];
    const recipient = recipientMatch[1];

    // Validate recipient
    if (!RECIPIENT_ACCOUNTS.includes(recipient)) {
      console.error(`Recipient ${recipient} is not in the list of allowed accounts.`);
      return;
    }

    // Validate amount
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      console.error('Invalid amount specified.');
      return;
    }

    if (amountFloat > balance) {
      console.error(`Specified amount ${amountFloat} exceeds your balance ${balance}.`);
      return;
    }

    // Ensure amount does not exceed 5 XPR as per AI instructions
    if (amountFloat > 5) {
      console.error('Amount exceeds the maximum allowed limit of 5 XPR.');
      return;
    }

    // Format amount to have four decimal places
    const amountFormatted = amountFloat.toFixed(4);

    if (autoMode) {
      console.log(`Auto mode enabled. Proceeding to send ${amountFormatted} XPR to ${recipient}.`);
    } else {
      // Confirm with the user
      const confirmation = await promptInput(
        `Do you want to send ${amountFormatted} XPR to ${recipient}? (yes/no): `
      );
      if (confirmation.toLowerCase() !== 'yes') {
        console.log('Transfer cancelled by user.');
        return;
      }
    }

    // Perform the transfer
    const quantity = `${amountFormatted} XPR`;
    await transferTokens(USERNAME, recipient, quantity, 'Transfer via AI agent');

  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}

// Main function
async function main() {
  if (delaySeconds > 0) {
    console.log(`Running in loop mode with a delay of ${delaySeconds} seconds.`);
    while (true) {
      await executeTransfer();
      console.log(`Waiting for ${delaySeconds} seconds before the next run...\n`);
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
  } else {
    await executeTransfer();
  }
}

main();
