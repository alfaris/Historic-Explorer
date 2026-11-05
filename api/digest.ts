import { handleDigest } from './_lib/digest.js';

export default {
  fetch(request: Request) {
    return handleDigest(request);
  },
};
