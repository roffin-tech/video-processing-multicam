// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
      script: [
        {
          src: 'https://webrtc.github.io/adapter/adapter-latest.js',
        },
        // {
        //   src: '@/assets/js/peer-connection-pipe.js',
        // },
        // {
        //   src: '@/assets/js/peer-connection-sink.js',
        // },
        // {
        //   src: '@/assets/js/peer-connection-source.js',
        // },
        // {
        //   src: '@/assets/js/video-source.js',
        // },
        // {
        //   src: '@/assets/js/video-sink.js',
        // },
        // {
        //   src: '@/assets/js/video-transform.js',
        // },
        // {
        //   src: '@/assets/js/video-mirror-helper.js',
        // },
        // {
        //   src: '@/assets/js/camera-source.js',
        // },
        // {
        //   src: '@/assets/js/canvas-source.js',
        // },
        // {
        //   src: '@/assets/js/canvas-transform.js',
        // },
        // {
        //   src: '@/assets/js/webgl-transform.js',
        // },
        // {
        //   src: '@/assets/js/webcodec-transform.js',
        // },
        // {
        //   src: '@/assets/js/simple-transforms.js',
        // },
        // {
        //   src: '@/assets/js/pipeline.js',
        // },
        // {
        //   src: '@/assets/js/main.js',
        // },
      ],
    },
  },
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
});
