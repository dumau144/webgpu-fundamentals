window.onload = async () => {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

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

  const uniformBufferSize =
    4 * 4 +
    2 * 4 +
    2 * 4;

  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformValues = new Float32Array(uniformBufferSize / 4);

  const kColorOffset = 0;
  const kScaleOffset = 4;
  const kOffsetOffset = 6;
 
  uniformValues.set([0, 1, 0, 1], kColorOffset);
  uniformValues.set([-0.5, -0.25], kOffsetOffset);

  const pipeline = device.createRenderPipeline({
    label: "triangle with uniforms",
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

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer }},
    ],
  });

  const render = () => {
    const aspect = canvas.width / canvas.height;
    uniformValues.set([0.5 / aspect, 0.5], kScaleOffset);
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

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
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();

    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
};
