import { handleShare } from './_lib/share.js';

export default {
  fetch(request: Request) {
    return handleShare(request);
  },
};
