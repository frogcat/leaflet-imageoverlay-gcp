import resolve from '@rollup/plugin-node-resolve';
import buble from '@rollup/plugin-buble';
import {
  terser
} from 'rollup-plugin-terser';

export default {
  input: 'leaflet-imageoverlay-gcp.js',
  output: [{
    file: 'dist/leaflet-imageoverlay-gcp.js',
    format: 'iife'
  }, {
    file: 'dist/leaflet-imageoverlay-gcp.min.js',
    format: 'iife',
    plugins: [terser()]
  }],
  plugins: [
    resolve(),
    buble()
  ]
};
