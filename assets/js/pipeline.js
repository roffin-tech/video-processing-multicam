/*
 *  Copyright (c) 2020 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

/* global createProcessedMediaStreamTrack */ // defined in main.js

/**
 * Creates a pair of MediaStreamTrackProcessor and MediaStreamTrackGenerator
 * that applies transform to sourceTrack. This function is the core part of the
 * sample, demonstrating how to use the new API.
 * @param {!MediaStreamTrack} sourceTrack the video track to be transformed. The
 *     track can be from any source, e.g. getUserMedia, RTCTrackEvent, or
 *     captureStream on HTMLMediaElement or HTMLCanvasElement.
 * @param {!FrameTransformFn} transform the transform to apply to sourceTrack;
 *     the transformed frames are available on the returned track. See the
 *     implementations of FrameTransform.transform later in this file for
 *     examples.
 * @param {!AbortSignal} signal can be used to stop processing
 * @return {!MediaStreamTrack} the result of sourceTrack transformed using
 *     transform.
 */
const debug = {}
// eslint-disable-next-line no-unused-vars
function createProcessedMediaStreamTrack(sourceTrack, transform, signal) {
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

  debug['processor'] = processor;
  debug['generator'] = generator;
  debug['transformStream'] = transformer;
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
function createProcessedMediaStream(sourceStream, transform, signal) {
  console.trace('createProcessedMediaStream', sourceStream);

  // For this sample, we're only dealing with video tracks.
  /** @type {!MediaStreamTrack} */
  const sourceTrack = sourceStream.getVideoTracks()[0];

  const processedTrack = createProcessedMediaStreamTrack(
    sourceTrack,
    transform,
    signal
  );

  // Create a new MediaStream to hold our processed track.
  const processedStream = new MediaStream();
  processedStream.addTrack(processedTrack);

  return processedStream;
}

/**
 * Interface implemented by all video sources the user can select. A common
 * interface allows the user to choose a source independently of the transform
 * and sink.
 * @interface
 */
class MediaStreamSource {
  // eslint-disable-line no-unused-vars
  /**
   * Sets the path to this object from the debug global var.
   * @param {string} path
   */
  setDebugPath(path) {}
  /**
   * Indicates if the source video should be mirrored/displayed on the page. If
   * false (the default), any element producing frames will not be a child of
   * the document.
   * @param {boolean} visible whether to add the raw source video to the page
   */
  setVisibility(visible) {}
  /**
   * Initializes and returns the MediaStream for this source.
   * @return {!Promise<!MediaStream>}
   */
  async getMediaStream() {}
  /** Frees any resources used by this object. */
  destroy() {}
}

/**
 * Interface implemented by all video transforms that the user can select. A
 * common interface allows the user to choose a transform independently of the
 * source and sink.
 * @interface
 */
class FrameTransform {
  // eslint-disable-line no-unused-vars
  /** Initializes state that is reused across frames. */
  async init() {}
  /**
   * Applies the transform to frame. Queues the output frame (if any) using the
   * controller.
   * @param {!VideoFrame} frame the input frame
   * @param {!TransformStreamDefaultController<!VideoFrame>} controller
   */
  async transform(frame, controller) {}
  /** Frees any resources used by this object. */
  destroy() {}
}

/**
 * Interface implemented by all video sinks that the user can select. A common
 * interface allows the user to choose a sink independently of the source and
 * transform.
 * @interface
 */
class MediaStreamSink {
  // eslint-disable-line no-unused-vars
  /**
   * @param {!MediaStream} stream
   */
  async setMediaStream(stream) {}
  /** Frees any resources used by this object. */
  destroy() {}
}

/**
 * Assembles a MediaStreamSource, FrameTransform, and MediaStreamSink together.
 */
export class Pipeline {
  // eslint-disable-line no-unused-vars
  constructor() {
    /** @private {?MediaStreamSource} set by updateSource*/
    this.source_ = null;
    /** @private {?FrameTransform} set by updateTransform */
    this.frameTransform_ = null;
    /** @private {?MediaStreamSink} set by updateSink */
    this.sink_ = null;
    /** @private {!AbortController} may used to stop all processing */
    this.abortController_ = new AbortController();
    /**
     * @private {?MediaStream} set in maybeStartPipeline_ after all of source_,
     *     frameTransform_, and sink_ are set
     */
    this.processedStream_ = null;
  }

  /** @return {?MediaStreamSource} */
  getSource() {
    return this.source_;
  }

  /**
   * Sets a new source for the pipeline.
   * @param {!MediaStreamSource} mediaStreamSource
   */
  async updateSource(mediaStreamSource) {
    if (this.source_) {
      this.abortController_.abort();
      this.abortController_ = new AbortController();
      this.source_.destroy();
      this.processedStream_ = null;
    }
    this.source_ = mediaStreamSource;
    this.source_.setDebugPath('debug.pipeline.source_');
    console.log(
      '[Pipeline] Updated source.',
      'debug.pipeline.source_ = ',
      this.source_
    );
    await this.maybeStartPipeline_();
  }

  /** @private */
  async maybeStartPipeline_() {
    if (
      this.processedStream_ ||
      !this.source_ ||
      !this.frameTransform_ ||
      !this.sink_
    ) {
      return;
    }
    const sourceStream = await this.source_.getMediaStream();
    await this.frameTransform_.init();
    try {
      this.processedStream_ = createProcessedMediaStream(
        sourceStream,
        async (frame, controller) => {
          if (this.frameTransform_) {
            await this.frameTransform_.transform(frame, controller);
          }
        },
        this.abortController_.signal
      );
    } catch (e) {
      console.log('error', e);
      
      this.destroy();
      return;
    }
    await this.sink_.setMediaStream(this.processedStream_);
    console.log(
      '[Pipeline] Pipeline started.',
      'debug.pipeline.abortController_ =',
      this.abortController_
    );
  }

  /**
   * Sets a new transform for the pipeline.
   * @param {!FrameTransform} frameTransform
   */
  async updateTransform(frameTransform) {
    if (this.frameTransform_) this.frameTransform_.destroy();
    this.frameTransform_ = frameTransform;
    console.log(
      '[Pipeline] Updated frame transform.',
      'debug.pipeline.frameTransform_ = ',
      this.frameTransform_
    );
    if (this.processedStream_) {
      await this.frameTransform_.init();
    } else {
      await this.maybeStartPipeline_();
    }
  }

  /**
   * Sets a new sink for the pipeline.
   * @param {!MediaStreamSink} mediaStreamSink
   */
  async updateSink(mediaStreamSink) {
    if (this.sink_) this.sink_.destroy();
    this.sink_ = mediaStreamSink;
    console.log(
      '[Pipeline] Updated sink.',
      'debug.pipeline.sink_ = ',
      this.sink_
    );
    if (this.processedStream_) {
      await this.sink_.setMediaStream(this.processedStream_);
    } else {
      await this.maybeStartPipeline_();
    }
  }

  /** Frees any resources used by this object. */
  async destroy() {
    console.trace(
      '[Pipeline] Destroying Pipeline',
      this.source_,
      this.frameTransform_,
      this.sink_
    );
    this.abortController_.abort();
    if (this.source_) this.source_.destroy();
    if (this.frameTransform_) this.frameTransform_.destroy();
    if (this.sink_) this.sink_.destroy();
  }
}
