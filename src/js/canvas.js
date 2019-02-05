// Raccoon canvas

const rcn_canvas_vs_source = `
  attribute vec4 vert;
  varying highp vec2 uv;
  void main(void) {
    uv = vert.zw;
    gl_Position = vec4(vert.xy, 0, 1);
  }
`;

const rcn_canvas_fs_source = `
  varying highp vec2 uv;
  uniform sampler2D sampler;

  void main(void) {
    gl_FragColor = texture2D(sampler, uv);
  }
`;

function rcn_canvas() {
  this.node = document.createElement('canvas');
  this.gl = this.node.getContext('webgl');

  this.texture = this.gl.createTexture();
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

  this.program = rcn_gl_create_program(this.gl, rcn_canvas_vs_source, rcn_canvas_fs_source);
  this.vbo = rcn_gl_create_array_buffer(this.gl, new Float32Array([
    -1, -1, 0, 2,
    -1, 3, 0, 0,
    3, -1, 2, 2,
  ]));
}

rcn_canvas.prototype.blit = function(x_start, y_start, width, height, pixels, palette) {
  if(!palette) {
    // Use current bin palette if unspecified
    palette = rcn_global_bin.rom.slice(rcn.mem_palette_offset, rcn.mem_palette_offset + rcn.mem_palette_size);
  }

  const x_end = x_start + width;
  const y_end = y_start + height;
  for(var x = x_start; x < x_end; x++) {
    for(var y = y_start; y < y_end; y++) {
      const pixel_index = y*(width>>1) + (x>>1); // Bitshift because pixels are 4bits
      var pixel = pixels[pixel_index];
      pixel = ((x & 1) == 0) ? (pixel & 0xf) : (pixel >> 4); // Deal with left or right pixel

      const cpixel_index = y*width + x;
      this.img[cpixel_index*4+0] = palette[pixel*3+0];
      this.img[cpixel_index*4+1] = palette[pixel*3+1];
      this.img[cpixel_index*4+2] = palette[pixel*3+2];
    }
  }
}

rcn_canvas.prototype.flush = function() {
  const gl = this.gl;

  // Render at the client size
  this.node.width = this.node.clientWidth;
  this.node.height = this.node.clientHeight;

  // We want to render pixel perfect, so we find a viewport size
  // that is a multiple of the texture size and fits the actual size
  var vp_mul = Math.floor(Math.min(this.node.width / this.width, this.node.height / this.height));
  var vp_width = vp_mul * this.width;
  var vp_height = vp_mul * this.height;
  var vp_x = (this.node.width - vp_width) / 2;
  var vp_y = (this.node.height - vp_height) / 2;
  gl.viewport(vp_x, vp_y, vp_width, vp_height);

  // Set and upload texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.img);

  gl.useProgram(this.program);
  gl.uniform1i(gl.getUniformLocation(this.program, 'sampler'), 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
  gl.vertexAttribPointer(gl.getAttribLocation(this.program, 'vert'), 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gl.getAttribLocation(this.program, 'vert'));

  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

rcn_canvas.prototype.set_size = function(width, height) {
  this.width = width;
  this.height = height;
  this.img = new Uint8Array(width * height * 4);

  // Set all alpha values to 255 in advance to avoid doing it later
  for(var i=3; i < this.img.length; i+=4) {
    this.img[i] = 255;
  }
}

rcn_canvas.prototype.client_to_texture_coords = function(x, y) {
  var vp_mul = Math.floor(Math.min(this.node.width / this.width, this.node.height / this.height));
  var vp_width = vp_mul * this.width;
  var vp_height = vp_mul * this.height;
  var vp_x = (this.node.width - vp_width) / 2;
  var vp_y = (this.node.height - vp_height) / 2;
  if(vp_x <= x && vp_y <= y && x < vp_x + vp_width  && y < vp_y + vp_height) {
    return {
      x: Math.floor((x - vp_x) / vp_mul),
      y: Math.floor((y - vp_y) / vp_mul),
    };
  } else {
    return null;
  }
}
