/**
 * Defensive guards for Phaser 3 WebGL rendering pipeline.
 * Protects against WebGL "Framebuffer status: Incomplete Attachment" (GL error 36054)
 * which occurs when RenderTarget or WebGLFramebufferWrapper instances are resized
 * or initialized with zero dimensions (e.g. during iframe layout shifts, tab switching, or rapid flex resizing).
 */

export function applyPhaserWebGLFixes(PhaserInstance: any) {
  if (!PhaserInstance) return;

  const instances = [PhaserInstance];
  if (
    typeof window !== 'undefined' &&
    (window as any).Phaser &&
    (window as any).Phaser !== PhaserInstance
  ) {
    instances.push((window as any).Phaser);
  }

  for (const P of instances) {
    try {
      patchPhaserInstance(P);
    } catch (err) {
      console.warn('[WebGLFix] Error applying Phaser patch:', err);
    }
  }
}

function patchPhaserInstance(P: any) {
  const WebGL = P?.Renderer?.WebGL;
  if (!WebGL) return;

  // 1. Guard WebGLFramebufferWrapper
  const FramebufferWrapper = WebGL.Wrappers?.WebGLFramebufferWrapper;
  if (FramebufferWrapper && FramebufferWrapper.prototype && !FramebufferWrapper.prototype.__fbStatusGuarded) {
    FramebufferWrapper.prototype.__fbStatusGuarded = true;
    const origCreateResource = FramebufferWrapper.prototype.createResource;

    FramebufferWrapper.prototype.createResource = function () {
      const gl = this.gl;
      if (!gl || (gl.isContextLost && gl.isContextLost())) {
        return;
      }

      // Check and safeguard texture dimensions before binding
      const renderTexture = this.renderTexture;
      if (renderTexture) {
        if (!renderTexture.width || renderTexture.width <= 0) {
          renderTexture.width = Math.max(1, this.width || 1);
        }
        if (!renderTexture.height || renderTexture.height <= 0) {
          renderTexture.height = Math.max(1, this.height || 1);
        }
      }

      try {
        origCreateResource.call(this);
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('Framebuffer status')) {
          console.warn('[WebGLFix] Intercepted incomplete framebuffer attachment:', msg);
          return;
        }
        throw err;
      }
    };
  }

  // 2. Guard RenderTarget.prototype.resize
  const RenderTarget = WebGL.RenderTarget;
  if (RenderTarget && RenderTarget.prototype && !RenderTarget.prototype.__resizeGuarded) {
    RenderTarget.prototype.__resizeGuarded = true;
    const origTargetResize = RenderTarget.prototype.resize;

    RenderTarget.prototype.resize = function (width: number, height: number) {
      // Never resize a render target to 0 or negative dimensions
      if (width <= 0 || height <= 0 || !width || !height || isNaN(width) || isNaN(height)) {
        return this;
      }
      return origTargetResize.call(this, Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    };
  }

  // 3. Guard WebGLRenderer
  const WebGLRenderer = WebGL.WebGLRenderer;
  if (WebGLRenderer && WebGLRenderer.prototype) {
    if (!WebGLRenderer.prototype.__rendererResizeGuarded) {
      WebGLRenderer.prototype.__rendererResizeGuarded = true;
      const origRendererResize = WebGLRenderer.prototype.resize;

      WebGLRenderer.prototype.resize = function (width: number, height: number) {
        if (width <= 0 || height <= 0 || !width || !height || isNaN(width) || isNaN(height)) {
          return this;
        }
        return origRendererResize.call(this, Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
      };
    }

    if (!WebGLRenderer.prototype.__createFbGuarded) {
      WebGLRenderer.prototype.__createFbGuarded = true;
      const origCreateFramebuffer = WebGLRenderer.prototype.createFramebuffer;

      WebGLRenderer.prototype.createFramebuffer = function (
        width: number,
        height: number,
        renderTexture: any,
        addDepthStencilBuffer: boolean
      ) {
        const safeW = Math.max(1, Math.floor(width) || 1);
        const safeH = Math.max(1, Math.floor(height) || 1);
        return origCreateFramebuffer.call(this, safeW, safeH, renderTexture, addDepthStencilBuffer);
      };
    }

    if (!WebGLRenderer.prototype.__createTexGuarded) {
      WebGLRenderer.prototype.__createTexGuarded = true;
      const origCreateTexture = WebGLRenderer.prototype.createTextureFromSource;

      WebGLRenderer.prototype.createTextureFromSource = function (
        source: any,
        width: number,
        height: number,
        scaleMode: any,
        forceClamp: any
      ) {
        if (!source && (width <= 0 || height <= 0 || !width || !height)) {
          width = Math.max(1, Math.floor(width) || 1);
          height = Math.max(1, Math.floor(height) || 1);
        }
        return origCreateTexture.call(this, source, width, height, scaleMode, forceClamp);
      };
    }
  }
}
