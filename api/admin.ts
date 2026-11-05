import { handleAdmin } from './_lib/admin.js';

export default {
  fetch(request: Request) {
    return handleAdmin(request);
  },
};
