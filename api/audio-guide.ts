import { handleAudioGuide } from './_lib/gemini.js';

export default {
  fetch(request: Request) {
    return handleAudioGuide(new URL(request.url));
  },
};
