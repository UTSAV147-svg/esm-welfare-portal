/**
 * ==============================================================================
 * VeerSeva - Autocannon & Native High-Throughput Load Tester
 * Run: node load-testing/autocannon-test.js
 * ==============================================================================
 */

const http = require('http');
const path = require('path');

let autocannon = null;
try {
  autocannon = require(path.resolve(__dirname, '../backend/node_modules/autocannon'));
} catch {
  try {
    autocannon = require('autocannon');
  } catch {}
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('⚡ Running VeerSeva API Concurrency & Throughput Benchmark...');
  console.log('Target: http://localhost:5000/api/v1/version');
  console.log('================================================================');

  if (autocannon) {
    console.log('Running via Autocannon engine (100 connections, 10s)...');
    const instance = autocannon({
      url: 'http://localhost:5000/api/v1/version',
      connections: 100,
      duration: 10,
      pipelining: 1
    });

    autocannon.track(instance, { renderProgressBar: true });

    instance.on('done', (results) => {
      console.log('\n================================================================');
      console.log('📊 Benchmark Results Summary:');
      console.log(`Total Requests:    ${results.requests.total}`);
      console.log(`Avg Req / Second:  ${results.requests.average}`);
      console.log(`Avg Latency:       ${results.latency.average} ms`);
      console.log(`99th Percentile:   ${results.latency.p99} ms`);
      console.log(`2xx Responses:     ${results['2xx']}`);
      console.log(`Non-2xx Errors:    ${results.non2xx}`);
      console.log('================================================================');
    });
  } else {
    // High-performance native Node.js concurrency benchmarker
    console.log('Running via Native Concurrency Runner (1,000 requests, 50 concurrency)...');
    const totalRequests = 1000;
    const concurrency = 50;
    let completed = 0;
    let successful = 0;
    const start = Date.now();

    async function worker() {
      while (completed < totalRequests) {
        completed++;
        await new Promise((resolve) => {
          http.get('http://localhost:5000/api/v1/version', (res) => {
            if (res.statusCode === 200) successful++;
            res.resume();
            resolve();
          }).on('error', () => resolve());
        });
      }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    const duration = (Date.now() - start) / 1000;
    console.log('\n================================================================');
    console.log('📊 Native Benchmark Results:');
    console.log(`Total Requests:    ${successful} / ${totalRequests}`);
    console.log(`Duration:          ${duration.toFixed(2)} seconds`);
    console.log(`Requests / Sec:    ${(successful / duration).toFixed(0)} req/s`);
    console.log(`Avg Response Time: ${((duration / successful) * 1000).toFixed(2)} ms`);
    console.log('================================================================');
  }
}

runBenchmark();
