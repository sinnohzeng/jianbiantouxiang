/**
 * ShaderMount 的动态入口。整个 @paper-design/shaders 只从这里与 shaders/*、shader-noise
 * 三处进来，全部走 import()，首屏 JS 里一行 WebGL 代码都没有。
 */
export { ShaderMount } from '@paper-design/shaders'
