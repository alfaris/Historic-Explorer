import { handleStats } from './_lib/stats.js';

export default {
  fetch(request: Request) {
    return handleStats(request);
  },
};
