import { Connection, Client } from '@temporalio/client';
import { Worker } from '@temporalio/worker';
import { config } from '@haizel/config';
import { startObservability } from '@haizel/observability';

async function run() {
  await startObservability({ serviceName: 'worker', otlpEndpoint: config.worker.WORKER_OTLP_ENDPOINT });

  const connection = await Connection.connect({ address: config.worker.TEMPORAL_ADDRESS });
  const client = new Client({ connection, namespace: config.worker.TEMPORAL_NAMESPACE });

  const worker = await Worker.create({
    connection,
    namespace: config.worker.TEMPORAL_NAMESPACE,
    workflowsPath: new URL('./workflows', import.meta.url).pathname,
    activitiesPath: new URL('./activities', import.meta.url).pathname,
    taskQueue: 'loan-processing',
  });

  console.log('Worker started');
  await worker.run();

  await client.close();
}

run().catch((error) => {
  console.error('Worker failed', error);
  process.exit(1);
});
