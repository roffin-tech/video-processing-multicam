<template>
  <div id="container">
    <h1><a href="//webrtc.github.io/samples/" title="WebRTC samples homepage">WebRTC samples</a>
      <span>Video processing with insertable streams</span>
    </h1>

    <p>This sample shows how to perform processing on a video stream using the experimental
      <a href="https://github.com/w3c/mediacapture-insertable-streams">insertable streams</a> API.
      There are options for the source of the input stream, the destination of the output stream,
      and the API used to transform the stream. There is also the option to duplicate the source
      stream to a video element on the page, which may affect the source FPS.
    </p>

    <span id="outputVideoContainer"></span>

    <div class="box">
      <span>Source:</span>
      <select id="sourceSelector" @change="updatePipelineSource()" v-model="sourceSelector">
        <option selected value="">(stopped)</option>
        <option value="camera">Camera</option>
        <option value="video">Video</option>
        <option value="canvas">Canvas</option>
        <option value="pc">Peer connection (from camera)</option>
      </select>
      <span>Add to page: <input type="checkbox" id="sourceVisible" @change="updatePipelineSourceVisibility"
          v-model="sourceVisibleCheckbox"></span>
    </div>
    <div class="box">
      <span>Transform:</span>
      <select id="transformSelector" @change="updatePipelineTransform()" v-model="transformSelector">
        <option selected value="webgl">WebGL</option>
        <option value="canvas2d">Canvas2D</option>
        <option value="noop">Do nothing</option>
        <option value="drop">Drop frames at random</option>
        <option value="delay">Delay all frames by 100ms</option>
        <option value="webcodec">Run frames through WebCodec</option>
      </select>
    </div>
    <div class="box">
      <span>Destination:</span>
      <select id="sinkSelector" @change="updatePipelineSink()" v-model="sinkSelector">
        <option selected value="video">Video</option>
        <option value="pc">Peer connection</option>
      </select>
    </div>

    <p>View the console to see logging.</p>

    <p>
      <b>Note</b>: This sample is using an experimental API that has not yet been standardized.
      This API is available in Chrome 94 or later.
    </p>
    <a href="https://github.com/webrtc/samples/tree/gh-pages/src/content/insertable-streams/video-processing"
      title="View source for this page on GitHub" id="viewSource">View source on GitHub</a>

  </div>
</template>

<script lang="ts" setup>
  import { CameraSource } from '~/assets/js/camera-source';
  import { CanvasSource } from '~/assets/js/canvas-source';
  import { CanvasTransform } from '~/assets/js/canvas-transform';
  import { PeerConnectionSink } from '~/assets/js/peer-connection-sink';
  import { PeerConnectionSource } from '~/assets/js/peer-connection-source';
  import { Pipeline } from '~/assets/js/pipeline';
  import { DelayTransform, DropTransform, NullTransform } from '~/assets/js/simple-transforms';
  import { VideoSink } from '~/assets/js/video-sink';
  import { VideoSource } from '~/assets/js/video-source';
  import { WebCodecTransform } from '~/assets/js/webcodec-transform';
  import { WebGLTransform } from '~/assets/js/webgl-transform';

  let transformer1
  const pipeline: any = ref(null)
  let debug



  const sourceSelector = ref('')
  const sourceVisibleCheckbox = ref(false)
  const transformSelector = ref('canvas2d')
  const sinkSelector = ref('video');

  onMounted(async () => {
    if (typeof MediaStreamTrackProcessor === 'undefined' ||
      typeof MediaStreamTrackGenerator === 'undefined') {
      alert(
        'Your browser does not support the experimental MediaStreamTrack API ' +
        'for Insertable Streams of Media. See the note at the bottom of the ' +
        'page.');
    }
    console.log('pipeline', pipeline.value);
    await nextTick();
    await initPipeline();
    console.log('pipeline', pipeline.value);
    console.log(
      '[onMounted] Created new Pipeline.', 'debug.pipeline.value =', pipeline.value);

  })
  // const sourceSelector = /** @type {!HTMLSelectElement} */ (
  //   document.getElementById('sourceSelector'));
  // const sourceVisibleCheckbox = (/** @type {!HTMLInputElement} */ (
  //   document.getElementById('sourceVisible')));
  /**
   * Updates the pipeline.value based on the current settings of the sourceSelector
   * and sourceVisible UI elements. Unlike updatePipelineSource(), never
   * re-initializes the pipeline.value.
   */
  async function updatePipelineSourceIfSet() {
    const sourceType =
      sourceSelector.value;
    if (!sourceType) return;
    console.log(`[UI] Selected source: ${sourceType}`);
    let source;
    switch (sourceType) {
      case 'camera':
        source = new CameraSource();
        break;
      case 'video':
        source = new VideoSource();
        break;
      case 'canvas':
        source = new CanvasSource();
        break;
      case 'pc':
        source = new PeerConnectionSource(new CameraSource());
        break;
      default:
        alert(`unknown source ${sourceType}`);
        return;
    }
    console.log(`[UI] Created new source: ${sourceType}.`, source, sourceVisibleCheckbox.value);

    source.setVisibility(sourceVisibleCheckbox.value);
    console.log('Pipeline source', source, 'pipeline', pipeline.value);

    pipeline.value.updateSource(source);
  }
  /**
   * Updates the pipeline.value based on the current settings of the sourceSelector
   * and sourceVisible UI elements. If the "stopped" option is selected,
   * reinitializes the pipeline.value instead.
   */
  function updatePipelineSource() {
    const sourceType =
      sourceSelector.value;
    if (!sourceType || !pipeline.value) {
      initPipeline();
    } else {
      updatePipelineSourceIfSet();
    }
  }
  // sourceSelector.oninput = updatePipelineSource;
  // sourceSelector.disabled = false;

  /**
   * Updates the source visibility, if the source is already started.
   */
  function updatePipelineSourceVisibility() {
    console.log(`[UI] Changed source visibility: ${sourceVisibleCheckbox.value ? 'added' : 'removed'}`);
    if (pipeline.value) {
      const source = pipeline.value.getSource();
      if (source) {
        source.setVisibility(sourceVisibleCheckbox.value);
      }
    }
  }
  // sourceVisibleCheckbox.oninput = updatePipelineSourceVisibility;
  // sourceVisibleCheckbox.disabled = false;


  /**
   * Updates the pipeline.value based on the current settings of the transformSelector
   * UI element.
   */
  async function updatePipelineTransform() {
    if (!pipeline.value) {
      return;
    }
    const transformType =
      transformSelector.value;
    console.trace(`[UI] Selected transform: ${transformType}`);
    switch (transformType) {
      case 'webgl':
        pipeline.value.updateTransform(new WebGLTransform());
        break;
      case 'canvas2d':
        pipeline.value.updateTransform(new CanvasTransform());
        break;
      case 'drop':
        // Defined in simple-transforms.js.
        pipeline.value.updateTransform(new DropTransform());
        break;
      case 'noop':
        // Defined in simple-transforms.js.
        pipeline.value.updateTransform(new NullTransform());
        break;
      case 'delay':
        // Defined in simple-transforms.js.
        pipeline.value.updateTransform(new DelayTransform());
        break;
      case 'webcodec':
        // Defined in webcodec-transform.js
        pipeline.value.updateTransform(new WebCodecTransform());
        break;
      default:
        alert(`unknown transform ${transformType}`);
        break;
    }
  }
  // transformSelector.oninput = updatePipelineTransform;
  // transformSelector.disabled = false;


  /**
   * Updates the pipeline.value based on the current settings of the sinkSelector UI
   * element.
   */
  async function updatePipelineSink() {
    const sinkType = sinkSelector.value;
    console.log(`[UI] Selected sink: ${sinkType}`);
    switch (sinkType) {
      case 'video':
        pipeline.value.updateSink(new VideoSink());
        break;
      case 'pc':
        pipeline.value.updateSink(new PeerConnectionSink());
        break;
      default:
        alert(`unknown sink ${sinkType}`);
        break;
    }
  }
  // sinkSelector.oninput = updatePipelineSink;
  // sinkSelector.disabled = false;

  /**
   * Initializes/reinitializes the pipeline.value. Called on page load and after the
   * user chooses to stop the video source.
   */
  async function initPipeline() {
    if (pipeline.value) await pipeline.value.destroy();
    pipeline.value = new Pipeline();
    debug = { pipeline: pipeline.value };
    await updatePipelineSourceIfSet();
    await updatePipelineTransform();
    await updatePipelineSink();
    console.log(
      '[initPipeline] Created new Pipeline.', 'debug.pipeline.value =', pipeline.value);
  }
</script>

<style></style>
