// Load environment variables from .env file for local development
//require('dotenv').config();

const { PubSub } = require('@google-cloud/pubsub');
const { Faker, en } = require('@faker-js/faker');
const winston = require('winston');

// --- Configuration ---
// Environment variables are used for configuration, following 12-factor app principles.
// These should be set in your GKE deployment (e.g., via ConfigMap).
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const PUBSUB_TOPIC_ID = process.env.PUBSUB_TOPIC_ID;
const PUBLISH_INTERVAL_MS = parseInt(process.env.PUBLISH_INTERVAL_MS || '2000', 10);

// --- Logger Setup ---
// A structured JSON logger is used, which is a best practice for services
// running in containers and managed by systems like GKE.
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// --- Validation ---
if (!GCP_PROJECT_ID || !PUBSUB_TOPIC_ID) {
  logger.error('Missing required environment variables: GCP_PROJECT_ID and PUBSUB_TOPIC_ID');
  process.exit(1);
}

// --- Pub/Sub Client Initialization ---
// The client is initialized with batching settings to improve throughput and reduce cost.
// maxMessages: The maximum number of messages to bundle in a single batch.
// maxMilliseconds: The maximum time to wait before publishing a batch.
const pubsub = new PubSub({ projectId: GCP_PROJECT_ID });
const topic = pubsub.topic(PUBSUB_TOPIC_ID, {
  batching: {
    maxMessages: 100,
    maxMilliseconds: 1000,
  },
});

logger.info(`Publisher initialized for topic: ${PUBSUB_TOPIC_ID} in project: ${GCP_PROJECT_ID}`);

// --- Dummy Data Generation ---
const faker = new Faker({ locale: [en] });

function generateDummyOrder() {
  const order = {
    orderId: faker.number.int({ min: 10, max: 9007199254740991 }), 
    //orderId: faker.string.uuid(),
    timestamp: new Date().toISOString(),
    customer: {
      name: faker.person.fullName(),
      email: faker.internet.email(),
    },
    items: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
      productId: faker.string.alphanumeric(10),
      productName: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 3 }),
      price: parseFloat(faker.commerce.price()),
    })),
    totalAmount: 0,
    shippingAddress: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      zipCode: faker.location.zipCode(),
      country: faker.location.country(),
    },
  };
  order.totalAmount = parseFloat(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
  return order;
}

// --- Publisher Logic ---
async function publishOrder() {
  try {
    const order = generateDummyOrder();
    const dataBuffer = Buffer.from(JSON.stringify(order));

    // The publishMessage method is non-blocking and returns a promise.
    // The client library handles batching and retries internally.
    const messageId = await topic.publishMessage({ data: dataBuffer });
    logger.info(`Message ${messageId} published.`, { orderId: order.orderId });
  } catch (error) {
    // Robust error handling for publishing failures.
    logger.error('Error publishing message:', {
      errorMessage: error.message,
      stack: error.stack,
    });
    // In a real-world scenario, you might want to implement a circuit breaker
    // or more sophisticated retry logic here, though the client library handles much of it.
  }
}

// --- Main Application Loop ---
logger.info(`Starting order publisher. Generating one order every ${PUBLISH_INTERVAL_MS}ms.`);
const intervalId = setInterval(publishOrder, PUBLISH_INTERVAL_MS);

// --- Graceful Shutdown ---
// Ensures that any buffered messages are sent before the application exits.
// This is crucial for preventing data loss during deployments or restarts.
async function shutdown() {
  logger.info('Shutting down publisher...');
  clearInterval(intervalId);

  try {
    // Flush sends all buffered messages and waits for them to be published.
    await topic.flush();
    logger.info('All buffered messages have been flushed. Exiting.');
    process.exit(0);
  } catch (error) {
    logger.error('Error flushing messages during shutdown:', {
      errorMessage: error.message,
    });
    process.exit(1);
  }
}

// Listen for termination signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// --- Global Error Handling ---
// Catches unhandled promise rejections and uncaught exceptions to prevent crashes.
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    errorMessage: error.message,
    stack: error.stack,
  });
  // It's generally recommended to exit after an uncaught exception.
  process.exit(1);
});