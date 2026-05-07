/**
 * AegisTV Stream Validator — Tests stream health, latency, and quality
 */

const axios = require('axios');
const log = require('../utils/logger');
const { sleep } = require('../utils/helpers');

const TIMEOUT = parseInt(process.env.STREAM_TIMEOUT || '8000', 10);
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_VALIDATIONS || '5', 10);

/**
 * Validate a single stream URL
 * Returns a score object or null if dead
 */
async function validateStream(streamUrl) {
  const start = Date.now();

  try {
    const response = await axios.head(streamUrl, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'AegisTV/1.0',
        'Accept': '*/*',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });

    const latency = Date.now() - start;
    const contentType = response.headers['content-type'] || '';
    const isStream = contentType.includes('mpegurl') ||
                     contentType.includes('mp2t') ||
                     contentType.includes('video') ||
                     contentType.includes('octet-stream') ||
                     contentType.includes('application/x-mpegURL') ||
                     streamUrl.endsWith('.m3u8') ||
                     streamUrl.endsWith('.ts');

    if (!isStream && response.status !== 200) {
      return null;
    }

    // Calculate scores
    const latencyScore = Math.max(0, Math.min(100, 100 - (latency / 50)));
    const qualityScore = estimateQuality(streamUrl, response.headers);
    const stabilityScore = 80; // Base score, updated over time

    return {
      alive: true,
      latency,
      latencyScore: Math.round(latencyScore),
      qualityScore,
      stabilityScore,
      contentType,
      statusCode: response.status,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.debug('Validator', `Dead stream: ${streamUrl.slice(0, 80)} — ${err.message}`);
    return null;
  }
}

/**
 * Estimate quality from URL patterns and headers
 */
function estimateQuality(url, headers = {}) {
  const u = url.toLowerCase();
  if (u.includes('1080') || u.includes('fhd')) return 100;
  if (u.includes('720') || u.includes('hd')) return 80;
  if (u.includes('480') || u.includes('sd')) return 60;
  if (u.includes('360') || u.includes('ld')) return 40;
  if (u.includes('240')) return 20;
  return 70; // Default assumption
}

/**
 * Get quality label from score
 */
function qualityLabel(score) {
  if (score >= 95) return '1080p';
  if (score >= 75) return '720p';
  if (score >= 55) return '480p';
  if (score >= 35) return '360p';
  return 'SD';
}

/**
 * Validate multiple streams concurrently with rate limiting
 */
async function validateBatch(channels) {
  log.info('Validator', `🔎 Validating ${channels.length} streams (max ${MAX_CONCURRENT} concurrent)...`);

  const results = [];
  const queue = [...channels];
  let processed = 0;

  async function worker() {
    while (queue.length > 0) {
      const channel = queue.shift();
      const validation = await validateStream(channel.streamUrl);
      processed++;

      if (validation) {
        results.push({
          ...channel,
          validation,
          quality: qualityLabel(validation.qualityScore),
          score: calculateOverallScore(validation),
        });
      }

      if (processed % 10 === 0) {
        log.info('Validator', `Progress: ${processed}/${channels.length} — ${results.length} alive`);
      }
    }
  }

  // Create worker pool
  const workers = [];
  for (let i = 0; i < MAX_CONCURRENT; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  log.info('Validator', `✅ Validation complete: ${results.length}/${channels.length} alive`);
  return results;
}

/**
 * Calculate overall channel score (0-100)
 */
function calculateOverallScore(validation) {
  const weights = {
    latency: 0.3,
    quality: 0.4,
    stability: 0.3,
  };

  return Math.round(
    validation.latencyScore * weights.latency +
    validation.qualityScore * weights.quality +
    validation.stabilityScore * weights.stability
  );
}

module.exports = {
  validateStream,
  validateBatch,
  qualityLabel,
  calculateOverallScore,
};
