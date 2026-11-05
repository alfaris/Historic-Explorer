import { handleReport } from './_lib/reports.js';

export default {
  fetch(request: Request) {
    return handleReport(request);
  },
};
