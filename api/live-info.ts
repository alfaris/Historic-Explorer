import { handleLiveInfo } from './_lib/gemini.js';

export default {
  fetch(request: Request) {
    return handleLiveInfo(new URL(request.url));
  },
};
