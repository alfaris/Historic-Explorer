import { handlePhotoServe } from './_lib/photos.js';

export default {
  fetch(request: Request) {
    return handlePhotoServe(request);
  },
};
