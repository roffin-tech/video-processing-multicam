export class StreamProcessor {
  constructor() {}

  async getMediaDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = [];
      devices.forEach((device) => {
        if (device.kind === 'videoinput') {
          videoDevices.push(device);
        }
      });
      return videoDevices;
    } catch (error) {
      console.log('virtualCamera.js error', error);
      throw error;
    }
  }

  async getVideoStreams(devices) {
    const streams = [];
    try {
      if (devices.length === 0) return [];

      for (let index = 0; index < devices.length; index++) {
        const device = devices[index];
        const { deviceId } = device;
        const constraints = {
          audio: false,
          video: true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streams.push(stream);
      }

      // const streams = await Promise.all(
      //   devices.map((device) => {
      //     const { deviceId } = device;
      //     const constraints = {
      //       audio: false,
      //       video: {
      //         width: 640,
      //         height: 360,
      //         deviceId: {
      //           exact: deviceId,
      //         },
      //       },
      //     };

      //     return navigator.mediaDevices.getUserMedia(constraints);
      //   })
      // );
      console.log('streams', streams);

      return streams;
    } catch (error) {
      console.error('virtualCamera.js error', error);
      throw error;
    }
  }

  async createProcessedMediaStreamTrack(sourceTrack, transform, signal) {
    // Create the MediaStreamTrackProcessor.
    /** @type {?MediaStreamTrackProcessor<!VideoFrame>} */
    let processor;
    try {
      processor = new MediaStreamTrackProcessor(sourceTrack);
    } catch (e) {
      alert(`MediaStreamTrackProcessor failed: ${e}`);
      throw e;
    }

    // Create the MediaStreamTrackGenerator.
    /** @type {?MediaStreamTrackGenerator<!VideoFrame>} */
    let generator;
    try {
      generator = new MediaStreamTrackGenerator('video');
    } catch (e) {
      alert(`MediaStreamTrackGenerator failed: ${e}`);
      throw e;
    }

    const source = processor.readable;
    const sink = generator.writable;

    // Create a TransformStream using our FrameTransformFn. (Note that the
    // "Stream" in TransformStream refers to the Streams API, specified by
    // https://streams.spec.whatwg.org/, not the Media Capture and Streams API,
    // specified by https://w3c.github.io/mediacapture-main/.)
    /** @type {!TransformStream<!VideoFrame, !VideoFrame>} */
    const transformer = new TransformStream({ transform });

    // Apply the transform to the processor's stream and send it to the
    // generator's stream.
    const promise = source.pipeThrough(transformer, { signal }).pipeTo(sink);

    promise.catch((e) => {
      if (signal.aborted) {
        console.log(
          '[createProcessedMediaStreamTrack] Shutting down streams after abort.'
        );
      } else {
        console.error(
          '[createProcessedMediaStreamTrack] Error from stream transform:',
          e
        );
      }
      source.cancel(e);
      sink.abort(e);
    });

    // debug['processor'] = processor;
    // debug['generator'] = generator;
    // debug['transformStream'] = transformer;
    console.log(
      '[createProcessedMediaStreamTrack] Created MediaStreamTrackProcessor, ' +
        'MediaStreamTrackGenerator, and TransformStream.',
      'debug.processor =',
      processor,
      'debug.generator =',
      generator,
      'debug.transformStream =',
      transformer
    );

    return generator;
  }

  /**
   * Wrapper around createProcessedMediaStreamTrack to apply transform to a
   * MediaStream.
   * @param {!MediaStream} sourceStream the video stream to be transformed. The
   *     first video track will be used.
   * @param {!FrameTransformFn} transform the transform to apply to the
   *     sourceStream.
   * @param {!AbortSignal} signal can be used to stop processing
   * @return {!MediaStream} holds a single video track of the transformed video
   *     frames
   */
  async createProcessedMediaStream(sourceStream, transform, signal) {
    console.trace('createProcessedMediaStream', sourceStream);

    // For this sample, we're only dealing with video tracks.
    /** @type {!MediaStreamTrack} */
    const sourceTrack = sourceStream.getVideoTracks()[0];

    const processedTrack = await this.createProcessedMediaStreamTrack(
      sourceTrack,
      transform,
      signal
    );

    // Create a new MediaStream to hold our processed track.
    const processedStream = new MediaStream();
    processedStream.addTrack(processedTrack);

    return processedStream;
  }
}
