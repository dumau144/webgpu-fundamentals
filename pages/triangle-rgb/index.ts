window.onload = async () => {
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
    struct OurVertexShaderOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    };

      @vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> OurVertexShaderOutput {
        let pos = array(
          vec2f(-0.5,-0.5),
          vec2f( 0.0, 0.5),
          vec2f( 0.5,-0.5)
        );

        var color = array(
          vec4f(1.0, 0.0, 0.0, 1.0),
          vec4f(0.0, 1.0, 0.0, 1.0),
          vec4f(0.0, 0.0, 1.0, 1.0),
        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        vsOutput.color = color[vertexIndex];
        return vsOutput;
      }

      @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
        return fsInput.color;
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: "our hardcoded RGB triangle pipeline",
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
    pass.draw(3);
    pass.end();

    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
  };

  document.body.appendChild(canvas);
  
  requestAnimationFrame(render);
};
