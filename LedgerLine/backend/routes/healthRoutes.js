const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * @route   GET /health
 * @desc    Comprehensive system diagnostic and replica set status check
 * @access  Public (for uptime monitors, load balancers, and DevOps health probes)
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const dbState = mongoose.connection.readyState;
  const isConnected = dbState === 1;

  let replicaSetInfo = {
    enabled: false,
    setName: null,
    isMaster: false
  };

  if (isConnected && mongoose.connection.db) {
    try {
      const hello = await mongoose.connection.db.command({ hello: 1 });
      replicaSetInfo = {
        enabled: Boolean(hello.setName),
        setName: hello.setName || null,
        isMaster: Boolean(hello.isWritablePrimary || hello.ismaster),
        secondary: Boolean(hello.secondary),
        hostsCount: hello.hosts ? hello.hosts.length : 1
      };
    } catch {
      // Replica command fallback
    }
  }

  const memoryUsage = process.memoryUsage();
  const isHealthy = isConnected && (!replicaSetInfo.enabled || replicaSetInfo.isMaster || replicaSetInfo.secondary);

  const payload = {
    service: 'LedgerLine Financial Core',
    status: isHealthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    responseTimeMs: Date.now() - startTime,
    database: {
      connected: isConnected,
      state: dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected',
      replicaSet: replicaSetInfo
    },
    system: {
      nodeVersion: process.version,
      memory: {
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024)
      }
    }
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json(payload);
});

module.exports = router;
