window.onload = async () => {
  const rand = (min = 0, max = 1) => min + Math.random() * (max - min);

  const fract = (x = 0) => x - Math.floor(x);

  const clamp = (x = 0, min = 0, max = 1) => Math.min(Math.max(min, x), max);

  const canvas = document.createElement("canvas");

  const observer = new ResizeObserver((entries) => {
    canvas.width = entries[0].contentRect.width * devicePixelRatio;
    canvas.height = entries[0].contentRect.height * devicePixelRatio;
  });

  observer.observe(canvas);

  const adapter = await navigator.gpu!.requestAdapter();
  const device = await adapter.requestDevice();

  const ctx = canvas.getContext("webgpu");
  ctx.configure({
    device: device,
    format: navigator.gpu.getPreferredCanvasFormat(),
  });

  const module = device.createShaderModule({
    label: "Our hardcoded red triangle shaders",
    code: /*wgsl*/ `
      struct OurStruct {
        color: vec4f,
        scale: vec2f,
        offset: vec2f,
      };

      @group(0) @binding(0) var<uniform> ourStruct: OurStruct;

      @vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0, 0.5),
          vec2f(-0.5,-0.5),
          vec2f( 0.5,-0.5)
        );

        return vec4f(pos[vertexIndex] * ourStruct.scale + ourStruct.offset, 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return ourStruct.color;
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: "multiple uniforms",
    layout: "auto",
    vertex: {
      module: module,
      entryPoint: "vs",
    },
    fragment: {
      module: module,
      entryPoint: "fs",
      targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
    },
  });

  const uniformBufferSize = 4 * 4 + 2 * 4 + 2 * 4;

  const kColorOffset = 0;
  const kScaleOffset = 4;
  const kOffsetOffset = 6;

  const kNumObjects = 100;
  const objectInfos = [];

  for (let i = 0; i < kNumObjects; ++i) {
    const uniformBuffer = device.createBuffer({
      label: `uniforms for obj: ${i}`,
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(uniformBufferSize / 4);
    const hue = Math.random();
    uniformValues.set(
      [
        clamp(Math.abs(6 * fract(hue - 1 / 1.0) - 3) - 1),
        clamp(Math.abs(6 * fract(hue - 1 / 3.0) - 3) - 1),
        clamp(Math.abs(6 * fract(hue - 1 / 1.5) - 3) - 1),
        1,
      ],
      kColorOffset
    );
    uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], kOffsetOffset);

    const bindGroup = device.createBindGroup({
      label: `bind group for obj: ${i}`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    objectInfos.push({
      scale: rand(0.2, 0.5),
      uniformBuffer,
      uniformValues,
      bindGroup,
    });
  }

  const render = () => {
    const encoder = device.createCommandEncoder({ label: "our encoder" });

    const pass = encoder.beginRenderPass({
      label: "our basic canvas renderPass",
      colorAttachments: [
        {
          view: ctx.getCurrentTexture().createView(),
          clearValue: [0.3, 0.3, 0.3, 1.0],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(pipeline);
    const aspect = canvas.width / canvas.height;

    for (const {
      scale,
      bindGroup,
      uniformBuffer,
      uniformValues,
    } of objectInfos) {
      uniformValues.set([scale / aspect, scale], kScaleOffset);
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
    }
    pass.end();

    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  };

  document.body.appendChild(canvas);

  requestAnimationFrame(render);
};
